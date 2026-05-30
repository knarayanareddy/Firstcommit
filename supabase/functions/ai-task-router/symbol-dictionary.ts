/**
 * supabase/functions/ai-task-router/symbol-dictionary.ts
 *
 * v1 Symbol Extraction Dictionary to improve detective retrieval accuracy.
 * Handles language-specific normalization, qualified names, and stoplists.
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
    "type",
    "uuid",
    "text",
    "content",
  ]),
};

/**
 * Detects if a symbol is a language-specific or common stopword.
 */
export function isStopSymbol(
  sym: string,
  languageHint?: SupportedLanguage,
): boolean {
  const s = sym.toLowerCase();
  if (STOPLISTS.common.has(s)) return true;

  if (languageHint) {
    const lang = languageHint.toLowerCase();
    if (STOPLISTS[lang]?.has(sym)) return true; // Note: language specific ones might be case sensitive (e.g. String vs string)
    if (STOPLISTS[lang]?.has(s)) return true;
  }

  return false;
}

/**
 * Strips generics, type parameters, and handles qualified names.
 */
export function normalizeCandidateSymbols(
  rawSymbols: string[],
  languageHint?: SupportedLanguage,
): string[] {
  const result = new Set<string>();
  const lang = languageHint?.toLowerCase();

  for (const raw of rawSymbols) {
    // 1. Strip generics like Foo<Bar> or Foo[Bar] (Python)
    let sym = raw.split(/[<\[\(]/)[0].trim();

    if (!sym || sym.length < 3) continue;

    // 2. Language-specific splitting and segmenting
    if (lang === "rust") {
      // Handle Foo::bar -> [Foo::bar, Foo, bar]
      if (sym.includes("::")) {
        result.add(sym);
        sym.split("::").forEach((part) => {
          if (part.length >= 3) result.add(part);
        });
        continue;
      }
    } else if (lang === "java" || lang === "python") {
      // Java: com.pkg.Class.method -> Class.method, Class, method (last 2 segments)
      // Python: pkg.mod.func -> mod.func, func (last 2 segments)
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
      // Default / TS / Go logic: Foo.bar -> [Foo.bar, Foo, bar]
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

  // Filter stop symbols and small stuff
  return Array.from(result).filter((s) =>
    !isStopSymbol(s, languageHint) && s.length >= 3
  );
}

/**
 * Improved deterministic extraction from text.
 */
export function extractQualifiedSymbolsFromText(
  text: string,
  languageHint?: SupportedLanguage,
): string[] {
  const rawSymbols: string[] = [];
  const lang = languageHint?.toLowerCase();

  // Pick regex based on language common separators
  let regex: RegExp;
  if (lang === "rust") {
    // Rust uses :: as primary separator
    regex = /\b[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*\b/g;
  } else {
    // Most others use .
    regex = /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b/g;
  }

  const matches = text.matchAll(regex);
  for (const m of matches) {
    rawSymbols.push(m[0]);
  }

  // Also include "function calls" and "type definitions" specifically if not caught
  // (regex above catches Foo.bar() as Foo.bar)

  return normalizeCandidateSymbols(rawSymbols, languageHint);
}
