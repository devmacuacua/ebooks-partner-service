import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../api-key/api-key.guard';
import { PartnerBookService } from './partner-book.service';
import { PartnerService } from '../partner/partner.service';

@Controller('partner/me/books')
@UseGuards(ApiKeyGuard)
export class PartnerBookController {
  constructor(
    private readonly partnerBookService: PartnerBookService,
    private readonly partnerService: PartnerService,
  ) {}

  @Get()
  async list(@Req() req, @Query('page') page = 1, @Query('limit') limit = 20) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.partnerBookService.list(partner.id, +page, +limit);
  }

  @Post()
  async add(
    @Req() req,
    @Body('bookId') bookId: string,
    @Body('customPrice') customPrice?: number,
  ) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.partnerBookService.addBook(partner.id, bookId, customPrice);
  }

  @Delete(':bookId')
  async remove(@Req() req, @Param('bookId') bookId: string) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.partnerBookService.removeBook(partner.id, bookId);
  }
}
