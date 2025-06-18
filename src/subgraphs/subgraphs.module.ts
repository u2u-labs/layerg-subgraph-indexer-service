import { Module } from '@nestjs/common';
import { SubgraphsService } from './subgraphs.service';
import { SubgraphsController } from './subgraphs.controller';

@Module({
  controllers: [SubgraphsController],
  providers: [SubgraphsService],
})
export class SubgraphssModule {}
