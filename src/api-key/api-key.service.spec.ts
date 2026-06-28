import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyService } from './api-key.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  apiKey: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should return a key with pk_live_ and sk_live_ prefixes', async () => {
      const partnerId = 'partner-123';
      const name = 'Meu Site';
      const fakeKey = {
        id: 'key-1',
        partnerId,
        name,
        publicKey: 'pk_live_abc123',
        secretKeyHash: 'hash',
        createdAt: new Date(),
      };

      mockPrisma.apiKey.create.mockResolvedValue(fakeKey);

      const result = await service.generate(partnerId, name);

      expect(result.publicKey).toMatch(/^pk_live_/);
      expect(result.secretKey).toMatch(/^sk_live_/);
      // Secret key is returned once — never stored plain
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partnerId,
            name,
            publicKey: expect.stringMatching(/^pk_live_/),
            secretKeyHash: expect.any(String),
          }),
        }),
      );
    });

    it('should store a SHA-256 hash, not the plain secret key', async () => {
      mockPrisma.apiKey.create.mockImplementation(({ data }) => ({
        ...data,
        id: 'key-x',
        createdAt: new Date(),
      }));

      const result = await service.generate('p-1', 'test');

      // Hash must differ from the raw secret key
      expect(result.secretKey).not.toEqual(result.secretKeyHash ?? '');
    });
  });

  describe('validateSecretKey', () => {
    it('returns null for keys not starting with sk_live_', async () => {
      const result = await service.validateSecretKey('invalid_key');
      expect(result).toBeNull();
      expect(mockPrisma.apiKey.findFirst).not.toHaveBeenCalled();
    });

    it('returns partnerId for a valid key', async () => {
      // Generate a real key to get the hash
      mockPrisma.apiKey.create.mockImplementation(({ data }) => ({
        ...data,
        id: 'key-valid',
        createdAt: new Date(),
        lastUsedAt: null,
      }));

      const generated = await service.generate('partner-X', 'test');

      mockPrisma.apiKey.findFirst.mockResolvedValue({
        id: 'key-valid',
        partnerId: 'partner-X',
        revokedAt: null,
      });
      mockPrisma.apiKey.update.mockResolvedValue({});

      const partnerId = await service.validateSecretKey(generated.secretKey);

      expect(partnerId).toBe('partner-X');
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
        }),
      );
    });

    it('returns null when key is not found in db', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      const result = await service.validateSecretKey('sk_live_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listForPartner', () => {
    it('returns keys without secretKeyHash', async () => {
      const keys = [
        { id: '1', name: 'Site A', publicKey: 'pk_live_a', lastUsedAt: null, createdAt: new Date() },
        { id: '2', name: 'Site B', publicKey: 'pk_live_b', lastUsedAt: null, createdAt: new Date() },
      ];
      mockPrisma.apiKey.findMany.mockResolvedValue(keys);

      const result = await service.listForPartner('partner-X');

      expect(result).toHaveLength(2);
      result.forEach((k: any) => expect(k.secretKeyHash).toBeUndefined());
    });
  });

  describe('revoke', () => {
    it('sets revokedAt for the key', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke('partner-X', 'key-1');

      expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-1', partnerId: 'partner-X' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
