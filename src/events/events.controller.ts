import {
  Controller,
  Query,
  Sse,
  MessageEvent,
  Get,
  Post,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('stream')
  streamEvents(
    @Query('id') subgraphId: string,
    @Query('typeName') typeName: string,
    @Query('chainId') chainId: string,
    @Query('action') action?: string, // 'insert' | 'update' | 'delete' | undefined (all)
  ): Observable<MessageEvent> {
    if (!subgraphId || !typeName || !chainId) {
      throw new Error(
        'Missing required parameters: subgraphId, typeName, chainId',
      );
    }

    return this.eventsService.subscribeToTableEvents({
      subgraphId,
      typeName,
      chainId,
      action,
    });
  }

  @Get('status')
  getStatus() {
    return {
      activeSubscriptions: this.eventsService.getActiveSubscriptionsCount(),
      timestamp: new Date(),
    };
  }

  @Post('test')
  emitTestEvent(
    @Query('id') subgraphId: string,
    @Query('typeName') typeName: string,
    @Query('chainId') chainId: string,
  ) {
    if (!subgraphId || !typeName || !chainId) {
      throw new Error(
        'Missing required parameters: subgraphId, typeName, chainId',
      );
    }

    this.eventsService.emitTestEvent(subgraphId, typeName, chainId);
    return { success: true, message: 'Test event emitted' };
  }
}
