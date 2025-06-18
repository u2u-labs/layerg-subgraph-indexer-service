import { Controller, Param, Post, Req, Delete } from '@nestjs/common';
import { Request } from 'express';
import { SubgraphsService } from './subgraphs.service';

@Controller('subgraphs')
export class SubgraphsController {
  constructor(private readonly subgraphsService: SubgraphsService) {}

  // Subgraph webhooks

  @Post('/deploy/:ipfsHash')
  deploySubgraph(@Req() req: Request, @Param('ipfsHash') ipfsHash: string) {
    console.log('ipfsHash: ', ipfsHash);
  }

  @Delete('/:subgraphId')
  deleteSubgraph(@Req() req: Request, @Param() subgraphId: string) {
    console.log('subgraphId: ', subgraphId);
  }
}
