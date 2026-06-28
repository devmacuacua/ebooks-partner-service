import { Module } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [ApiKeyModule],
  providers: [PartnerService],
  controllers: [PartnerController],
  exports: [PartnerService],
})
export class PartnerModule {}
