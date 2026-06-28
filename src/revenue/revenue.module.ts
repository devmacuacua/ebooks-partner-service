import { Module } from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { RevenueController } from './revenue.controller';
import { PartnerModule } from '../partner/partner.module';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [PartnerModule, ApiKeyModule],
  providers: [RevenueService],
  controllers: [RevenueController],
  exports: [RevenueService],
})
export class RevenueModule {}
