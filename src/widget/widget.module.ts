import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { PartnerModule } from '../partner/partner.module';
import { PartnerBookModule } from '../partner-book/partner-book.module';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [PartnerModule, PartnerBookModule, ApiKeyModule],
  controllers: [WidgetController],
})
export class WidgetModule {}
