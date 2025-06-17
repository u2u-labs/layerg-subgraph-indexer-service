import { makeExecutableSchema } from '@graphql-tools/schema';
import { IResolvers } from '@graphql-tools/utils';
import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { GraphQLSchema, parse } from 'graphql';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractTypeNames,
  generateQuerySDL,
  isObjectTypeDefinitionNode,
  removeQueryType,
} from '../utils';
import { Prisma } from 'generated/prisma';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class QueryService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  buildResolvers = (schemaSDL: string, subgraphId: string): IResolvers => {
    const ast = parse(schemaSDL);
    const resolvers: IResolvers = { Query: {} };

    for (const def of ast.definitions) {
      if (isObjectTypeDefinitionNode(def) && def.name.value !== 'Query') {
        const typeName = def.name.value;
        const plural = typeName.toLowerCase() + 's';
        const singular = typeName.toLowerCase();
        const count = singular + 'Count';
        const byField = singular + 'By';
        const tableName = `${typeName.toLowerCase()}`;

        resolvers.Query[plural] = async (
          _: unknown,
          args: { limit?: number; offset?: number },
        ) => {
          const limit = args.limit ?? 10;
          const offset = args.offset ?? 0;
          const cacheKey = `${subgraphId}:${plural}:limit:${limit}:offset:${offset}`;
          const cached = await this.cacheManager.get<string>(cacheKey);
          if (cached) return JSON.parse(cached) as Record<string, unknown>[];
          const query = Prisma.sql`
                      SELECT * FROM "${Prisma.raw(subgraphId)}"."${Prisma.raw(tableName)}"
                      LIMIT ${limit} OFFSET ${offset}`;

          const result = await this.prisma.$queryRaw(query);

          await this.cacheManager.set(
            cacheKey,
            JSON.stringify(result),
            60 * 1000,
          );

          console.log('cache miss: ', result);
          return result;
        };

        resolvers.Query[singular] = async (
          _: unknown,
          args: { id: number },
        ): Promise<Record<string, unknown> | null> => {
          const cacheKey = `${subgraphId}:${singular}:${args.id}`;
          const cached = await this.cacheManager.get<string>(cacheKey);
          if (cached) return JSON.parse(cached) as Record<string, unknown>;
          const query = Prisma.sql`
                      SELECT * FROM "${Prisma.raw(subgraphId)}"."${Prisma.raw(tableName)}"
                      WHERE id = ${args.id}
                      LIMIT 1`;
          const result: Record<string, unknown>[] =
            await this.prisma.$queryRaw(query);
          const item = result[0] ?? null;
          if (item) {
            await this.cacheManager.set(
              cacheKey,
              JSON.stringify(item),
              60 * 1000,
            );
          }
          return item;
        };

        resolvers.Query[count] = async () => {
          const cacheKey = `${subgraphId}:${singular}:count`;
          const cached = await this.cacheManager.get(cacheKey);
          if (cached) return Number(cached);
          const query = Prisma.sql`SELECT COUNT(*) FROM "${Prisma.raw(subgraphId)}"."${Prisma.raw(tableName)}"`;
          const result: Record<string, unknown>[] =
            await this.prisma.$queryRaw(query);
          await this.cacheManager.set(
            cacheKey,
            String(result[0].count),
            60 * 1000,
          );
          return Number(result[0].count);
        };

        resolvers.Query[byField] = async (
          _: unknown,
          args: { field: string; value: string },
        ): Promise<Record<string, unknown> | null> => {
          const cacheKey = `${subgraphId}:${singular}:${args.field}:${args.value}`;
          const cached = await this.cacheManager.get<string>(cacheKey);
          if (cached) return JSON.parse(cached) as Record<string, unknown>;
          const query = Prisma.sql`
                      SELECT * FROM "${Prisma.raw(subgraphId)}"."${Prisma.raw(tableName)}"
                      WHERE "${Prisma.raw(args.field)}" = ${args.value}
                      LIMIT 1`;
          const result: Record<string, unknown>[] =
            await this.prisma.$queryRaw(query);
          const item = result[0] ?? null;
          if (item) {
            await this.cacheManager.set(
              cacheKey,
              JSON.stringify(item),
              60 * 1000,
            );
          }
          return item;
        };

        resolvers[typeName] = {};
        for (const field of def.fields ?? []) {
          resolvers[typeName][field.name.value] = (
            parent: Record<string, unknown>,
          ): unknown => {
            return parent[field.name.value];
          };
        }
      }
    }

    return resolvers;
  };

  createExecutableSchemaFromPrisma = (subgraphId: string): GraphQLSchema => {
    const filePath = join(
      process.cwd(),
      'src',
      'query',
      subgraphId,
      'schema.graphql',
    );
    const schemaSDL = readFileSync(filePath, 'utf-8');
    const baseSDL = removeQueryType(schemaSDL);
    const typeNames = extractTypeNames(baseSDL);
    const querySDL = generateQuerySDL(typeNames);
    const finalSDL = `${baseSDL}\n\n${querySDL}`;
    const resolvers = this.buildResolvers(finalSDL, subgraphId);

    return makeExecutableSchema({ typeDefs: finalSDL, resolvers });
  };
}
