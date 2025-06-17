import { Module } from '@nestjs/common';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [QueryController],
  providers: [QueryService],
  imports: [PrismaModule],
})
export class QueryModule {}
