import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookController } from './webhook.controller';
import { PartnerModule } from '../partner/partner.module';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [PartnerModule, ApiKeyModule],
  providers: [WebhookService, WebhookDeliveryService],
  controllers: [WebhookController],
  exports: [WebhookService, WebhookDeliveryService],
})
export class WebhookModule {}
