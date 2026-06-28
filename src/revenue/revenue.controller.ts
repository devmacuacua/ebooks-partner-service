import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../api-key/api-key.guard';
import { RevenueService } from './revenue.service';
import { PartnerService } from '../partner/partner.service';

@Controller('partner/me/revenue')
@UseGuards(ApiKeyGuard)
export class RevenueController {
  constructor(
    private readonly revenueService: RevenueService,
    private readonly partnerService: PartnerService,
  ) {}

  @Get()
  async summary(@Req() req) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.revenueService.getSummary(partner.id);
  }

  @Get('details')
  async details(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('settled') settled?: string,
  ) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.revenueService.getDetails(partner.id, +page, +limit, settled === 'true');
  }

  @Get('monthly')
  async monthly(@Req() req, @Query('year') year?: number) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.revenueService.monthlyBreakdown(partner.id, +(year ?? new Date().getFullYear()));
  }
}
