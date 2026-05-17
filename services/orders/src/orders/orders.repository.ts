import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';

interface FindAllOptions {
  status?: OrderStatus;
  userId?: string;
  page: number;
  limit: number;
}

export interface PaginatedResult {
  data: Order[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async enablePgTrgm(): Promise<void> {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  }

  async createGinIndexes(): Promise<void> {
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_order_number_gin
      ON orders USING GIN (order_number gin_trgm_ops)
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_notes_gin
      ON orders USING GIN (notes gin_trgm_ops)
    `);
  }

  async getNextOrderSequence(): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM orders`,
    );
    return parseInt(result[0].count, 10) + 1;
  }

  async save(order: Order): Promise<Order> {
    return this.orderRepo.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.orderRepo.findOne({ where: { id } });
  }

  async findAll(options: FindAllOptions): Promise<PaginatedResult> {
    const { status, userId, page, limit } = options;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    if (userId) {
      qb.andWhere('order.userId = :userId', { userId });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async searchByText(q: string): Promise<Order[]> {
    const param = `%${q}%`;

    return this.orderRepo
      .createQueryBuilder('order')
      .where('order.orderNumber ILIKE :q', { q: param })
      .orWhere('order.notes ILIKE :q', { q: param })
      .orWhere("order.items::text ILIKE :q", { q: param })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }
}
