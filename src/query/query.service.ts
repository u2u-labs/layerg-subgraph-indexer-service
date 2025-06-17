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
import GraphQLJSON from 'graphql-type-json';

@Injectable()
export class QueryService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  buildResolvers = (
    schemaSDL: string,
    subgraphId: string,
    chainId: number,
  ): IResolvers => {
    const ast = parse(schemaSDL);
    const resolvers: IResolvers = {
      Query: {},
    };

    for (const def of ast.definitions) {
      if (isObjectTypeDefinitionNode(def) && def.name.value !== 'Query') {
        const typeName = def.name.value;
        const plural = typeName.toLowerCase() + 's';
        const singular = typeName.toLowerCase();
        const count = singular + 'Count';
        const tableName = `${typeName.toLowerCase()}`;

        resolvers.Query[plural] = async (
          _: unknown,
          args: {
            limit?: number;
            offset?: number;
            orderBy?: string;
            order?: string;
            where?: Record<string, any>;
          },
        ) => {
          const { limit = 10, offset = 0, orderBy, order, where = {} } = args;
          const orderClause = orderBy
            ? `ORDER BY "${orderBy}" ${order?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`
            : '';

          const whereClauses: string[] = [];
          for (const [key, val] of Object.entries(where)) {
            if (key.endsWith('_not_in') && Array.isArray(val)) {
              const field = key.replace(/_not_in$/, '');
              const formatted = val
                .map((v) => (typeof v === 'number' ? v : `'${v}'`))
                .join(', ');
              whereClauses.push(`"${field}" NOT IN (${formatted})`);
            } else if (key.endsWith('_in') && Array.isArray(val)) {
              const field = key.replace(/_in$/, '');
              const formatted = val
                .map((v) => (typeof v === 'number' ? v : `'${v}'`))
                .join(', ');
              whereClauses.push(`"${field}" IN (${formatted})`);
            } else if (key.endsWith('_gt')) {
              const field = key.replace(/_gt$/, '');
              whereClauses.push(
                `"${field}" > ${typeof val === 'number' ? val : `'${val}'`}`,
              );
            } else if (key.endsWith('_gte')) {
              const field = key.replace(/_gte$/, '');
              whereClauses.push(
                `"${field}" >= ${typeof val === 'number' ? val : `'${val}'`}`,
              );
            } else if (key.endsWith('_lt')) {
              const field = key.replace(/_lt$/, '');
              whereClauses.push(
                `"${field}" < ${typeof val === 'number' ? val : `'${val}'`}`,
              );
            } else if (key.endsWith('_lte')) {
              const field = key.replace(/_lte$/, '');
              whereClauses.push(
                `"${field}" <= ${typeof val === 'number' ? val : `'${val}'`}`,
              );
            } else if (typeof val === 'string') {
              whereClauses.push(`"${key}" ILIKE '%${val}%'`);
            }
          }

          const whereClause =
            whereClauses.length > 0
              ? `WHERE ${whereClauses.join(' AND ')}`
              : '';

          const cacheKey = `${subgraphId}_${plural}_${chainId}:limit:${limit}:offset:${offset}:orderBy:${orderBy ?? 'none'}:order:${order}:where:${JSON.stringify(where)}`;
          const cached = await this.cacheManager.get<string>(cacheKey);
          if (cached) return JSON.parse(cached) as Record<string, unknown>[];

          const query = `SELECT * FROM "${subgraphId}"."${tableName}_${chainId}" ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
          const result = await this.prisma.$queryRawUnsafe(query);
          await this.cacheManager.set(
            cacheKey,
            JSON.stringify(result),
            60 * 1000,
          );
          return result;
        };

        resolvers.Query[singular] = async (
          _: unknown,
          args: { id: number },
        ): Promise<Record<string, unknown> | null> => {
          const cacheKey = `${subgraphId}_${chainId}:${singular}:${args.id}`;
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
          const cacheKey = `${subgraphId}_${chainId}:${singular}:count`;
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

    resolvers.JSON = GraphQLJSON;
    return resolvers;
  };

  createExecutableSchemaFromPrisma = (
    subgraphId: string,
    chainId: number,
  ): GraphQLSchema => {
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
    const resolvers = this.buildResolvers(finalSDL, subgraphId, chainId);

    return makeExecutableSchema({ typeDefs: finalSDL, resolvers });
  };
}
