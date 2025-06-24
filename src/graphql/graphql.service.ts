/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { makeExecutableSchema } from '@graphql-tools/schema';
import { IResolvers } from '@graphql-tools/utils';
import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphQLSchema, ObjectTypeDefinitionNode, parse } from 'graphql';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import GraphQLJSON from 'graphql-type-json';

import { PrismaService } from '../prisma/prisma.service';
import {
  buildWhereClauses,
  extractObjectTypes,
  extractTypeNames,
  generateQuerySDL,
  generateWhereInputs,
  getRelationType,
  isObjectTypeDefinitionNode,
  removeQueryType,
} from '../utils';

import { Prisma } from 'generated/prisma';

@Injectable()
export class GraphqlService {
  private readonly cacheExpireIn = 60 * 1000; // 1 minute

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
    const resolvers: IResolvers = { Query: {}, JSON: GraphQLJSON };
    const typeMap: Record<string, ObjectTypeDefinitionNode> = {};

    // First pass: populate typeMap
    for (const def of ast.definitions) {
      if (isObjectTypeDefinitionNode(def)) {
        typeMap[def.name.value] = def;
      }
    }

    // Second pass: generate resolvers
    for (const def of ast.definitions) {
      if (!isObjectTypeDefinitionNode(def) || def.name.value === 'Query')
        continue;

      const typeName = def.name.value;
      const many = typeName.toLowerCase() + 's';
      const single = typeName.toLowerCase();
      const count = single + 'Count';
      const tableName = `"${subgraphId}"."${typeName.toLowerCase()}_${chainId}"`;

      resolvers.Query[many] = this.buildManyResolver(
        tableName,
        subgraphId,
        many,
        chainId,
      );
      resolvers.Query[single] = this.buildSingleResolver(
        tableName,
        subgraphId,
        single,
        chainId,
      );
      resolvers.Query[count] = this.buildCountResolver(
        tableName,
        subgraphId,
        single,
        chainId,
      );

      resolvers[typeName] = this.buildFieldResolvers(
        def,
        typeMap,
        subgraphId,
        chainId,
      );
    }

    return resolvers;
  };

  private buildManyResolver(
    tableName: string,
    subgraphId: string,
    plural: string,
    chainId: number,
  ) {
    return async (
      _: unknown,
      args: {
        first?: number;
        skip?: number;
        orderBy?: string;
        orderDirection?: string;
        where?: Record<string, unknown>;
      },
    ) => {
      const {
        first = 10,
        skip = 0,
        orderBy,
        orderDirection,
        where = {},
      } = args;
      const orderClause = orderBy
        ? `ORDER BY "${orderBy}" ${orderDirection?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`
        : '';
      const whereClauses = buildWhereClauses(where);
      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const cacheKey = `${subgraphId}_${plural}_${chainId}:limit:${first}:offset:${skip}:orderBy:${orderBy ?? 'none'}:orderDirection:${orderDirection}:where:${JSON.stringify(where)}`;
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached) return JSON.parse(cached) as Record<string, unknown>[];

      const query = `SELECT * FROM ${tableName} ${whereClause} ${orderClause} LIMIT ${first} OFFSET ${skip}`;
      const result = await this.prisma.$queryRawUnsafe(query);
      await this.cacheManager.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheExpireIn,
      );
      return result;
    };
  }

  private buildSingleResolver(
    tableName: string,
    subgraphId: string,
    singular: string,
    chainId: number,
  ) {
    return async (_: unknown, args: { id: number }) => {
      const cacheKey = `${subgraphId}_${chainId}:${singular}:${args.id}`;
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached) return JSON.parse(cached) as Record<string, unknown>;

      const query = Prisma.sql`SELECT * FROM ${tableName} WHERE id = ${args.id} LIMIT 1`;
      const result: Record<string, unknown>[] =
        await this.prisma.$queryRaw(query);
      const item = result[0] ?? null;

      if (item)
        await this.cacheManager.set(
          cacheKey,
          JSON.stringify(item),
          this.cacheExpireIn,
        );
      return item;
    };
  }

  private buildCountResolver(
    tableName: string,
    subgraphId: string,
    singular: string,
    chainId: number,
  ) {
    return async () => {
      const cacheKey = `${subgraphId}_${chainId}:${singular}:count`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return Number(cached);

      const query = Prisma.sql`SELECT COUNT(*) FROM ${tableName}`;
      const result: Record<string, unknown>[] =
        await this.prisma.$queryRaw(query);
      const count = Number(result[0]?.count);

      await this.cacheManager.set(cacheKey, String(count), this.cacheExpireIn);
      return count;
    };
  }

  private buildFieldResolvers(
    def: ObjectTypeDefinitionNode,
    typeMap: Record<string, ObjectTypeDefinitionNode>,
    subgraphId: string,
    chainId: number,
  ): IResolvers {
    const resolvers: IResolvers = {};

    for (const field of def.fields ?? []) {
      const fieldName = field.name.value;
      const relationType = getRelationType(field);

      if (
        relationType &&
        relationType !== def.name.value &&
        typeMap[relationType]
      ) {
        const relatedTable = `"${subgraphId}"."${relationType.toLowerCase()}_${chainId}"`;
        resolvers[fieldName] = async (parent: Record<string, unknown>) => {
          const key =
            parent[`${fieldName}Id`] ??
            parent[`${fieldName}_id`] ??
            (typeof parent[fieldName] === 'string' ||
            typeof parent[fieldName] === 'number'
              ? parent[fieldName]
              : undefined);

          if (typeof key === 'undefined') return null;

          const query =
            typeof key === 'number'
              ? `SELECT * FROM ${relatedTable} WHERE id = ${key} LIMIT 1`
              : // eslint-disable-next-line @typescript-eslint/no-base-to-string
                `SELECT * FROM ${relatedTable} WHERE id = '${key}' LIMIT 1`;

          const result: any[] = await this.prisma.$queryRawUnsafe(query);
          return result?.[0] ?? null;
        };
      } else {
        resolvers[fieldName] = (parent: Record<string, unknown>) =>
          parent[fieldName];
      }
    }

    return resolvers;
  }

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
    const objectTypes = extractObjectTypes(baseSDL);
    const whereInputs = generateWhereInputs(objectTypes);
    const finalSDL = `${baseSDL}\n\n${whereInputs}\n\n${querySDL}`;

    const resolvers = this.buildResolvers(finalSDL, subgraphId, chainId);
    return makeExecutableSchema({ typeDefs: finalSDL, resolvers });
  };
}
