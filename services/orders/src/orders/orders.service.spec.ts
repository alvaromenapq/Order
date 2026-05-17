import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { AUDIT_SERVICE } from '../events/events.module';
import { OrderStatus } from './entities/order.entity';
import {
  makeOrder,
  makeCatalogProduct,
  makeCreateOrderDto,
  makeMockOrdersRepository,
  makeMockAuditClient,
  makeMockInventoryCatalog,
} from '../test/fixtures/orders.mocks';
import { INVENTORY_CATALOG } from '../catalog/catalog.provider';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: ReturnType<typeof makeMockOrdersRepository>;
  let auditClient: ReturnType<typeof makeMockAuditClient>;
  let inventoryCatalog: ReturnType<typeof makeMockInventoryCatalog>;

  beforeEach(async () => {
    repository = makeMockOrdersRepository();
    auditClient = makeMockAuditClient();
    inventoryCatalog = makeMockInventoryCatalog();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: repository },
        { provide: AUDIT_SERVICE, useValue: auditClient },
        { provide: INVENTORY_CATALOG, useValue: inventoryCatalog },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('create', () => {
    it('should create order with PENDING status when valid items provided', async () => {
      const dto = makeCreateOrderDto();
      const order = makeOrder();
      repository.save.mockResolvedValue(order);

      const result = await service.create(dto);

      expect(result.status).toBe(OrderStatus.PENDING);
      expect(repository.save).toHaveBeenCalled();
      expect(auditClient.emit).toHaveBeenCalledWith(
        'order.status_changed',
        expect.objectContaining({
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
        }),
      );
      expect(inventoryCatalog.getProducts).toHaveBeenCalledWith(['prod-001']);
    });

    it('should throw BadRequestException when quantity exceeds catalog stock', async () => {
      const dto = makeCreateOrderDto({
        items: [
          {
            productId: 'prod-001',
            quantity: 15,
          },
        ],
      });
      inventoryCatalog.getProducts.mockResolvedValue(
        new Map([
          ['prod-001', makeCatalogProduct({ availableStock: 10 })],
        ]),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Insufficient stock for product prod-001',
      );
    });

    it('should throw BadRequestException when product does not exist in catalog', async () => {
      const dto = makeCreateOrderDto({
        items: [{ productId: 'missing-sku', quantity: 1 }],
      });
      inventoryCatalog.getProducts.mockResolvedValue(new Map());

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Product missing-sku does not exist in catalog',
      );
    });

    it('should use the catalog snapshot instead of client-supplied product data', async () => {
      const dto = makeCreateOrderDto({
        items: [{ productId: 'prod-001', quantity: 2 }],
      });
      repository.save.mockImplementation(async (order) => ({
        ...order,
        id: 'order-uuid-1',
      }));
      inventoryCatalog.getProducts.mockResolvedValue(
        new Map([
          [
            'prod-001',
            makeCatalogProduct({
              productName: 'Server Product',
              unitPrice: 25.5,
              availableStock: 10,
            }),
          ],
        ]),
      );

      const result = await service.create(dto);

      expect(result.items).toEqual([
        expect.objectContaining({
          productId: 'prod-001',
          productName: 'Server Product',
          unitPrice: 25.5,
          quantity: 2,
        }),
      ]);
      expect(result.totalAmount).toBe(51);
    });

    it('should throw BadRequestException when items array is empty', async () => {
      const dto = makeCreateOrderDto({ items: [] });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Order must have at least one item',
      );
    });
  });

  describe('updateStatus', () => {
    it('should throw BadRequestException when transition is invalid', async () => {
      const order = makeOrder({ status: OrderStatus.DELIVERED });
      repository.findById.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-uuid-1', { status: OrderStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus('order-uuid-1', { status: OrderStatus.PENDING }),
      ).rejects.toThrow('Invalid transition from DELIVERED to PENDING');
    });

    it('should throw NotFoundException when order not found on status update', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update order status when transition is valid', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      repository.findById.mockResolvedValue(order);
      const updatedOrder = makeOrder({ status: OrderStatus.CONFIRMED });
      repository.save.mockResolvedValue(updatedOrder);

      const result = await service.updateStatus('order-uuid-1', {
        status: OrderStatus.CONFIRMED,
      });

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(auditClient.emit).toHaveBeenCalledWith(
        'order.status_changed',
        expect.objectContaining({
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CONFIRMED,
        }),
      );
    });

    it('should allow transition from PENDING to CANCELLED', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      repository.findById.mockResolvedValue(order);
      repository.save.mockResolvedValue(makeOrder({ status: OrderStatus.CANCELLED }));

      const result = await service.updateStatus('order-uuid-1', {
        status: OrderStatus.CANCELLED,
      });

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should allow transition from PENDING to FAILED', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING });
      repository.findById.mockResolvedValue(order);
      repository.save.mockResolvedValue(makeOrder({ status: OrderStatus.FAILED }));

      const result = await service.updateStatus('order-uuid-1', {
        status: OrderStatus.FAILED,
      });

      expect(result.status).toBe(OrderStatus.FAILED);
    });

    it('should allow transition from CONFIRMED to PROCESSING', async () => {
      const order = makeOrder({ status: OrderStatus.CONFIRMED });
      repository.findById.mockResolvedValue(order);
      repository.save.mockResolvedValue(makeOrder({ status: OrderStatus.PROCESSING }));

      const result = await service.updateStatus('order-uuid-1', {
        status: OrderStatus.PROCESSING,
      });

      expect(result.status).toBe(OrderStatus.PROCESSING);
    });

    it('should allow transition from SHIPPED to DELIVERED', async () => {
      const order = makeOrder({ status: OrderStatus.SHIPPED });
      repository.findById.mockResolvedValue(order);
      repository.save.mockResolvedValue(makeOrder({ status: OrderStatus.DELIVERED }));

      const result = await service.updateStatus('order-uuid-1', {
        status: OrderStatus.DELIVERED,
      });

      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('should throw BadRequestException when transition is invalid from CANCELLED terminal status', async () => {
      const order = makeOrder({ status: OrderStatus.CANCELLED });
      repository.findById.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-uuid-1', { status: OrderStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus('order-uuid-1', { status: OrderStatus.PENDING }),
      ).rejects.toThrow('none (terminal status)');
    });

    it('should throw BadRequestException when transition is invalid from FAILED terminal status', async () => {
      const order = makeOrder({ status: OrderStatus.FAILED });
      repository.findById.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-uuid-1', { status: OrderStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
