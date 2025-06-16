import { All, Controller, Param, Req, Res } from '@nestjs/common';
import { SubgraphsService } from './subgraphs.service';
import { graphqlHTTP } from 'express-graphql';

@Controller('subgraph/:name/graphql')
export class SubgraphsController {
  constructor(private readonly subgraphService: SubgraphsService) {}

  @All()
  async handle(@Param('name') name: string, @Req() req: any, @Res() res: any) {
    const schema = this.subgraphService.createExecutableSchemaFromPrisma(name);
    return graphqlHTTP({ schema, graphiql: true })(req, res);
  }
}
