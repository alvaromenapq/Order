import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrdersRepository, PaginatedResult } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { AUDIT_SERVICE } from '../events/events.module';
import {
  INVENTORY_CATALOG,
  InventoryCatalogProvider,
} from '../catalog/catalog.provider';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
};

@Injectable()
export class OrdersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Inject(AUDIT_SERVICE) private readonly auditClient: ClientProxy,
    @Inject(INVENTORY_CATALOG)
    private readonly inventoryCatalog: InventoryCatalogProvider,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ordersRepository.enablePgTrgm();
      await this.ordersRepository.createGinIndexes();
    } catch (error) {
      this.logger.error('Failed to initialize pg_trgm extension or GIN indexes', error);
    }
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    const products = await this.inventoryCatalog.getProducts(
      dto.items.map((item) => item.productId),
    );

    const enrichedItems = dto.items.map((item) => {
      const product = products.get(item.productId);

      if (!product) {
        throw new BadRequestException(
          `Product ${item.productId} does not exist in catalog`,
        );
      }

      if (!product.active) {
        throw new BadRequestException(
          `Product ${item.productId} is not available for ordering`,
        );
      }

      if (item.quantity > product.availableStock) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}: requested ${item.quantity}, available ${product.availableStock}`,
        );
      }

      return {
        productId: product.productId,
        productName: product.productName,
        unitPrice: product.unitPrice,
        quantity: item.quantity,
      };
    });

    const orderNumber = await this.generateOrderNumber();
    const totalAmount = enrichedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const order = new Order();
    order.orderNumber = orderNumber;
    order.userId = dto.userId;
    order.status = OrderStatus.PENDING;
    order.totalAmount = totalAmount;
    order.notes = dto.notes ?? null;
    order.items = enrichedItems;

    const saved = await this.ordersRepository.save(order);

    this.emitStatusChanged({
      orderId: saved.id,
      fromStatus: null,
      toStatus: OrderStatus.PENDING,
      timestamp: new Date(),
      metadata: { orderNumber: saved.orderNumber, userId: saved.userId },
    });

    return saved;
  }

  async findAll(dto: ListOrdersDto): Promise<PaginatedResult> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    return this.ordersRepository.findAll({
      status: dto.status,
      userId: dto.userId,
      page,
      limit,
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(id);
    const fromStatus = order.status;
    const toStatus = dto.status;

    const allowedTransitions = VALID_TRANSITIONS[fromStatus];
    if (!allowedTransitions.includes(toStatus)) {
      const allowed = allowedTransitions.length > 0
        ? allowedTransitions.join(', ')
        : 'none (terminal status)';
      throw new BadRequestException(
        `Invalid transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowed}`,
      );
    }

    order.status = toStatus;
    const updated = await this.ordersRepository.save(order);

    this.emitStatusChanged({
      orderId: updated.id,
      fromStatus,
      toStatus,
      timestamp: new Date(),
      metadata: dto.metadata,
    });

    return updated;
  }

  async search(q: string): Promise<Order[]> {
    if (!q || q.length < 3) {
      throw new BadRequestException(
        'Search query must be at least 3 characters',
      );
    }
    return this.ordersRepository.searchByText(q);
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.ordersRepository.getNextOrderSequence();
    const padded = String(sequence).padStart(5, '0');
    return `ORD-${year}-${padded}`;
  }

  private emitStatusChanged(payload: {
    orderId: string;
    fromStatus: string | null;
    toStatus: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): void {
    this.auditClient.emit('order.status_changed', payload).subscribe({
      error: (err) =>
        this.logger.error(
          `Failed to emit order.status_changed for order ${payload.orderId}`,
          err,
        ),
    });
  }
}
