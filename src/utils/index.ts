import {
  DefinitionNode,
  Kind,
  ObjectTypeDefinitionNode,
  parse,
  print,
  visit,
} from 'graphql';

export const isObjectTypeDefinitionNode = (
  node: DefinitionNode,
): node is ObjectTypeDefinitionNode => {
  return node.kind === Kind.OBJECT_TYPE_DEFINITION;
};

export const removeQueryType = (sdl: string): string => {
  const ast = parse(sdl);
  const filtered = visit(ast, {
    ObjectTypeDefinition(node) {
      return node.name.value === 'Query' ? null : node;
    },
  });
  return print(filtered);
};

export const extractTypeNames = (sdl: string): string[] => {
  const ast = parse(sdl);
  const typeNames: string[] = [];
  for (const def of ast.definitions) {
    if (isObjectTypeDefinitionNode(def) && def.name.value !== 'Query') {
      typeNames.push(def.name.value);
    }
  }
  return typeNames;
};

export const generateQuerySDL = (typeNames: string[]): string => {
  return `
    scalar JSON

    input WhereInput {
      ${['value', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte'].map((op) => `String_${op}: [String!]`).join('\n    ')}
    }

    type Query {
      ${typeNames
        .map(
          (name) => `
        ${name.toLowerCase()}s(
          limit: Int = 10,
          offset: Int = 0,
          orderBy: String,
          order: String = "asc",
          where: JSON
        ): [${name}!]!
        ${name.toLowerCase()}(id: Int!): ${name}
        ${name.toLowerCase()}Count: Int!
        ${name.toLowerCase()}Get(field: String!, value: String!): [${name}!]!`,
        )
        .join('\n')}
    }
  `;
};
