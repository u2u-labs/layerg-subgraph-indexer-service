import { makeExecutableSchema } from '@graphql-tools/schema';
import { IResolvers } from '@graphql-tools/utils';
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import {
  DefinitionNode,
  GraphQLSchema,
  Kind,
  ObjectTypeDefinitionNode,
  parse,
  print,
  visit,
} from 'graphql';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubgraphsService {
  constructor(private prisma: PrismaService) {}

  isObjectTypeDefinitionNode = (
    node: DefinitionNode,
  ): node is ObjectTypeDefinitionNode => {
    return node.kind === Kind.OBJECT_TYPE_DEFINITION;
  };
  buildResolvers = (schemaSDL: string): IResolvers => {
    const ast = parse(schemaSDL);
    const resolvers: IResolvers = { Query: {} };

    for (const def of ast.definitions) {
      if (this.isObjectTypeDefinitionNode(def) && def.name.value !== 'Query') {
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
          return await this.prisma.$queryRawUnsafe(
            `SELECT * FROM "public"."${tableName}" LIMIT ${limit} OFFSET ${offset}`,
          );
        };

        resolvers.Query[singular] = async (
          _: unknown,
          args: { id: number },
        ): Promise<Record<string, unknown> | null> => {
          const result: Record<string, unknown>[] =
            await this.prisma.$queryRawUnsafe(
              `SELECT * FROM "public"."${tableName}" WHERE id = ${args.id} LIMIT 1`,
            );
          return result[0] ?? null;
        };

        resolvers.Query[count] = async () => {
          const result: Record<string, unknown>[] =
            await this.prisma.$queryRawUnsafe(
              `SELECT COUNT(*) FROM "public"."${tableName}"`,
            );
          return Number(result[0].count);
        };

        resolvers.Query[byField] = async (
          _: unknown,
          args: { field: string; value: string },
        ): Promise<Record<string, unknown> | null> => {
          const result: Record<string, unknown>[] =
            await this.prisma.$queryRawUnsafe(
              `SELECT * FROM "public"."${tableName}" WHERE "${args.field}" = '${args.value}' LIMIT 1`,
            );
          return result[0] ?? null;
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
  getExecutableSchema = (name: string): GraphQLSchema => {
    const filePath = join(
      process.cwd(),
      'src',
      'subgraphs',
      name,
      'schema.graphql',
    );
    const schemaSDL = readFileSync(filePath, 'utf-8');
    return this.createExecutableSchemaFromPrisma(schemaSDL);
  };

  removeQueryType = (sdl: string): string => {
    const ast = parse(sdl);
    const filtered = visit(ast, {
      ObjectTypeDefinition(node) {
        return node.name.value === 'Query' ? null : node;
      },
    });
    return print(filtered);
  };

  extractTypeNames = (sdl: string): string[] => {
    const ast = parse(sdl);
    const typeNames: string[] = [];
    for (const def of ast.definitions) {
      if (this.isObjectTypeDefinitionNode(def) && def.name.value !== 'Query') {
        typeNames.push(def.name.value);
      }
    }
    return typeNames;
  };

  generateQuerySDL = (typeNames: string[]): string => {
    return `
    type Query {
      ${typeNames
        .map(
          (name) => `
        ${name.toLowerCase()}s(limit: Int = 10, offset: Int = 0): [${name}!]!
        ${name.toLowerCase()}(id: Int!): ${name}
        ${name.toLowerCase()}Count: Int!
        ${name.toLowerCase()}By(field: String!, value: String!): ${name}`,
        )
        .join('\n')}
    }
  `;
  };

  createExecutableSchemaFromPrisma = (name: string): GraphQLSchema => {
    const filePath = join(
      process.cwd(),
      'src',
      'subgraphs',
      name,
      'schema.graphql',
    );
    const schemaSDL = readFileSync(filePath, 'utf-8');
    const baseSDL = this.removeQueryType(schemaSDL);
    const typeNames = this.extractTypeNames(baseSDL);
    const querySDL = this.generateQuerySDL(typeNames);
    const finalSDL = `${baseSDL}\n\n${querySDL}`;
    const resolvers = this.buildResolvers(finalSDL);

    return makeExecutableSchema({ typeDefs: finalSDL, resolvers });
  };
}
