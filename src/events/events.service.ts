import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface TableEventSubscription {
  subgraphId: string;
  typeName: string;
  chainId: string;
  action?: string;
}

export interface DatabaseEvent {
  action: 'insert' | 'update' | 'delete';
  tableName: string;
  data: any;
  timestamp: Date;
  subgraphId: string;
  typeName: string;
  chainId: string;
}

@Injectable()
export class EventsService {
  private logger = new Logger(EventsService.name);
  private eventEmitter = new EventEmitter();

  constructor(private prisma: PrismaService) {}

  subscribeToTableEvents(
    subscription: TableEventSubscription,
  ): Observable<MessageEvent> {
    const { subgraphId, typeName, chainId, action } = subscription;
    const tableName = `"${subgraphId}"."${typeName.toLowerCase()}_${chainId}"`;

    this.logger.log(
      `New subscription for table: ${tableName}, action: ${action || 'all'}`,
    );

    return new Observable<MessageEvent>((observer) => {
      const eventHandler = (event: DatabaseEvent) => {
        // Filter by table and action if specified
        if (event.tableName !== tableName) return;
        if (action && event.action !== action) return;

        const messageEvent: MessageEvent = {
          data: JSON.stringify({
            action: event.action,
            tableName: event.tableName,
            data: event.data,
            timestamp: event.timestamp,
            subgraphId: event.subgraphId,
            typeName: event.typeName,
            chainId: event.chainId,
          }),
          type: event.action,
          id: `${Date.now()}-${Math.random()}`,
        };

        observer.next(messageEvent);
      };

      // Listen to database events
      this.eventEmitter.on('database-event', eventHandler);

      // Send initial connection message
      observer.next({
        data: JSON.stringify({
          message: 'Connected to event stream',
          tableName,
          action: action || 'all',
        }),
        type: 'connection',
        id: `connection-${Date.now()}`,
      });

      // Cleanup on unsubscribe
      return () => {
        this.eventEmitter.off('database-event', eventHandler);
        this.logger.log(`Unsubscribed from table: ${tableName}`);
      };
    });
  }

  // This method will be called by your handler service when records are inserted/updated/deleted
  emitDatabaseEvent(event: DatabaseEvent) {
    this.logger.debug(
      `Emitting database event: ${event.action} on ${event.tableName}`,
    );

    // Validate the event data
    if (!this.isValidDatabaseEvent(event)) {
      this.logger.warn('Invalid database event received:', event);
      return;
    }

    // Log the event for debugging
    this.logger.log(
      `Database event: ${event.action} on table ${event.tableName} (${event.subgraphId}/${event.typeName}/${event.chainId})`,
    );

    // Emit the event to all subscribers
    this.eventEmitter.emit('database-event', event);

    // Optional: Store event in memory for replay/debugging
    this.storeRecentEvent(event);
  }

  private isValidDatabaseEvent(event: DatabaseEvent): boolean {
    return !!(
      event.action &&
      ['insert', 'update', 'delete'].includes(event.action) &&
      event.tableName &&
      event.subgraphId &&
      event.typeName &&
      event.chainId &&
      event.data &&
      event.timestamp
    );
  }

  private recentEvents: DatabaseEvent[] = [];
  private readonly MAX_RECENT_EVENTS = 100;

  private storeRecentEvent(event: DatabaseEvent) {
    this.recentEvents.push(event);

    // Keep only the most recent events
    if (this.recentEvents.length > this.MAX_RECENT_EVENTS) {
      this.recentEvents = this.recentEvents.slice(-this.MAX_RECENT_EVENTS);
    }
  }

  // Method to get recent events for debugging or replay
  getRecentEvents(filter?: {
    subgraphId?: string;
    typeName?: string;
    chainId?: string;
    action?: string;
    limit?: number;
  }): DatabaseEvent[] {
    let events = this.recentEvents;

    if (filter) {
      events = events.filter((event) => {
        if (filter.subgraphId && event.subgraphId !== filter.subgraphId)
          return false;
        if (filter.typeName && event.typeName !== filter.typeName) return false;
        if (filter.chainId && event.chainId !== filter.chainId) return false;
        if (filter.action && event.action !== filter.action) return false;
        return true;
      });
    }

    const limit = filter?.limit || events.length;
    return events.slice(-limit);
  }

  // Method to get active subscription count for monitoring
  getActiveSubscriptionsCount(): number {
    return this.eventEmitter.listenerCount('database-event');
  }

  // Method to emit a test event (useful for debugging)
  emitTestEvent(subgraphId: string, typeName: string, chainId: string) {
    const testEvent: DatabaseEvent = {
      action: 'insert',
      tableName: `"${subgraphId}"."${typeName.toLowerCase()}_${chainId}"`,
      data: { id: 999, test: true, message: 'This is a test event' },
      timestamp: new Date(),
      subgraphId,
      typeName,
      chainId,
    };

    this.emitDatabaseEvent(testEvent);
    this.logger.log(
      `Test event emitted for ${subgraphId}/${typeName}/${chainId}`,
    );
  }
}
