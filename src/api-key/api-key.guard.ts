import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';

export const SECRET_KEY_ONLY = 'SECRET_KEY_ONLY';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Accept gateway-forwarded auth (management routes called through the frontend)
    if (req.headers['x-user-id']) {
      req.partnerId = req.headers['x-partner-id']; // set by partner middleware
      req.gatewayUserId = req.headers['x-user-id'];
      return true;
    }

    const authHeader: string = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) throw new UnauthorizedException('API key required');

    const secretOnlyMeta = this.reflector.get<boolean>(SECRET_KEY_ONLY, context.getHandler());

    if (token.startsWith('sk_live_')) {
      const partnerId = await this.apiKeyService.validateSecretKey(token);
      if (!partnerId) throw new UnauthorizedException('Invalid or revoked API key');
      req.partnerId = partnerId;
      return true;
    }

    if (!secretOnlyMeta && token.startsWith('pk_live_')) {
      const partnerId = await this.apiKeyService.validatePublicKey(token);
      if (!partnerId) throw new UnauthorizedException('Invalid public key');
      req.partnerId = partnerId;
      return true;
    }

    throw new UnauthorizedException('Invalid API key format');
  }
}
