import {
  DefinitionNode,
  FieldDefinitionNode,
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
      ${['value', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte'].map((op) => `String_${op}: [String!]`).join('\n      ')}
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

export const getRelationType = (field: FieldDefinitionNode): string | null => {
  const type = field.type;
  if (type.kind === Kind.NAMED_TYPE) return type.name.value;
  if (type.kind === Kind.NON_NULL_TYPE && type.type.kind === Kind.NAMED_TYPE)
    return type.type.name.value;
  if (type.kind === Kind.LIST_TYPE && type.type.kind === Kind.NAMED_TYPE)
    return type.type.name.value;
  if (
    type.kind === Kind.NON_NULL_TYPE &&
    type.type.kind === Kind.LIST_TYPE &&
    type.type.type.kind === Kind.NAMED_TYPE
  )
    return type.type.type.name.value;
  return null;
};
