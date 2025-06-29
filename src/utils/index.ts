/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
          first: Int = 10,
          skip: Int = 0,
          orderBy: String,
          orderDirection: String = "asc",
          where: ${name}WhereInput 
        ): [${name}!]!
        ${name.toLowerCase()}(id: Int!): ${name}
        ${name.toLowerCase()}Count: Int!`,
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

export const buildWhereClauses = (where: Record<string, any>) => {
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
      whereClauses.push(`"${key}" = '${val}'`);
    }
  }
  return whereClauses;
};

export const getScalarType = (type: any): string => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  if (type.kind === 'NamedType') return type.name.value;
  if (type.kind === 'NonNullType') return getScalarType(type.type);
  return 'String';
};

export const isScalarField = (type: string): boolean => {
  return ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(type);
};

export const generateWhereInputs = (
  types: ObjectTypeDefinitionNode[],
): string => {
  const typeMap = new Map(types.map((t) => [t.name.value, t]));

  return types
    .map((type) => {
      const typeName = type.name.value;
      const fields = type.fields ?? [];

      const filters = fields
        .map((field) => {
          const name = field.name.value;
          const fieldType = getScalarType(field.type);

          if (isScalarField(fieldType)) {
            return [
              `${name}: ${fieldType}`,
              `${name}_in: [${fieldType}!]`,
              `${name}_not_in: [${fieldType}!]`,
              `${name}_gt: ${fieldType}`,
              `${name}_gte: ${fieldType}`,
              `${name}_lt: ${fieldType}`,
              `${name}_lte: ${fieldType}`,
            ].join('\n');
          } else if (typeMap.has(fieldType)) {
            // relation field
            return `${name}: ${fieldType}WhereInput`;
          }

          return '';
        })
        .filter(Boolean)
        .join('\n');

      return `input ${typeName}WhereInput {\n${filters}\n}`;
    })
    .join('\n\n');
};

export const extractObjectTypes = (sdl: string): ObjectTypeDefinitionNode[] => {
  const ast = parse(sdl);
  return ast.definitions.filter(isObjectTypeDefinitionNode);
};
