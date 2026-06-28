import { Module } from '@nestjs/common';
import { PartnerBookService } from './partner-book.service';
import { PartnerBookController } from './partner-book.controller';
import { PartnerModule } from '../partner/partner.module';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [PartnerModule, ApiKeyModule],
  providers: [PartnerBookService],
  controllers: [PartnerBookController],
  exports: [PartnerBookService],
})
export class PartnerBookModule {}
