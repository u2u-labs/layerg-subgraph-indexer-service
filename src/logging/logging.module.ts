import { Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { LoggingController } from './logging.controller';

@Module({
  controllers: [LoggingController],
  providers: [LoggingService],
})
export class LoggingModule {}
