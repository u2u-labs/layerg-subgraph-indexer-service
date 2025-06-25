import { Module } from '@nestjs/common';
import { ListenerService } from './listener.service';
import { ListenerController } from './listener.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [ListenerController],
  providers: [ListenerService],
  imports: [PrismaModule, EventsModule],
})
export class ListenerModule {}
