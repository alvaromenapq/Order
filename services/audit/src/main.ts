import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const tcpPort = parseInt(process.env.AUDIT_TCP_PORT ?? '4001', 10);
  const httpPort = parseInt(process.env.HTTP_PORT ?? '3001', 10);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);

  console.log(`Audit service HTTP running on port ${httpPort}`);
  console.log(`Audit service TCP listening on port ${tcpPort}`);
}

bootstrap();
