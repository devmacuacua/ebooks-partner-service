import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/create-partner.dto';
import { PartnerStatus } from '@prisma/client';

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: CreatePartnerDto) {
    const existing = await this.prisma.partner.findFirst({
      where: { OR: [{ userId }, { email: dto.email }] },
    });
    if (existing) throw new ConflictException('Partner already registered');

    return this.prisma.partner.create({
      data: { userId, ...dto },
    });
  }

  async findByUserId(userId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { userId } });
    if (!partner) throw new NotFoundException('Partner profile not found');
    return partner;
  }

  async findById(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async update(userId: string, dto: UpdatePartnerDto) {
    const partner = await this.findByUserId(userId);
    return this.prisma.partner.update({
      where: { id: partner.id },
      data: dto,
    });
  }

  async listAll(page = 0, size = 20, search?: string, status?: PartnerStatus) {
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [content, totalElements] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        skip: page * size,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return { content, totalElements, totalPages: Math.ceil(totalElements / size) };
  }

  async setStatus(id: string, status: PartnerStatus) {
    await this.findById(id);
    return this.prisma.partner.update({ where: { id }, data: { status } });
  }
}
