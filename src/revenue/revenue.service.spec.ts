import { Test, TestingModule } from '@nestjs/testing';
import { RevenueService } from './revenue.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  revenueShare: {
    upsert: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const basePayload = {
  partnerId: 'partner-1',
  orderId: 'order-1',
  orderItemId: 'item-1',
  bookId: 'book-1',
  bookTitle: 'Clean Architecture',
  grossAmount: 1000,
  revenueSharePct: 30,
  currency: 'MZN',
};

describe('RevenueService', () => {
  let service: RevenueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RevenueService>(RevenueService);
    jest.clearAllMocks();
  });

  describe('recordSale', () => {
    it('computes partner and platform amounts correctly', async () => {
      mockPrisma.revenueShare.upsert.mockResolvedValue({});

      await service.recordSale(basePayload);

      expect(mockPrisma.revenueShare.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            partnerAmount: 300,
            platformAmount: 700,
            grossAmount: 1000,
          }),
        }),
      );
    });

    it('uses orderItemId as idempotency key', async () => {
      mockPrisma.revenueShare.upsert.mockResolvedValue({});

      await service.recordSale(basePayload);

      expect(mockPrisma.revenueShare.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderItemId: 'item-1' } }),
      );
    });

    it('passes empty update to make upsert idempotent', async () => {
      mockPrisma.revenueShare.upsert.mockResolvedValue({});

      await service.recordSale(basePayload);

      expect(mockPrisma.revenueShare.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });
  });

  describe('getSummary', () => {
    it('returns zero totals when no sales exist', async () => {
      mockPrisma.revenueShare.aggregate
        .mockResolvedValueOnce({ _sum: { grossAmount: null, partnerAmount: null, platformAmount: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { partnerAmount: null }, _count: 0 });
      mockPrisma.revenueShare.findMany.mockResolvedValue([]);

      const result = await service.getSummary('partner-1');

      expect(result.allTime.grossRevenue).toBe(0);
      expect(result.allTime.yourShare).toBe(0);
      expect(result.pending.amount).toBe(0);
      expect(result.recentSales).toHaveLength(0);
    });

    it('returns correct aggregate totals', async () => {
      mockPrisma.revenueShare.aggregate
        .mockResolvedValueOnce({
          _sum: { grossAmount: 5000, partnerAmount: 1500, platformAmount: 3500 },
          _count: 5,
        })
        .mockResolvedValueOnce({ _sum: { partnerAmount: 600 }, _count: 2 });
      mockPrisma.revenueShare.findMany.mockResolvedValue([]);

      const result = await service.getSummary('partner-1');

      expect(result.allTime.totalSales).toBe(5);
      expect(result.allTime.grossRevenue).toBe(5000);
      expect(result.allTime.yourShare).toBe(1500);
      expect(result.pending.sales).toBe(2);
      expect(result.pending.amount).toBe(600);
    });
  });

  describe('getDetails', () => {
    it('applies correct pagination', async () => {
      mockPrisma.revenueShare.findMany.mockResolvedValue([]);
      mockPrisma.revenueShare.count.mockResolvedValue(0);

      await service.getDetails('partner-1', 2, 10);

      expect(mockPrisma.revenueShare.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('filters by settledAt when settledOnly=true', async () => {
      mockPrisma.revenueShare.findMany.mockResolvedValue([]);
      mockPrisma.revenueShare.count.mockResolvedValue(0);

      await service.getDetails('partner-1', 1, 20, true);

      expect(mockPrisma.revenueShare.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ settledAt: { not: null } }),
        }),
      );
    });
  });

  describe('monthlyBreakdown', () => {
    it('queries for the correct year', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.monthlyBreakdown('partner-1', 2025);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
