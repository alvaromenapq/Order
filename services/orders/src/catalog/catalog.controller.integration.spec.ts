import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

const TEST_API_KEY = 'test-key';
const VALID_HEADERS = { 'x-api-key': TEST_API_KEY };

describe('CatalogController (integration)', () => {
  let app: INestApplication;
  let catalogService: jest.Mocked<CatalogService>;

  beforeEach(async () => {
    process.env.API_KEY = TEST_API_KEY;

    catalogService = {
      listProducts: jest.fn(),
    } as unknown as jest.Mocked<CatalogService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: catalogService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
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

  it('should return 200 with the mock catalog when authenticated', async () => {
    catalogService.listProducts.mockResolvedValue([
      {
        productId: 'SKU-1234',
        productName: 'Cafetera espresso',
        unitPrice: 129.9,
        availableStock: 8,
        active: true,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/catalog/products')
      .set(VALID_HEADERS)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        productId: 'SKU-1234',
        productName: 'Cafetera espresso',
      }),
    ]);
    expect(catalogService.listProducts).toHaveBeenCalledTimes(1);
  });

  it('should return 401 when API Key is missing', async () => {
    await request(app.getHttpServer()).get('/catalog/products').expect(401);

    expect(catalogService.listProducts).not.toHaveBeenCalled();
  });
});