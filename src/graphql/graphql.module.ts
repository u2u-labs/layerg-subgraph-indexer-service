import { Module } from '@nestjs/common';
import { GraphqlService } from './graphql.service';
import { GraphqlController } from './graphql.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [GraphqlController],
  providers: [GraphqlService],
  imports: [PrismaModule],
})
export class GraphqlModule {}
