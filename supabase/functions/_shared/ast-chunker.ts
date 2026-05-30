const AST_CHUNKING_ENABLED = Deno.env.get("ENABLE_AST_CHUNKING") !== "false";

let Parser: any = null;
let sharedParser: any = null;
let parserLoadAttempted = false;

const WASM_SHA256: Record<string, string> = {
  typescript:
    "8515404dceed38e1ed86aa34b09fcf3379fff1b4ff9dd3967bcd6d1eb5ac3d8f",
  python: "9056d0fb0c337810d019fae350e8167786119da98f0f282aceae7ab89ee8253b",
  go: "9963ca89b616eaf04b08a43bc1fb0f07b85395bec313330851f1f1ead2f755b6",
  rust: "4409921a70d0aa5bec7d1d7ce809a557a8ee1cf6ace901e3ac6a76e62cfea903",
  java: "637aac4415fb39a211a4f4292d63c66b5ce9c32fa2cd35464af4f681d91b9a1f",
  javascript:
    "1c99d4b953d2543bd6b934eb7206118fb732b473cd725ba04f258163b2bd3253",
};

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

let isParserInitialized = false;
const languageCache = new Map<string, any>();

export interface ChunkMetadata {
  entity_type: string;
  entity_name: string;
  signature: string;
  line_start: number;
  line_end: number;
  parent_id?: string;
  content_hash?: string;
  imports?: string[];
  exported_names?: string[];
}

export interface ASTChunk {
  text: string;
  metadata: ChunkMetadata;
}

function fallbackTextChunks(code: string, filepath: string): ASTChunk[] {
  const lines = code.split("\n");
  const results: ASTChunk[] = [];

  for (let i = 0; i < lines.length; i += 100) {
    const end = Math.min(i + 100, lines.length);
    results.push({
      text: lines.slice(i, end).join("\n"),
      metadata: {
        entity_type: "text_chunk",
        entity_name: filepath,
        signature: filepath,
        line_start: i + 1,
        line_end: end,
      },
    });
  }

  return results;
}

async function ensureParserLoaded() {
  if (!AST_CHUNKING_ENABLED) return null;
  if (Parser || parserLoadAttempted) return Parser;

  parserLoadAttempted = true;

  try {
    if (typeof (globalThis as any).document === "undefined") {
      (globalThis as any).document = { currentScript: { src: "" } };
    } else if (
      typeof (globalThis as any).document.currentScript === "undefined"
    ) {
      (globalThis as any).document.currentScript = { src: "" };
    }

    const mod = await import("https://esm.sh/web-tree-sitter@0.20.8");
    Parser = mod.default;
  } catch (e) {
    console.warn(
      "[ast-chunker] web-tree-sitter unavailable, falling back to text chunking:",
      (e as Error).message,
    );
    Parser = null;
  }

  return Parser;
}

async function initParser() {
  if (isParserInitialized) return true;
  const parserModule = await ensureParserLoaded();
  if (!parserModule) return false;

  try {
    const coreWasmUrl =
      "https://esm.sh/web-tree-sitter@0.20.8/tree-sitter.wasm";
    console.log(`[AST] Initializing parser with ${coreWasmUrl}`);

    await parserModule.init({
      locateFile(scriptName: string, _scriptDirectory: string) {
        if (scriptName === "tree-sitter.wasm") return coreWasmUrl;
        return scriptName;
      },
    });
  } catch (e) {
    console.warn(
      "[ast-chunker] parser init failed, falling back to text chunking:",
      (e as Error).message,
    );
    Parser = null;
    return false;
  }

  isParserInitialized = true;
  sharedParser = new (Parser as any)();
  return true;
}

