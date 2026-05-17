import { Order, OrderStatus, OrderItemData } from '../../orders/entities/order.entity';
import { CreateOrderDto } from '../../orders/dto/create-order.dto';
import { CatalogProduct } from '../../catalog/catalog.provider';


export function makeOrderItem(overrides: Partial<OrderItemData> = {}): OrderItemData {
  return {
    productId: 'prod-001',
    productName: 'Test Product',
    unitPrice: 10.0,
    quantity: 2,
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  const order = new Order();
  order.id = 'order-uuid-1';
  order.orderNumber = 'ORD-2024-00001';
  order.userId = 'user-001';
  order.status = OrderStatus.PENDING;
  order.totalAmount = 20.0;
  order.notes = null;
  order.createdAt = new Date('2024-01-01T00:00:00Z');
  order.updatedAt = new Date('2024-01-01T00:00:00Z');
  order.items = [makeOrderItem()];
  return Object.assign(order, overrides);
}

export function makeCreateOrderDto(
  overrides: Partial<CreateOrderDto> = {},
): CreateOrderDto {
  return {
    userId: 'user-001',
    items: [
      {
        productId: 'prod-001',
        quantity: 2,
      },
    ],
    ...overrides,
  };
}

export function makeCatalogProduct(
  overrides: Partial<CatalogProduct> = {},
): CatalogProduct {
  return {
    productId: 'prod-001',
    productName: 'Test Product',
    unitPrice: 10.0,
    availableStock: 10,
    active: true,
    ...overrides,
  };
}

export function makeMockOrdersRepository() {
  return {
    enablePgTrgm: jest.fn().mockResolvedValue(undefined),
    createGinIndexes: jest.fn().mockResolvedValue(undefined),
    getNextOrderSequence: jest.fn().mockResolvedValue(1),
    save: jest.fn().mockImplementation((order: Order) =>
      Promise.resolve({ ...order, id: 'order-uuid-1' }),
    ),
    findById: jest.fn().mockResolvedValue(makeOrder()),
    findAll: jest.fn().mockResolvedValue({
      data: [makeOrder()],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    }),
    searchByText: jest.fn().mockResolvedValue([makeOrder()]),
  };
}

export function makeMockAuditClient() {
  return {
    emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
  };
}

export function makeMockInventoryCatalog() {
  return {
    getProducts: jest.fn().mockImplementation((productIds: string[]) =>
      Promise.resolve(
        new Map(
          productIds.map((productId) => [
            productId,
            makeCatalogProduct({ productId }),
          ]),
        ),
      ),
    ),
  };
}
