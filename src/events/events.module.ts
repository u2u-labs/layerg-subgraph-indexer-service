import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [EventsController],
  providers: [EventsService],
  imports: [PrismaModule],
  exports: [EventsService],
})
export class EventsModule {}
