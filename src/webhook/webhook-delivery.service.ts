import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus } from '@prisma/client';
import axios from 'axios';
import { createHmac } from 'crypto';

const RETRY_DELAYS_MS = [0, 5 * 60 * 1000, 30 * 60 * 1000]; // 0, 5min, 30min
const MAX_ATTEMPTS = 3;

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async schedule(webhookId: string, event: string, payload: object, secret: string) {
    await this.prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload,
        status: DeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });
    // Fire-and-forget immediate attempt
    this.processDelivery(webhookId, event, payload, secret).catch(() => {});
  }

  // Retry cron — every minute, picks up FAILED deliveries whose nextAttemptAt has passed
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedDeliveries() {
    const due = await this.prisma.webhookDelivery.findMany({
      where: {
        status: DeliveryStatus.FAILED,
        attempts: { lt: MAX_ATTEMPTS },
        nextAttemptAt: { lte: new Date() },
      },
      include: { webhook: true },
      take: 50,
    });

    for (const delivery of due) {
      if (!delivery.webhook.active) continue;
      await this.attempt(delivery, delivery.webhook.secret);
    }
  }

  private async processDelivery(webhookId: string, event: string, payload: object, secret: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { webhookId, event, status: DeliveryStatus.PENDING },
      include: { webhook: true },
      orderBy: { createdAt: 'desc' },
    });
    if (delivery) await this.attempt(delivery, secret);
  }

  private async attempt(delivery: any, secret: string) {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const body = JSON.stringify(delivery.payload);
    const signature = this.sign(secret, timestamp, body);

    try {
      const response = await axios.post(delivery.webhook.url, delivery.payload, {
        timeout: 10_000,
        headers: {
          'Content-Type': 'application/json',
          'X-Ebooks-Event': delivery.event,
          'X-Ebooks-Timestamp': timestamp,
          'X-Ebooks-Signature': `sha256=${signature}`,
          'User-Agent': 'ebooks.co.mz-webhook/1.0',
        },
      });

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.SUCCESS,
          attempts: delivery.attempts + 1,
          lastAttemptAt: now,
          responseCode: response.status,
          responseBody: String(response.data).slice(0, 500),
        },
      });
    } catch (err: any) {
      const attempts = delivery.attempts + 1;
      const isExhausted = attempts >= MAX_ATTEMPTS;
      const nextAttemptAt = isExhausted
        ? null
        : new Date(now.getTime() + RETRY_DELAYS_MS[attempts]);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: isExhausted ? DeliveryStatus.EXHAUSTED : DeliveryStatus.FAILED,
          attempts,
          lastAttemptAt: now,
          nextAttemptAt,
          responseCode: err.response?.status ?? null,
          responseBody: String(err.response?.data ?? err.message).slice(0, 500),
        },
      });

      if (!isExhausted) {
        this.logger.warn(
          `Webhook ${delivery.id} attempt ${attempts}/${MAX_ATTEMPTS} failed — retry in ${RETRY_DELAYS_MS[attempts] / 60000}min`,
        );
      } else {
        this.logger.error(`Webhook ${delivery.id} exhausted after ${MAX_ATTEMPTS} attempts`);
      }
    }
  }

  private sign(secret: string, timestamp: string, body: string): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
  }
}
