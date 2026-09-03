import type { Monaco } from "@monaco-editor/react";
import { GraphQlSchema, GraphQlSchemaType } from "../../types";
import { formatTypeRef } from "./queryGenerator";

/**
 * Registers an intelligent, schema-aware completion item provider for GraphQL in Monaco.
 * Provides auto-suggestions for root operations, queries, mutations, subscriptions, fields,
 * and arguments based on the introspected schema.
 */
export function registerGraphQlCompletionProvider(
  monaco: Monaco,
  schema: GraphQlSchema | null
) {
  if (!monaco?.languages || !schema) {
    return { dispose: () => {} };
  }

  const queryType = schema.types.find((t) => t.name === schema.queryType);
  const mutationType = schema.types.find((t) => t.name === schema.mutationType);
  const subscriptionType = schema.types.find((t) => t.name === schema.subscriptionType);

  const disposable = monaco.languages.registerCompletionItemProvider("graphql", {
    triggerCharacters: [" ", "{", "(", "\n", ":", "$"],
    provideCompletionItems: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: any[] = [];

      // 1. Top-level operation keywords & full templates
      const isTopLevel = !textUntilPosition.includes("{") || textUntilPosition.trim().length === 0;

      if (isTopLevel) {
        if (queryType && queryType.fields.length > 0) {
          suggestions.push({
            label: "query",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "query ${1:MyQuery} {\n  $0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "GraphQL Query Operation",
            documentation: "Define a read-only fetch operation",
            range,
          });
        }

        if (mutationType && mutationType.fields.length > 0) {
          suggestions.push({
            label: "mutation",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "mutation ${1:MyMutation} {\n  $0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "GraphQL Mutation Operation",
            documentation: "Define a write/mutation operation",
            range,
          });
        }

        if (subscriptionType && subscriptionType.fields.length > 0) {
          suggestions.push({
            label: "subscription",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "subscription ${1:MySubscription} {\n  $0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "GraphQL Subscription Operation",
            documentation: "Define a live real-time subscription",
            range,
          });
        }
      }

      // 2. Suggest root fields based on detected operation context
      const isInMutation = /mutation\s*[\w\s$():]*\{[^}]*$/.test(textUntilPosition);
      const isInSubscription = /subscription\s*[\w\s$():]*\{[^}]*$/.test(textUntilPosition);

      let targetType: GraphQlSchemaType | undefined = queryType;

      if (isInMutation && mutationType) {
        targetType = mutationType;
      } else if (isInSubscription && subscriptionType) {
        targetType = subscriptionType;
      }

      if (targetType) {
        for (const field of targetType.fields) {
          const typeStr = formatTypeRef(field.typeRef);

          // Full snippet insertion
          suggestions.push({
            label: field.name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: field.name + (field.args.length > 0 ? "(${1:args})" : ""),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `: ${typeStr}`,
            documentation: {
              value: [
                `**${field.name}**: \`${typeStr}\``,
                field.description || "",
                field.args.length > 0
                  ? `\n**Arguments:**\n${field.args
                      .map((a) => `- \`${a.name}\`: \`${formatTypeRef(a.typeRef)}\``)
                      .join("\n")}`
                  : "",
                field.isDeprecated ? `\n⚠️ *Deprecated: ${field.deprecationReason || "No reason specified"}*` : "",
              ].join("\n\n"),
            },
            range,
          });
        }
      }

      // 3. Suggest all schema types (for fragments, variable types, etc.)
      for (const t of schema.types) {
        suggestions.push({
          label: t.name,
          kind:
            t.kind === "ENUM"
              ? monaco.languages.CompletionItemKind.Enum
              : t.kind === "SCALAR"
              ? monaco.languages.CompletionItemKind.TypeParameter
              : monaco.languages.CompletionItemKind.Class,
          insertText: t.name,
          detail: `[${t.kind}] ${t.description || ""}`,
          range,
        });
      }

      return { suggestions };
    },
  });

  return disposable;
}
