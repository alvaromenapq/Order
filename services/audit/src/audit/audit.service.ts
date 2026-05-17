import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { OrderStatusChangedDto } from './dto/order-status-changed.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async recordStatusChange(dto: OrderStatusChangedDto): Promise<void> {
    const log = new this.auditLogModel({
      orderId: dto.orderId,
      fromStatus: dto.fromStatus ?? null,
      toStatus: dto.toStatus,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      metadata: dto.metadata ?? {},
    });

    await log.save();
    this.logger.log(
      `Audit log saved for order ${dto.orderId}: ${dto.fromStatus} -> ${dto.toStatus}`,
    );
  }

  async getAuditLogs(orderId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ orderId })
      .sort({ timestamp: 1 })
      .exec();
  }
}
