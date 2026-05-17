import { Controller, Get, Param, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from './audit.service';
import { OrderStatusChangedDto } from './dto/order-status-changed.dto';

@Controller('audit')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern('order.status_changed')
  async handleOrderStatusChanged(
    @Payload() payload: OrderStatusChangedDto,
  ): Promise<void> {
    try {
      await this.auditService.recordStatusChange(payload);
    } catch (error) {
      this.logger.error(
        `Failed to process order.status_changed event for order ${payload.orderId}`,
        error,
      );
    }
  }

  @Get(':orderId')
  getAuditLogs(@Param('orderId') orderId: string) {
    return this.auditService.getAuditLogs(orderId);
  }

}
