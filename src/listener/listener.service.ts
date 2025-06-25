import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Client } from 'pg';

@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(ListenerService.name);
  private notificationClient: Client | null = null;
  private isListening = false;

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async onModuleInit() {
    await this.setupDatabaseListener();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async setupDatabaseListener() {
    try {
      // Create separate PostgreSQL connection for LISTEN/NOTIFY
      this.notificationClient = new Client({
        connectionString: process.env.DATABASE_URL,
      });

      await this.notificationClient.connect();
      this.logger.log('Connected to PostgreSQL for notifications');

      // Listen to our custom notification channel
      await this.notificationClient.query('LISTEN table_events');
      this.isListening = true;

      // Handle incoming notifications
      this.notificationClient.on('notification', (msg) => {
        this.handleDatabaseNotification(msg);
      });

      this.notificationClient.on('error', (err) => {
        this.logger.error('PostgreSQL notification client error:', err);
        this.reconnect();
      });

      this.logger.log('Database listener setup complete');
    } catch (error) {
      this.logger.error('Failed to setup database listener:', error);
    }
  }

  private handleDatabaseNotification(msg: any) {
    try {
      if (msg.channel === 'table_events') {
        const payload = JSON.parse(msg.payload);

        // Extract table information from the payload
        const { action, table_name, data, schema_name } = payload;

        // Parse subgraphId, typeName, chainId from table_name
        // Format: "subgraphId"."typename_chainid"
        const tableInfo = this.parseTableName(table_name, schema_name);

        if (tableInfo) {
          this.eventsService.emitDatabaseEvent({
            action: action as 'insert' | 'update' | 'delete',
            tableName: `"${tableInfo.subgraphId}"."${tableInfo.typeName.toLowerCase()}_${tableInfo.chainId}"`,
            data: data,
            timestamp: new Date(),
            subgraphId: tableInfo.subgraphId,
            typeName: tableInfo.typeName,
            chainId: tableInfo.chainId,
          });

          this.logger.debug(
            `Database event processed: ${action} on ${table_name}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling database notification:', error);
    }
  }

  private parseTableName(tableName: string, schemaName: string) {
    try {
      // Table format: typename_chainid
      // Schema format: subgraphId
      const match = tableName.match(/^(.+)_(\d+)$/);
      if (match) {
        const [, typeName, chainId] = match;
        return {
          subgraphId: schemaName,
          typeName: typeName.charAt(0).toUpperCase() + typeName.slice(1), // Capitalize
          chainId,
        };
      }
      return null;
    } catch (error) {
      this.logger.error('Error parsing table name:', error);
      return null;
    }
  }

  private async reconnect() {
    if (this.isListening) {
      this.logger.log('Attempting to reconnect to database listener...');
      await this.cleanup();
      setTimeout(() => {
        this.setupDatabaseListener();
      }, 5000);
    }
  }

  private async cleanup() {
    this.isListening = false;
    if (this.notificationClient) {
      try {
        await this.notificationClient.end();
        this.logger.log('Database listener connection closed');
      } catch (error) {
        this.logger.error('Error closing database listener connection:', error);
      }
    }
  }
}
