import { Controller, Param, Post, Req, Delete } from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // Subgraph webhooks

  @Post('/subgraphs/deploy/:ipfsHash')
  deploySubgraph(@Req() req: Request, @Param('ipfsHash') ipfsHash: string) {
    console.log('ipfsHash: ', ipfsHash);
  }

  @Delete('/subgraphs/:subgraphId')
  deleteSubgraph(@Req() req: Request, @Param() subgraphId: string) {
    console.log('subgraphId: ', subgraphId);
  }
}
