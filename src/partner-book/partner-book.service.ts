import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class PartnerBookService {
  private readonly catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://ebooks-catalog-service:8082';

  constructor(private readonly prisma: PrismaService) {}

  async addBook(partnerId: string, bookId: string, customPrice?: number) {
    // Verify book exists in catalog
    try {
      await axios.get(`${this.catalogUrl}/books/${bookId}/internal`);
    } catch {
      throw new BadRequestException(`Book ${bookId} not found in catalog`);
    }

    return this.prisma.partnerBook.upsert({
      where: { partnerId_bookId: { partnerId, bookId } },
      create: { partnerId, bookId, customPrice, enabled: true },
      update: { enabled: true, customPrice },
    });
  }

  async removeBook(partnerId: string, bookId: string) {
    const existing = await this.prisma.partnerBook.findUnique({
      where: { partnerId_bookId: { partnerId, bookId } },
    });
    if (!existing) throw new NotFoundException('Book not in your catalog');

    return this.prisma.partnerBook.update({
      where: { partnerId_bookId: { partnerId, bookId } },
      data: { enabled: false },
    });
  }

  async list(partnerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const items = await this.prisma.partnerBook.findMany({
      where: { partnerId, enabled: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return items;
  }

  async getBooksForWidget(partnerId: string, limit = 12, category?: string) {
    const partnerBooks = await this.prisma.partnerBook.findMany({
      where: { partnerId, enabled: true },
      take: limit,
    });

    if (partnerBooks.length === 0) return [];

    const bookIds = partnerBooks.map((pb) => pb.bookId);

    // Fetch book details from catalog service
    const { data } = await axios.post(`${this.catalogUrl}/books/batch`, { ids: bookIds });
    const catalogBooks: any[] = Array.isArray(data) ? data : (data.books || []);

    // Filter by category if requested
    const filtered = category
      ? catalogBooks.filter((b) =>
          b.categories?.some((c: any) =>
            c.name?.toLowerCase().includes(category.toLowerCase()),
          ),
        )
      : catalogBooks;

    // Apply custom prices if partner has overridden them
    const priceMap = new Map(partnerBooks.map((pb) => [pb.bookId, pb.customPrice]));

    return filtered.map((book) => ({
      ...book,
      price: priceMap.get(book.id) ?? book.price,
    }));
  }

  async findPartnersByBookId(bookId: string): Promise<string[]> {
    const records = await this.prisma.partnerBook.findMany({
      where: { bookId, enabled: true },
      select: { partnerId: true },
    });
    return records.map((r) => r.partnerId);
  }
}
