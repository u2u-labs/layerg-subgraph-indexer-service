import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DuckDBConnection } from '@duckdb/node-api';

@Injectable()
export class LoggingService implements OnModuleInit, OnModuleDestroy {
  private con: DuckDBConnection;

  async onModuleInit() {
    this.con = await DuckDBConnection.create();
  }

  onModuleDestroy() {
    if (this.con) {
      this.con.closeSync();
    }
  }

  async getLogs(limit = '10', offset = '0', order = 'desc'): Promise<any[]> {
    const parsedLimit = Math.max(1, Math.min(parseInt(limit), 1000));
    const parsedOffset = Math.max(0, parseInt(offset));
    const orderClause = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT *
      FROM read_json_auto('./tmp/*.logs', ignore_errors=true, format='newline_delimited')
      ORDER BY ts ${orderClause}
      LIMIT $1
      OFFSET $2;
    `;

    const result = await this.con.run(query, [parsedLimit, parsedOffset]);
    return result.getRowObjectsJson();
  }
}
