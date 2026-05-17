import { AuditLog } from '../../audit/schemas/audit-log.schema';
import { OrderStatusChangedDto } from '../../audit/dto/order-status-changed.dto';

export function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    orderId: 'order-uuid-1',
    fromStatus: null,
    toStatus: 'PENDING',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    metadata: {},
    ...overrides,
  } as AuditLog;
}

export function makeOrderStatusChangedDto(
  overrides: Partial<OrderStatusChangedDto> = {},
): OrderStatusChangedDto {
  return {
    orderId: 'order-uuid-1',
    fromStatus: null,
    toStatus: 'PENDING',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    metadata: {},
    ...overrides,
  };
}

export function makeMockAuditLogModel(logs: AuditLog[] = []) {
  const mockSave = jest.fn().mockResolvedValue(undefined);

  const mockModel = jest.fn().mockImplementation(() => ({
    save: mockSave,
  })) as unknown as jest.Mock & {
    find: jest.Mock;
    save: jest.Mock;
  };

  mockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(logs),
    }),
  });

  mockModel.save = mockSave;

  return mockModel;
}