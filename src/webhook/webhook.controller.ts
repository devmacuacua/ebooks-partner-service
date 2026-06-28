import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../api-key/api-key.guard';
import { WebhookService } from './webhook.service';
import { PartnerService } from '../partner/partner.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Controller('partner/me/webhooks')
@UseGuards(ApiKeyGuard)
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly partnerService: PartnerService,
  ) {}

  @Get()
  async list(@Req() req) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.webhookService.list(partner.id);
  }

  @Post()
  async create(@Req() req, @Body() dto: CreateWebhookDto) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.webhookService.create(partner.id, dto);
  }

  @Delete(':webhookId')
  async remove(@Req() req, @Param('webhookId') webhookId: string) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.webhookService.remove(partner.id, webhookId);
  }

  @Patch(':webhookId/toggle')
  async toggle(
    @Req() req,
    @Param('webhookId') webhookId: string,
    @Body('active') active: boolean,
  ) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.webhookService.toggle(partner.id, webhookId, active);
  }

  @Get(':webhookId/deliveries')
  async deliveries(
    @Req() req,
    @Param('webhookId') webhookId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.webhookService.deliveryHistory(partner.id, webhookId, +page, +limit);
  }
}
