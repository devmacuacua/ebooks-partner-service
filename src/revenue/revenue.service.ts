import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSale(payload: {
    partnerId: string;
    orderId: string;
    orderItemId: string;
    bookId: string;
    bookTitle: string;
    grossAmount: number;
    revenueSharePct: number;
    currency: string;
  }) {
    const partnerAmount = (payload.grossAmount * payload.revenueSharePct) / 100;
    const platformAmount = payload.grossAmount - partnerAmount;

    return this.prisma.revenueShare.upsert({
      where: { orderItemId: payload.orderItemId },
      create: {
        partnerId: payload.partnerId,
        orderId: payload.orderId,
        orderItemId: payload.orderItemId,
        bookId: payload.bookId,
        bookTitle: payload.bookTitle,
        grossAmount: payload.grossAmount,
        partnerAmount,
        platformAmount,
        currency: payload.currency,
      },
      update: {}, // idempotent — ignore duplicate events
    });
  }

  async getSummary(partnerId: string) {
    const [totals, unsettled, recent] = await Promise.all([
      this.prisma.revenueShare.aggregate({
        where: { partnerId },
        _sum: { grossAmount: true, partnerAmount: true, platformAmount: true },
        _count: true,
      }),
      this.prisma.revenueShare.aggregate({
        where: { partnerId, settledAt: null },
        _sum: { partnerAmount: true },
        _count: true,
      }),
      this.prisma.revenueShare.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      allTime: {
        totalSales: totals._count,
        grossRevenue: totals._sum.grossAmount ?? 0,
        yourShare: totals._sum.partnerAmount ?? 0,
        platformShare: totals._sum.platformAmount ?? 0,
      },
      pending: {
        sales: unsettled._count,
        amount: unsettled._sum.partnerAmount ?? 0,
      },
      recentSales: recent,
    };
  }

  async getDetails(partnerId: string, page = 1, limit = 20, settledOnly = false) {
    const skip = (page - 1) * limit;
    const where: any = { partnerId };
    if (settledOnly) where.settledAt = { not: null };

    const [items, total] = await Promise.all([
      this.prisma.revenueShare.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.revenueShare.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async monthlyBreakdown(partnerId: string, year: number) {
    // Raw SQL via prisma.$queryRaw for date_trunc grouping
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        DATE_TRUNC('month', "createdAt") AS month,
        COUNT(*)::int                    AS sales,
        SUM("grossAmount")               AS gross,
        SUM("partnerAmount")             AS partner_share
      FROM revenue_shares
      WHERE "partnerId" = ${partnerId}
        AND EXTRACT(YEAR FROM "createdAt") = ${year}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows;
  }
}
