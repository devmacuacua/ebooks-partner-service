import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async create(partnerId: string, dto: CreateWebhookDto) {
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const webhook = await this.prisma.webhook.create({
      data: { partnerId, url: dto.url, events: dto.events, secret },
    });
    // Return secret only at creation time
    return { ...webhook };
  }

  async list(partnerId: string) {
    return this.prisma.webhook.findMany({
      where: { partnerId },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        // secret NOT included in list — returned only at creation
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(partnerId: string, webhookId: string) {
    const wh = await this.prisma.webhook.findFirst({
      where: { id: webhookId, partnerId },
    });
    if (!wh) throw new NotFoundException('Webhook not found');
    return this.prisma.webhook.delete({ where: { id: webhookId } });
  }

  async toggle(partnerId: string, webhookId: string, active: boolean) {
    const wh = await this.prisma.webhook.findFirst({
      where: { id: webhookId, partnerId },
    });
    if (!wh) throw new NotFoundException('Webhook not found');
    return this.prisma.webhook.update({
      where: { id: webhookId },
      data: { active },
    });
  }

  async findActiveByPartnerAndEvent(partnerId: string, event: string) {
    return this.prisma.webhook.findMany({
      where: {
        partnerId,
        active: true,
        events: { has: event },
      },
    });
  }

  async deliveryHistory(partnerId: string, webhookId: string, page = 1, limit = 20) {
    const wh = await this.prisma.webhook.findFirst({ where: { id: webhookId, partnerId } });
    if (!wh) throw new NotFoundException('Webhook not found');

    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
