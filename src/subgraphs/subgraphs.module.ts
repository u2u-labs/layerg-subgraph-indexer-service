import { Module } from '@nestjs/common';
import { SubgraphsService } from './subgraphs.service';
import { SubgraphsController } from './subgraphs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [SubgraphsController],
  providers: [SubgraphsService],
  imports: [PrismaModule],
})
export class SubgraphsModule {}
