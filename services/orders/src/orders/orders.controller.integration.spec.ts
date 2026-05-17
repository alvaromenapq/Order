/**
 * Integration tests — OrdersController
 *
 * Strategy: the full NestJS HTTP stack (pipes, guards, controller) is
 * instantiated via TestingModule.  The persistence layer (OrdersService) is
 * replaced by a jest.Mocked<OrdersService> so no real database or TCP
 * connection is needed.
 *
 * Auth: API_KEY environment variable is set to 'test-key' before app.init().
 * Authenticated requests include the header x-api-key: test-key.
 * The real ApiKeyGuard implementation is registered as a global guard so the
 * auth behavior is fully exercised in these tests.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { OrderStatus } from './entities/order.entity';
import { makeOrder, makeCreateOrderDto } from '../test/fixtures/orders.mocks';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-key';
const VALID_HEADERS = { 'x-api-key': TEST_API_KEY };
const MOCK_ORDER_ID = 'order-uuid-1';
const NON_EXISTENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ---------------------------------------------------------------------------
// Service mock factory
// ---------------------------------------------------------------------------

function buildOrdersServiceMock(): jest.Mocked<OrdersService> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    search: jest.fn(),
    updateStatus: jest.fn(),
    // onApplicationBootstrap is part of the lifecycle interface; not called
    // during TestingModule usage because NestJS does not trigger lifecycle
    // hooks automatically in test modules unless explicitly configured.
    onApplicationBootstrap: jest.fn(),
  } as unknown as jest.Mocked<OrdersService>;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OrdersController (integration)', () => {
  let app: INestApplication;
  let ordersService: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    process.env.API_KEY = TEST_API_KEY;

    ordersService = buildOrdersServiceMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalGuards(new ApiKeyGuard());

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.API_KEY;
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // POST /orders
  // -------------------------------------------------------------------------

  describe('POST /orders', () => {
    it('should return 201 with order when valid payload provided', async () => {
      const dto = makeCreateOrderDto();
      const expectedOrder = makeOrder();
      ordersService.create.mockResolvedValue(expectedOrder);

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set(VALID_HEADERS)
        .send(dto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: MOCK_ORDER_ID,
        status: OrderStatus.PENDING,
        userId: expectedOrder.userId,
      });
      expect(ordersService.create).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when items array is empty', async () => {
      const dto = makeCreateOrderDto({ items: [] });

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set(VALID_HEADERS)
        .send(dto)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      // ValidationPipe catches ArrayMinSize(1) — service is never reached
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('should return 400 when quantity exceeds catalog stock', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      const dto = makeCreateOrderDto({
        items: [
          {
            productId: 'prod-001',
            quantity: 99,
          },
        ],
      });

      ordersService.create.mockRejectedValue(
        new BadRequestException(
          'Insufficient stock for product prod-001: requested 99, available 10',
        ),
      );

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set(VALID_HEADERS)
        .send(dto)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('Insufficient stock');
    });

    it('should return 401 when API Key is missing', async () => {
      const dto = makeCreateOrderDto();

      const response = await request(app.getHttpServer())
        .post('/orders')
        // No x-api-key header
        .send(dto)
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('should return 401 when API Key is invalid', async () => {
      const dto = makeCreateOrderDto();

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set({ 'x-api-key': 'wrong-key' })
        .send(dto)
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(ordersService.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /orders
  // -------------------------------------------------------------------------

  describe('GET /orders', () => {
    it('should return 200 with paginated orders when authenticated', async () => {
      const paginatedResult = {
        data: [makeOrder()],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      };
      ordersService.findAll.mockResolvedValue(paginatedResult);

      const response = await request(app.getHttpServer())
        .get('/orders')
        .set(VALID_HEADERS)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        page: 1,
        limit: 20,
        total: 1,
      });
      expect(ordersService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when status filter is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders?status=INVALIDO')
        .set(VALID_HEADERS)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      // ValidationPipe rejects unknown enum value — service is never reached
      expect(ordersService.findAll).not.toHaveBeenCalled();
    });

    it('should return 401 when API Key is missing on GET /orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(ordersService.findAll).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /orders/search
  // Note: /orders/search is registered before /orders/:id in the controller
  // so NestJS routes it correctly without treating 'search' as an id param.
  // -------------------------------------------------------------------------

  describe('GET /orders/search', () => {
    it('should return 200 with matching orders when search query is valid', async () => {
      const matchingOrders = [makeOrder()];
      ordersService.search.mockResolvedValue(matchingOrders);

      const response = await request(app.getHttpServer())
        .get('/orders/search?q=laptop')
        .set(VALID_HEADERS)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(ordersService.search).toHaveBeenCalledWith('laptop');
    });

    it('should return 200 with empty array when search has no results', async () => {
      ordersService.search.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/orders/search?q=terminoquenoexiste')
        .set(VALID_HEADERS)
        .expect(200);

      expect(response.body).toEqual([]);
      expect(ordersService.search).toHaveBeenCalledWith('terminoquenoexiste');
    });

    it('should return 400 when search query is less than 3 characters', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/search?q=ab')
        .set(VALID_HEADERS)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(ordersService.search).not.toHaveBeenCalled();
    });

    it('should return 401 when API Key is missing on GET /orders/search', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/search?q=laptop')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(ordersService.search).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // PUT /orders/:id/status
  // -------------------------------------------------------------------------

  describe('PUT /orders/:id/status', () => {
    it('should return 200 with updated order when valid transition', async () => {
      const updatedOrder = makeOrder({ status: OrderStatus.PROCESSING });
      ordersService.updateStatus.mockResolvedValue(updatedOrder);

      const response = await request(app.getHttpServer())
        .put(`/orders/${MOCK_ORDER_ID}/status`)
        .set(VALID_HEADERS)
        .send({ status: OrderStatus.PROCESSING })
        .expect(200);

      expect(response.body).toMatchObject({
        id: MOCK_ORDER_ID,
        status: OrderStatus.PROCESSING,
      });
      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        MOCK_ORDER_ID,
        expect.objectContaining({ status: OrderStatus.PROCESSING }),
      );
    });

    it('should return 400 when transition is invalid', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      ordersService.updateStatus.mockRejectedValue(
        new BadRequestException(
          `Invalid transition from ${OrderStatus.SHIPPED} to ${OrderStatus.PENDING}. Allowed transitions: DELIVERED`,
        ),
      );

      const response = await request(app.getHttpServer())
        .put(`/orders/${MOCK_ORDER_ID}/status`)
        .set(VALID_HEADERS)
        .send({ status: OrderStatus.PENDING })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('Invalid transition');
    });

    it('should return 404 when order not found on status update', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      ordersService.updateStatus.mockRejectedValue(
        new NotFoundException(`Order ${NON_EXISTENT_ID} not found`),
      );

      const response = await request(app.getHttpServer())
        .put(`/orders/${NON_EXISTENT_ID}/status`)
        .set(VALID_HEADERS)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 when status body value is not a valid OrderStatus', async () => {
      const response = await request(app.getHttpServer())
        .put(`/orders/${MOCK_ORDER_ID}/status`)
        .set(VALID_HEADERS)
        .send({ status: 'NOT_A_VALID_STATUS' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      // ValidationPipe rejects unknown enum value — service is never reached
      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });

    it('should return 401 when API Key is missing on PUT /orders/:id/status', async () => {
      const response = await request(app.getHttpServer())
        .put(`/orders/${MOCK_ORDER_ID}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });
  });
});
