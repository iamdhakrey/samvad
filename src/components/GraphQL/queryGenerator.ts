import {
  GraphQlArg,
  GraphQlSchema,
  GraphQlSchemaField,
  GraphQlTypeRef,
} from "../../types";

const BUILTIN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

/**
 * Format a type reference into standard GraphQL syntax (e.g. `[Country!]!`).
 */
export function formatTypeRef(ref: GraphQlTypeRef | undefined | null): string {
  if (!ref) return "Unknown";
  if (ref.kind === "NON_NULL") return `${formatTypeRef(ref.ofType)}!`;
  if (ref.kind === "LIST") return `[${formatTypeRef(ref.ofType)}]`;
  return ref.name ?? "Unknown";
}

/**
 * Unwrap NON_NULL and LIST to get the bare named type (e.g. `Country`).
 */
export function getNamedTypeName(ref: GraphQlTypeRef | undefined | null): string {
  if (!ref) return "";
  if (ref.ofType) return getNamedTypeName(ref.ofType);
  return ref.name ?? "";
}

/**
 * Convert string to PascalCase for operation naming (e.g. `get_user` -> `GetUser`).
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, "");
}

/**
 * Check if a named type is a scalar or enum.
 */
function isScalarOrEnum(typeName: string, schema?: GraphQlSchema | null): boolean {
  if (BUILTIN_SCALARS.has(typeName)) return true;
  if (!schema) return false;
  const found = schema.types.find((t) => t.name === typeName);
  return found?.kind === "SCALAR" || found?.kind === "ENUM";
}

/**
 * Recursively generate selection set for an object type up to maxDepth.
 */
function generateSelectionSet(
  typeName: string,
  schema: GraphQlSchema | null,
  indent: string = "    ",
  depth: number = 0,
  maxDepth: number = 2
): string {
  if (depth >= maxDepth || !schema) return "";

  const type = schema.types.find((t) => t.name === typeName);
  if (!type || type.fields.length === 0) return "";

  const scalarLines: string[] = [];
  const objectFields: { name: string; targetTypeName: string }[] = [];

  for (const field of type.fields) {
    if (field.isDeprecated) continue;
    const targetType = getNamedTypeName(field.typeRef);

    if (isScalarOrEnum(targetType, schema)) {
      scalarLines.push(`${indent}${field.name}`);
    } else if (depth + 1 < maxDepth && objectFields.length < 2) {
      objectFields.push({ name: field.name, targetTypeName: targetType });
    }

    // Don't overwhelm: pick max 6 scalar fields
    if (scalarLines.length >= 6) break;
  }

  // If no scalars found, try the first object field
  if (scalarLines.length === 0 && objectFields.length > 0) {
    const first = objectFields[0];
    const subSelection = generateSelectionSet(
      first.targetTypeName,
      schema,
      `${indent}  `,
      depth + 1,
      maxDepth
    );
    if (subSelection) {
      return `{\n${indent}${first.name} ${subSelection}\n${indent.slice(2)}}`;
    }
  }

  if (scalarLines.length === 0) {
    // fallback if everything is complex or empty
    const firstField = type.fields[0];
    if (firstField) {
      return `{\n${indent}${firstField.name}\n${indent.slice(2)}}`;
    }
    return "";
  }

  return `{\n${scalarLines.join("\n")}\n${indent.slice(2)}}`;
}

/**
 * Generate default variable value for an argument.
 */
function getDefaultVariableValue(arg: GraphQlArg): any {
  const typeName = getNamedTypeName(arg.typeRef);
  const isList = arg.typeRef.kind === "LIST" || arg.typeRef.ofType?.kind === "LIST";

  if (isList) return [];
  switch (typeName) {
    case "Int":
      return 1;
    case "Float":
      return 1.0;
    case "Boolean":
      return true;
    case "ID":
    case "String":
      return "";
    default:
      return {};
  }
}

export interface GeneratedOperation {
  query: string;
  variables: string;
  operationName: string;
  operationType: "query" | "mutation" | "subscription";
}

/**
 * Generate a complete, ready-to-execute GraphQL query/mutation/subscription
 * with variable declarations, argument mappings, and selection sets.
 */
export function generateOperation(
  field: GraphQlSchemaField,
  operationType: "query" | "mutation" | "subscription",
  schema: GraphQlSchema | null
): GeneratedOperation {
  const opPrefix =
    operationType === "mutation"
      ? "Mutate"
      : operationType === "subscription"
      ? "On"
      : "Get";
  const operationName = `${opPrefix}${toPascalCase(field.name)}`;

  const hasArgs = field.args.length > 0;
  const variableDeclarations: string[] = [];
  const fieldArgMappings: string[] = [];
  const variablesObj: Record<string, any> = {};

  if (hasArgs) {
    for (const arg of field.args) {
      const varName = arg.name;
      const typeStr = formatTypeRef(arg.typeRef);
      variableDeclarations.push(`$${varName}: ${typeStr}`);
      fieldArgMappings.push(`${arg.name}: $${varName}`);
      variablesObj[varName] = getDefaultVariableValue(arg);
    }
  }

  const varHeader =
    variableDeclarations.length > 0 ? `(${variableDeclarations.join(", ")})` : "";
  const fieldArgs =
    fieldArgMappings.length > 0 ? `(${fieldArgMappings.join(", ")})` : "";

  const returnTypeName = getNamedTypeName(field.typeRef);
  const isReturnScalar = isScalarOrEnum(returnTypeName, schema);

  let selectionSet = "";
  if (!isReturnScalar) {
    selectionSet = " " + generateSelectionSet(returnTypeName, schema, "    ", 0, 2);
  }

  const query = `${operationType} ${operationName}${varHeader} {\n  ${field.name}${fieldArgs}${selectionSet}\n}\n`;
  const variables =
    Object.keys(variablesObj).length > 0
      ? JSON.stringify(variablesObj, null, 2)
      : "";

  return {
    query,
    variables,
    operationName,
    operationType,
  };
}

export interface ParsedDocOperation {
  type: "query" | "mutation" | "subscription";
  name: string;
}

/**
 * Parses all named operations (query/mutation/subscription) from a GraphQL document.
 */
export function parseDocumentOperations(queryText: string): ParsedDocOperation[] {
  if (!queryText) return [];
  const regex = /(?:^|\s)(query|mutation|subscription)\s+([A-Za-z0-9_]+)/g;
  const ops: ParsedDocOperation[] = [];
  let match;
  while ((match = regex.exec(queryText)) !== null) {
    ops.push({
      type: match[1] as any,
      name: match[2],
    });
  }
  return ops;
}
