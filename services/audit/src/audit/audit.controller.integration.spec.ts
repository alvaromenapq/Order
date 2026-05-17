/**
 * Integration tests — AuditController
 *
 * Strategy: the full NestJS HTTP stack is instantiated via TestingModule.
 * The AuditService is replaced by a jest mock so no real MongoDB connection
 * is needed.
 *
 * Per ADR-001, the MS Auditoría does not expose authentication on its HTTP
 * endpoint in this iteration (designed for internal consumption only, isolated
 * in the docker network). No auth header is required in these tests.
 *
 * The controller exposes:
 *   GET /audit/:orderId  — returns audit logs ordered by timestamp ASC
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { makeAuditLog } from '../test/fixtures/audit.mocks';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_ORDER_ID = 'order-uuid-1';
const MOCK_ORDER_ID_NO_RECORDS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AuditController (integration)', () => {
  let app: INestApplication;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    auditService = {
      getAuditLogs: jest.fn(),
      recordStatusChange: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /audit/:orderId
  // -------------------------------------------------------------------------

  describe('GET /audit/:orderId', () => {
    it('should return 200 with audit logs ordered by timestamp ASC when orderId has records', async () => {
      const logs = [
        makeAuditLog({
          orderId: MOCK_ORDER_ID,
          fromStatus: null,
          toStatus: 'PENDING',
          timestamp: new Date('2026-05-16T10:15:30.000Z'),
        }),
        makeAuditLog({
          orderId: MOCK_ORDER_ID,
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          timestamp: new Date('2026-05-16T10:30:00.000Z'),
        }),
        makeAuditLog({
          orderId: MOCK_ORDER_ID,
          fromStatus: 'CONFIRMED',
          toStatus: 'PROCESSING',
          timestamp: new Date('2026-05-16T11:00:00.000Z'),
        }),
      ];
      auditService.getAuditLogs.mockResolvedValue(logs);

      const response = await request(app.getHttpServer())
        .get(`/audit/${MOCK_ORDER_ID}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3);

      // Verify the ordering contract: first entry is the creation event
      const first = response.body[0];
      const last = response.body[2];
      expect(first.fromStatus).toBeNull();
      expect(first.toStatus).toBe('PENDING');
      expect(last.fromStatus).toBe('CONFIRMED');
      expect(last.toStatus).toBe('PROCESSING');

      // Each log must carry all required fields defined in AsyncAPI contract
      response.body.forEach(
        (log: { orderId: unknown; toStatus: unknown; timestamp: unknown }) => {
          expect(log).toHaveProperty('orderId', MOCK_ORDER_ID);
          expect(log).toHaveProperty('toStatus');
          expect(log).toHaveProperty('timestamp');
        },
      );

      expect(auditService.getAuditLogs).toHaveBeenCalledWith(MOCK_ORDER_ID);
    });

    it('should return 200 with empty array when orderId has no records', async () => {
      auditService.getAuditLogs.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get(`/audit/${MOCK_ORDER_ID_NO_RECORDS}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        MOCK_ORDER_ID_NO_RECORDS,
      );
    });

    it('should call getAuditLogs with the exact orderId from the URL path', async () => {
      auditService.getAuditLogs.mockResolvedValue([]);
      const specificId = 'cccccccc-dddd-eeee-ffff-000000000000';

      await request(app.getHttpServer())
        .get(`/audit/${specificId}`)
        .expect(200);

      expect(auditService.getAuditLogs).toHaveBeenCalledTimes(1);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(specificId);
    });
  });
});
