import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

export const AUDIT_SERVICE = 'AUDIT_SERVICE';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: AUDIT_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.AUDIT_HOST ?? 'localhost',
          port: parseInt(process.env.AUDIT_TCP_PORT ?? '4001', 10),
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class EventsModule {}
