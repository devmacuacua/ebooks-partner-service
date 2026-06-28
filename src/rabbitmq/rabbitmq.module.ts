import { Module } from '@nestjs/common';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';
import { RevenueModule } from '../revenue/revenue.module';
import { WebhookModule } from '../webhook/webhook.module';
import { PartnerBookModule } from '../partner-book/partner-book.module';
import { PartnerModule } from '../partner/partner.module';

@Module({
  imports: [RevenueModule, WebhookModule, PartnerBookModule, PartnerModule],
  providers: [RabbitMQConsumerService],
})
export class RabbitMQModule {}
