// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  await app.listen(3000);

  const logger = app.get(Logger);
  logger.log('🚀 Application started on http://localhost:3000');
}
bootstrap();
