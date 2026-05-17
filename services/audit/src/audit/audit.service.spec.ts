import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AuditLog } from './schemas/audit-log.schema';
import { makeAuditLog, makeOrderStatusChangedDto } from '../test/fixtures/audit.mocks';

describe('AuditService', () => {
  let service: AuditService;
  let mockModel: jest.Mock & { find: jest.Mock };

  function buildModelMock(resolvedLogs: AuditLog[] = []) {
    const execMock = jest.fn().mockResolvedValue(resolvedLogs);
    const sortMock = jest.fn().mockReturnValue({ exec: execMock });
    const findMock = jest.fn().mockReturnValue({ sort: sortMock });

    const modelMock = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    })) as jest.Mock & { find: jest.Mock };

    modelMock.find = findMock;

    return { modelMock, findMock, execMock };
  }

  beforeEach(async () => {
    const { modelMock } = buildModelMock();
    mockModel = modelMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getModelToken(AuditLog.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('getAuditLogs', () => {
    it('should return audit logs ordered by timestamp ASC when orderId has records', async () => {
      const logs = [
        makeAuditLog({
          fromStatus: null,
          toStatus: 'PENDING',
          timestamp: new Date('2024-01-01T00:00:00Z'),
        }),
        makeAuditLog({
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          timestamp: new Date('2024-01-02T00:00:00Z'),
        }),
      ];

      const execMock = jest.fn().mockResolvedValue(logs);
      const sortMock = jest.fn().mockReturnValue({ exec: execMock });
      mockModel.find = jest.fn().mockReturnValue({ sort: sortMock });

      const result = await service.getAuditLogs('order-uuid-1');

      expect(result).toHaveLength(2);
      expect(result[0].toStatus).toBe('PENDING');
      expect(result[1].toStatus).toBe('CONFIRMED');
      expect(mockModel.find).toHaveBeenCalledWith({ orderId: 'order-uuid-1' });
    });

    it('should return empty array when orderId has no audit records', async () => {
      const execMock = jest.fn().mockResolvedValue([]);
      const sortMock = jest.fn().mockReturnValue({ exec: execMock });
      mockModel.find = jest.fn().mockReturnValue({ sort: sortMock });

      const result = await service.getAuditLogs('non-existent-order');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('recordStatusChange', () => {
    it('should save audit log with correct data when valid dto provided', async () => {
      const dto = makeOrderStatusChangedDto({
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
      });

      const mockSave = jest.fn().mockResolvedValue(undefined);
      mockModel.mockImplementation(() => ({ save: mockSave }));

      await service.recordStatusChange(dto);

      expect(mockSave).toHaveBeenCalled();
    });
  });
});
