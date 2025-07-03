import { Controller, Get, Query } from '@nestjs/common';
import { LoggingService } from './logging.service';

@Controller('logging')
export class LoggingController {
  constructor(private readonly loggingService: LoggingService) {}

  @Get()
  async getLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('order') order?: string,
  ) {
    try {
      const logs = await this.loggingService.getLogs(limit, offset, order);
      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
        data: [],
      };
    }
  }
}
