import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { PartnerBookService } from '../partner-book/partner-book.service';
import { ApiKeyService } from '../api-key/api-key.service';
import { PartnerService } from '../partner/partner.service';

@Controller('partner/widget/v1')
export class WidgetController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly partnerService: PartnerService,
    private readonly partnerBookService: PartnerBookService,
  ) {}

  @Get(':publicKey/books')
  async books(
    @Param('publicKey') publicKey: string,
    @Query('limit') limit = 12,
    @Query('category') category?: string,
    @Res() res?: Response,
  ) {
    const partnerId = await this.apiKeyService.validatePublicKey(publicKey);
    if (!partnerId) throw new NotFoundException('Invalid partner key');

    const partner = await this.partnerService.findById(partnerId);
    if (partner.status !== 'ACTIVE') throw new NotFoundException('Partner not active');

    const books = await this.partnerBookService.getBooksForWidget(partnerId, +limit, category);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({ partnerName: partner.name, books });
  }

  @Get(':publicKey/book/:bookId')
  async singleBook(
    @Param('publicKey') publicKey: string,
    @Param('bookId') bookId: string,
    @Res() res?: Response,
  ) {
    const partnerId = await this.apiKeyService.validatePublicKey(publicKey);
    if (!partnerId) throw new NotFoundException('Invalid partner key');

    const partnerBooks = await this.partnerBookService.list(partnerId, 1, 1000);
    const pb = partnerBooks.find((b) => b.bookId === bookId);
    if (!pb || !pb.enabled) throw new NotFoundException('Book not in partner catalog');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({ bookId, customPrice: pb.customPrice });
  }
}
