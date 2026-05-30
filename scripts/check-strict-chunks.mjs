import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = 'src';
const ALLOWED_FILES = [
  'src/lib/knowledgeChunks.ts', // The wrapper itself
];

// Re-creating the regex from the prompt
// rg -n 'from\("knowledge_chunks"\).*eq\("chunk_id"' src
const FORBIDDEN_PATTERN = /from\(['"]knowledge_chunks['"]\).*eq\(['"]chunk_id['"]/s;

let failed = false;

function checkFile(filePath) {
  const relPath = relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (ALLOWED_FILES.includes(relPath)) return;

  const content = readFileSync(filePath, 'utf8');
  if (FORBIDDEN_PATTERN.test(content)) {
    console.error(`❌ Violation found in ${relPath}: Direct .eq("chunk_id") query on knowledge_chunks is forbidden.`);
    console.error(`   Please use fetchKnowledgeChunkByStableId or batchFetchKnowledgeChunks from src/lib/knowledgeChunks.ts instead.`);
    failed = true;
  }
}

function walk(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      checkFile(fullPath);
    }
  }
}

console.log('🔍 Checking for direct knowledge_chunks.chunk_id queries...');
walk(SRC_DIR);

if (failed) {
  process.exit(1);
} else {
  console.log('✅ No violations found.');
}
