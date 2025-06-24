import { All, Controller, Query, Req, Res } from '@nestjs/common';
import { GraphqlService } from './graphql.service';
import { graphqlHTTP } from 'express-graphql';

@Controller('graphql')
export class GraphqlController {
  constructor(private readonly graphqlService: GraphqlService) {}

  @All()
  async handle(
    @Req() req: any,
    @Res() res: any,
    @Query('chainId') chainId: string,
    @Query('id') id: string,
  ) {
    console.log('chainId', chainId);
    const schema = this.graphqlService.createExecutableSchemaFromPrisma(
      id,
      Number(chainId),
    );
    return graphqlHTTP({ schema, graphiql: true })(req, res);
  }
}