async function getLanguage(lang: string) {
  const parserModule = await ensureParserLoaded();
  if (!parserModule) return null;

  const langKey = lang === "tsx" ? "typescript" : lang;
  if (languageCache.has(langKey)) return languageCache.get(langKey);

  try {
    let buffer: ArrayBuffer | null = null;
    const wasmFilename = `tree-sitter-${langKey}.wasm`;

    try {
      const localUrl = new URL(`./wasm/${wasmFilename}`, import.meta.url);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      try {
        const localRes = await fetch(localUrl, { signal: controller.signal });
        if (localRes.ok) {
          buffer = await localRes.arrayBuffer();
        }
      } finally {
        clearTimeout(id);
      }
    } catch (localErr) {}

    if (!buffer) {
      const baseUrl = Deno.env.get("TREE_SITTER_WASM_BASE_URL") ||
        "https://esm.sh/tree-sitter-wasms@0.1.11/out";
      const remoteUrl = `${baseUrl.replace(/\/$/, "")}/${wasmFilename}`;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(remoteUrl, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch grammar from ${remoteUrl}`);
        }
        buffer = await res.arrayBuffer();
      } finally {
        clearTimeout(id);
      }
    }

    const expectedHash = WASM_SHA256[langKey];
    if (expectedHash) {
      const actualHash = await computeSha256(buffer!);
      if (actualHash !== expectedHash) {
        throw new Error(`Integrity check failed for ${langKey}.`);
      }
    }

    const language = await parserModule.Language.load(new Uint8Array(buffer!));
    languageCache.set(langKey, language);
    return language;
  } catch (e) {
    console.error(
      `[AST] Grammar load failed for ${lang}:`,
      (e as Error).message,
    );
    return null;
  }
}

function extractImports(tree: any, lang: string): string[] {
  const imports: string[] = [];
  const queryMap: Record<string, string> = {
    typescript: "(import_statement) @import (import_alias) @import",
    javascript: "(import_statement) @import",
    python: "(import_from_statement) @import (import_statement) @import",
    go: "(import_declaration) @import",
  };

  const queryStr = queryMap[lang === "tsx" ? "typescript" : lang];
  if (!queryStr) return [];

  try {
    const query = tree.getLanguage().query(queryStr);
    const matches = query.matches(tree.rootNode);
    for (const match of matches) {
      for (const capture of match.captures) {
        imports.push(capture.node.text);
      }
    }
  } catch (e) {}
  return imports;
}

function extractExportedNames(
  tree: any,
  lang: string,
): { name: string; line: number }[] {
  const exports: { name: string; line: number }[] = [];
  const queryMap: Record<string, string> = {
    typescript: `
      (export_statement (declaration (function_declaration name: (identifier) @export)))
      (export_statement (declaration (class_declaration name: (identifier) @export)))
      (export_statement (declaration (lexical_declaration (variable_declarator name: (identifier) @export))))
      (export_statement (export_clause (export_specifier name: (identifier) @export)))
    `,
    javascript: `
      (export_statement (declaration (function_declaration name: (identifier) @export)))
      (export_statement (declaration (class_declaration name: (identifier) @export)))
    `,
    python: `
      (function_definition name: (identifier) @export)
      (class_definition name: (identifier) @export)
    `,
    go: `
      (function_declaration name: (identifier) @export)
      (type_declaration (type_spec name: (identifier) @export))
    `,
  };

  const queryStr = queryMap[lang === "tsx" ? "typescript" : lang];
  if (!queryStr) return [];

  try {
    const query = tree.getLanguage().query(queryStr);
    const matches = query.matches(tree.rootNode);
    for (const match of matches) {
      for (const capture of match.captures) {
        const name = capture.node.text;
        const line = capture.node.startPosition.row + 1;
        if (lang === "go" && !/^[A-Z]/.test(name)) continue;
        exports.push({ name, line });
      }
    }
  } catch (e) {}
  return exports;
}

function walkAST(node: any, code: string, chunks: ASTChunk[], lang: string) {
  const interestingTypes = [
    "function_declaration",
    "method_definition",
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "type_alias_declaration",
    "function_definition",
  ];

  if (interestingTypes.includes(node.type)) {
    const nameNode = node.childForFieldName("name") ||
      node.children.find((c: any) => c.type.includes("identifier"));

    chunks.push({
      text: code.slice(node.startIndex, node.endIndex),
      metadata: {
        entity_type: node.type,
        entity_name: nameNode?.text || "anonymous",
        signature:
          code.slice(node.startIndex, nameNode?.endIndex || node.endIndex)
            .split("\n")[0],
        line_start: node.startPosition.row + 1,
        line_end: node.endPosition.row + 1,
      },
    });
    return;
  }

  for (const child of node.children) {
    walkAST(child, code, chunks, lang);
  }
}

function extractOrphanCode(
  root: any,
  code: string,
  astChunks: ASTChunk[],
): ASTChunk[] {
  const orphans: ASTChunk[] = [];
  const sortedChunks = [...astChunks].sort((a, b) =>
    a.metadata.line_start - b.metadata.line_start
  );

  // Pre-calculate line offsets for O(1) lookup
  const lineOffsets = [0];
  let lastIdx = 0;
  while ((lastIdx = code.indexOf("\n", lastIdx) + 1) > 0) {
    lineOffsets.push(lastIdx);
  }

  let currentPos = 0;
  let currentLine = 1;

  for (const chunk of sortedChunks) {
    const lineIndex = chunk.metadata.line_start - 1;
    const chunkStart = lineIndex < lineOffsets.length
      ? lineOffsets[lineIndex]
      : code.length;

    if (chunkStart > currentPos + 10) {
      const text = code.slice(currentPos, chunkStart).trim();
      if (text.length > 5) {
        orphans.push({
          text,
          metadata: {
            entity_type: "orphan_code",
            entity_name: "file_scope",
            signature: text.split("\n")[0].slice(0, 100),
            line_start: currentLine,
            line_end: chunk.metadata.line_start - 1,
          },
        });
      }
    }
    // Update currentLine to the line after this chunk
    currentLine = chunk.metadata.line_end + 1;
    const endLineIndex = chunk.metadata.line_end;
    currentPos = endLineIndex < lineOffsets.length
      ? lineOffsets[endLineIndex]
      : code.length;
  }

  if (currentPos < code.length - 20) {
    const text = code.slice(currentPos).trim();
    if (text.length > 20) {
      orphans.push({
        text,
        metadata: {
          entity_type: "orphan_code",
          entity_name: "file_scope",
          signature: text.split("\n")[0].slice(0, 100),
          line_start: currentLine,
          line_end: lineOffsets.length,
        },
      });
    }
  }
  return orphans;
}

function splitOversizedChunk(chunk: ASTChunk, maxLines = 100): ASTChunk[] {
  const lines = chunk.text.split("\n");
  if (lines.length <= maxLines) return [chunk];

  const results: ASTChunk[] = [];
  for (let i = 0; i < lines.length; i += 80) {
    const end = Math.min(i + 100, lines.length);
    results.push({
      text: lines.slice(i, end).join("\n"),
      metadata: {
        ...chunk.metadata,
        entity_type: `${chunk.metadata.entity_type}_part`,
        line_start: chunk.metadata.line_start + i,
        line_end: chunk.metadata.line_start + end - 1,
      },
    });
    if (end === lines.length) break;
  }
  return results;
}

/**
 * Main entry point for AST-aware chunking.
 * Includes a mandatory 45s timeout to prevent hanging on huge files.
 */
export async function astChunk(
  code: string,
  filepath: string,
  signal?: AbortSignal,
): Promise<ASTChunk[]> {
  const timeoutMs = 45000;
  const timeoutPromise = new Promise<ASTChunk[]>((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`astChunk timeout for ${filepath}`)),
      timeoutMs,
    );
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("astChunk aborted"));
    });
  });

  try {
    return await Promise.race([
      (async () => {
        if (code.length > 500000) {
          console.warn(
            `[AST] File ${filepath} is too large (${code.length} bytes), falling back to text chunking.`,
          );
          return fallbackTextChunks(code, filepath);
        }
        if (!(await initParser())) return fallbackTextChunks(code, filepath);

        const ext = filepath.split(".").pop() || "";
        const langMap: Record<string, string> = {
          ts: "typescript",
          tsx: "typescript",
          js: "javascript",
          jsx: "javascript",
          py: "python",
          go: "go",
          rs: "rust",
          java: "java",
        };
        const lang = langMap[ext] || null;
        if (!lang) return fallbackTextChunks(code, filepath);

        const grammar = await getLanguage(lang);
        if (!grammar) return fallbackTextChunks(code, filepath);

        try {
          sharedParser.setLanguage(grammar);
          const tree = sharedParser.parse(code);
          const imports = extractImports(tree, lang);
          const exports = extractExportedNames(tree, lang);

          const chunks: ASTChunk[] = [];
          walkAST(tree.rootNode, code, chunks, lang);

          const orphans = extractOrphanCode(tree.rootNode, code, chunks);
          const finalChunks = [...chunks, ...orphans];

          return finalChunks.flatMap((c) => {
            const split = splitOversizedChunk(c);
            return split.map((s) => {
              const chunkExports = exports
                .filter((e) =>
                  e.line >= s.metadata.line_start &&
                  e.line <= s.metadata.line_end
                )
                .map((e) => e.name);
              return {
                ...s,
                metadata: {
                  ...s.metadata,
                  imports,
                  exported_names: chunkExports,
                },
              };
            });
          });
        } catch (e) {
          console.error(
            `[AST] Parse error for ${filepath}:`,
            (e as Error).message,
          );
          return fallbackTextChunks(code, filepath);
        }
      })(),
      timeoutPromise,
    ]);
  } catch (err) {
    console.warn(`[AST] Falling back for ${filepath}:`, (err as Error).message);
    return fallbackTextChunks(code, filepath);
  }
}
