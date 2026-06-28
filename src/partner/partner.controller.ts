import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PartnerService } from './partner.service';
import { ApiKeyService } from '../api-key/api-key.service';
import { ApiKeyGuard } from '../api-key/api-key.guard';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/create-partner.dto';
import { PartnerStatus } from '@prisma/client';

@Controller('partner')
export class PartnerController {
  constructor(
    private readonly partnerService: PartnerService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  // ─── Registration (called from logged-in frontend user) ─────────────────────

  @Post()
  register(@Req() req, @Body() dto: CreatePartnerDto) {
    const userId = req.headers['x-user-id'];
    return this.partnerService.register(userId, dto);
  }

  @Get('me')
  @UseGuards(ApiKeyGuard)
  getProfile(@Req() req) {
    return this.partnerService.findByUserId(req.gatewayUserId);
  }

  @Patch('me')
  @UseGuards(ApiKeyGuard)
  update(@Req() req, @Body() dto: UpdatePartnerDto) {
    return this.partnerService.update(req.gatewayUserId, dto);
  }

  // ─── API Key management ──────────────────────────────────────────────────────

  @Get('me/api-keys')
  @UseGuards(ApiKeyGuard)
  async listApiKeys(@Req() req) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.apiKeyService.listForPartner(partner.id);
  }

  @Post('me/api-keys')
  @UseGuards(ApiKeyGuard)
  async createApiKey(
    @Req() req,
    @Body('name') name: string,
  ) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.apiKeyService.generate(partner.id, name || 'Default key');
  }

  @Patch('me/api-keys/:keyId/revoke')
  @UseGuards(ApiKeyGuard)
  async revokeApiKey(@Req() req, @Param('keyId') keyId: string) {
    const partner = await this.partnerService.findByUserId(req.gatewayUserId);
    return this.apiKeyService.revoke(partner.id, keyId);
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  @Get('admin')
  listAll(
    @Req() req,
    @Query('page') page = 0,
    @Query('size') size = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    if (req.headers['x-user-role'] !== 'ADMIN') {
      throw new Error('Forbidden');
    }
    const validStatuses = Object.values(PartnerStatus) as string[];
    const statusEnum = status && validStatuses.includes(status)
      ? (status as PartnerStatus)
      : undefined;
    return this.partnerService.listAll(+page, +size, search, statusEnum);
  }

  @Patch('admin/:id/status')
  setStatus(
    @Req() req,
    @Param('id') id: string,
    @Body('status') status: PartnerStatus,
  ) {
    if (req.headers['x-user-role'] !== 'ADMIN') {
      throw new Error('Forbidden');
    }
    return this.partnerService.setStatus(id, status);
  }
}
