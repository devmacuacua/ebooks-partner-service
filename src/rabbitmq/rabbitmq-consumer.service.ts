import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RevenueService } from '../revenue/revenue.service';
import { WebhookService } from '../webhook/webhook.service';
import { WebhookDeliveryService } from '../webhook/webhook-delivery.service';
import { PartnerBookService } from '../partner-book/partner-book.service';
import { PartnerService } from '../partner/partner.service';

const EXCHANGE = 'ebooks.events';
const QUEUE = 'partner-service-queue';
const EVENTS = ['commerce.order.paid', 'commerce.order.refunded', 'commerce.order.shipped'];

@Injectable()
export class RabbitMQConsumerService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQConsumerService.name);

  constructor(
    private readonly revenueService: RevenueService,
    private readonly webhookService: WebhookService,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly partnerBookService: PartnerBookService,
    private readonly partnerService: PartnerService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL!);
      const channel = await conn.createChannel();

      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await channel.assertQueue(QUEUE, { durable: true });

      for (const event of EVENTS) {
        await channel.bindQueue(QUEUE, EXCHANGE, event);
      }

      channel.prefetch(5);
      channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          await this.dispatch(routingKey, payload);
          channel.ack(msg);
        } catch (err) {
          this.logger.error('Failed to process message', err);
          channel.nack(msg, false, false); // dead-letter, do not requeue
        }
      });

      conn.on('error', () => this.reconnect());
      conn.on('close', () => this.reconnect());

      this.logger.log('Connected to RabbitMQ');
    } catch (err) {
      this.logger.error('RabbitMQ connection failed, retrying in 5s');
      setTimeout(() => this.connect(), 5000);
    }
  }

  private reconnect() {
    this.logger.warn('RabbitMQ connection lost, reconnecting in 5s');
    setTimeout(() => this.connect(), 5000);
  }

  private async dispatch(event: string, payload: any) {
    switch (event) {
      case 'commerce.order.paid':
        return this.handleOrderPaid(payload);
      case 'commerce.order.refunded':
        return this.handleOrderRefunded(payload);
      case 'commerce.order.shipped':
        return this.handleOrderShipped(payload);
    }
  }

  private async handleOrderPaid(payload: {
    orderId: string;
    orderNumber: string;
    items: Array<{
      orderItemId: string;
      bookId: string;
      bookTitle: string;
      price: number;
      currency: string;
    }>;
  }) {
    for (const item of payload.items) {
      const partnerIds = await this.partnerBookService.findPartnersByBookId(item.bookId);

      for (const partnerId of partnerIds) {
        const partner = await this.partnerService.findById(partnerId);
        if (partner.status !== 'ACTIVE') continue;

        // Record revenue share
        await this.revenueService.recordSale({
          partnerId,
          orderId: payload.orderId,
          orderItemId: item.orderItemId,
          bookId: item.bookId,
          bookTitle: item.bookTitle,
          grossAmount: item.price,
          revenueSharePct: partner.revenueSharePct,
          currency: item.currency,
        });

        // Fire webhooks
        await this.fireWebhooks(partnerId, 'order.paid', {
          event: 'order.paid',
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          book: {
            id: item.bookId,
            title: item.bookTitle,
          },
          amount: item.price,
          currency: item.currency,
          partnerShare: Math.round(item.price * partner.revenueSharePct) / 100,
        });
      }
    }
  }

  private async handleOrderRefunded(payload: any) {
    const partnerIds = await this.partnerBookService.findPartnersByBookId(payload.bookId);
    for (const partnerId of partnerIds) {
      await this.fireWebhooks(partnerId, 'order.refunded', {
        event: 'order.refunded',
        orderId: payload.orderId,
        bookId: payload.bookId,
      });
    }
  }

  private async handleOrderShipped(payload: any) {
    const partnerIds = await this.partnerBookService.findPartnersByBookId(payload.bookId);
    for (const partnerId of partnerIds) {
      await this.fireWebhooks(partnerId, 'order.shipped', {
        event: 'order.shipped',
        orderId: payload.orderId,
        bookId: payload.bookId,
        trackingCode: payload.trackingCode,
      });
    }
  }

  private async fireWebhooks(partnerId: string, event: string, data: object) {
    const hooks = await this.webhookService.findActiveByPartnerAndEvent(partnerId, event);
    for (const hook of hooks) {
      await this.deliveryService.schedule(hook.id, event, data, hook.secret);
    }
  }
}
