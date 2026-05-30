/**
 * supabase/functions/_shared/symbol-extractor.ts
 *
 * Deterministic symbol extraction for Graph v2.
 * Used during ingestion to populate symbol_references and during retrieval.
 */

export type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "rust"
  | string;

const STOPLISTS: Record<string, Set<string>> = {
  typescript: new Set([
    "then",
    "catch",
    "map",
    "filter",
    "reduce",
    "Object",
    "String",
    "Number",
    "Promise",
    "console",
    "log",
  ]),
  javascript: new Set([
    "then",
    "catch",
    "map",
    "filter",
    "reduce",
    "Object",
    "String",
    "Number",
    "Promise",
    "console",
    "log",
  ]),
  go: new Set(["fmt", "context", "error", "err", "len", "make", "new"]),
  python: new Set([
    "self",
    "cls",
    "len",
    "dict",
    "list",
    "str",
    "int",
    "print",
  ]),
  java: new Set([
    "String",
    "Object",
    "List",
    "Map",
    "Optional",
    "System",
    "out",
    "println",
  ]),
  rust: new Set(["Result", "Option", "unwrap", "expect", "println"]),
  common: new Set([
    "if",
    "else",
    "for",
    "while",
    "return",
    "class",
    "function",
    "const",
    "let",
    "var",
    "import",
    "export",
    "from",
    "as",
    "default",
    "async",
    "await",
    "try",
    "catch",
    "throw",
    "new",
    "this",
    "super",
    "extends",
    "implements",
    "interface",
    "type",
    "enum",
    "public",
    "private",
    "protected",
    "static",
    "readonly",
    "string",
    "number",
    "boolean",
    "any",
    "void",
    "null",
    "undefined",
    "true",
    "false",
    "item",
    "data",
    "id",
    "name",
    "uuid",
    "text",
    "content",
  ]),
};

export function isStopSymbol(
  sym: string,
  languageHint?: SupportedLanguage,
): boolean {
  const s = sym.toLowerCase();
  if (STOPLISTS.common.has(s)) return true;

  if (languageHint) {
    const lang = languageHint.toLowerCase();
    if (STOPLISTS[lang]?.has(sym)) return true;
    if (STOPLISTS[lang]?.has(s)) return true;
  }

  return false;
}

/**
 * Normalizes symbols by stripping generics and handling qualified names.
 */
export function normalizeSymbols(
  rawSymbols: string[],
  languageHint?: SupportedLanguage,
): string[] {
  const result = new Set<string>();
  const lang = languageHint?.toLowerCase();

  for (const raw of rawSymbols) {
    // 1. Strip generics like Foo<Bar> or Foo[Bar]
    let sym = raw.split(/[<\[\(]/)[0].trim();

    if (!sym || sym.length < 3 || sym.length > 100) continue; // Length bounds

    // 2. Language-specific segmenting
    if (lang === "rust") {
      if (sym.includes("::")) {
        result.add(sym);
        sym.split("::").forEach((part) => {
          if (part.length >= 3) result.add(part);
        });
        continue;
      }
    } else if (lang === "java" || lang === "python") {
      const parts = sym.split(".");
      if (parts.length > 2) {
        const lastTwo = parts.slice(-2);
        const qualified = lastTwo.join(".");
        result.add(qualified);
        lastTwo.forEach((part) => {
          if (part.length >= 3) result.add(part);
        });
        continue;
      } else if (parts.length === 2) {
        result.add(sym);
        parts.forEach((part) => {
          if (part.length >= 3) result.add(part);
        });
        continue;
      }
    } else {
      if (sym.includes(".")) {
        result.add(sym);
        sym.split(".").forEach((part) => {
          if (part.length >= 3) result.add(part);
        });
        continue;
      }
    }

    result.add(sym);
  }

  return Array.from(result).filter((s) =>
    !isStopSymbol(s, languageHint) && s.length >= 3
  );
}

/**
 * Extracts identifiers from text using language-aware regex.
 */
export function extractSymbols(
  text: string,
  languageHint?: SupportedLanguage,
  maxSymbols = 50,
): string[] {
  if (!text) return [];

  const lang = languageHint?.toLowerCase();
  let regex: RegExp;

  if (lang === "rust") {
    regex = /\b[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*\b/g;
  } else {
    regex = /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b/g;
  }

  const rawSymbols: string[] = [];
  const matches = text.matchAll(regex);
  for (const m of matches) {
    rawSymbols.push(m[0]);
  }

  const normalized = normalizeSymbols(rawSymbols, languageHint);

  // Return capped results
  return normalized.slice(0, maxSymbols);
}
