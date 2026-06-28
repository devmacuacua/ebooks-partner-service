import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(partnerId: string, name: string) {
    const raw = randomBytes(32).toString('hex');
    const publicKey = `pk_live_${randomBytes(16).toString('hex')}`;
    const secretKey = `sk_live_${raw}`;
    const secretKeyHash = this.hash(secretKey);

    const apiKey = await this.prisma.apiKey.create({
      data: { partnerId, name, publicKey, secretKeyHash },
    });

    // Return the secret key only once — never stored in plain text
    return { ...apiKey, secretKey };
  }

  async listForPartner(partnerId: string) {
    return this.prisma.apiKey.findMany({
      where: { partnerId, revokedAt: null },
      select: { id: true, name: true, publicKey: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(partnerId: string, keyId: string) {
    return this.prisma.apiKey.updateMany({
      where: { id: keyId, partnerId },
      data: { revokedAt: new Date() },
    });
  }

  async validateSecretKey(secretKey: string): Promise<string | null> {
    if (!secretKey.startsWith('sk_live_')) return null;
    const hash = this.hash(secretKey);
    const key = await this.prisma.apiKey.findFirst({
      where: { secretKeyHash: hash, revokedAt: null },
    });
    if (!key) return null;

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return key.partnerId;
  }

  async validatePublicKey(publicKey: string): Promise<string | null> {
    if (!publicKey.startsWith('pk_live_')) return null;
    const key = await this.prisma.apiKey.findFirst({
      where: { publicKey, revokedAt: null },
    });
    if (!key) return null;
    return key.partnerId;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
