import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'change-me-in-production') {
    throw new Error('API_KEY environment variable is not set or uses the default placeholder');
  }

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Orders service running on port ${port}`);
}

bootstrap();
