import { All, Controller, Param, Req, Res } from '@nestjs/common';
import { QueryService } from './query.service';
import { graphqlHTTP } from 'express-graphql';

@Controller('query/:subgraphId')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @All()
  async handle(
    @Param('subgraphId') subgraphId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const schema =
      this.queryService.createExecutableSchemaFromPrisma(subgraphId);
    return graphqlHTTP({ schema, graphiql: true })(req, res);
  }
}
