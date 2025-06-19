import { All, Controller, Query, Req, Res } from '@nestjs/common';
import { QueryService } from './query.service';
import { graphqlHTTP } from 'express-graphql';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @All()
  async handle(
    @Req() req: any,
    @Res() res: any,
    @Query('chainId') chainId: string,
    @Query('id') id: string,
  ) {
    console.log('chainId', chainId);
    const schema = this.queryService.createExecutableSchemaFromPrisma(
      id,
      Number(chainId),
    );
    return graphqlHTTP({ schema, graphiql: true })(req, res);
  }
}
