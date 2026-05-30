import * as fs from 'fs';
import * as path from 'path';

/**
 * scripts/check_no_plain_credentials_reads.ts
 *
 * CI lint: ensures no Edge function reads credential_value directly from
 * pack_source_credentials. All credential retrieval must go through the
 * Vault-backed _shared/credentials.ts helper.
 */

const FUNCTIONS_DIR = path.resolve(process.cwd(), 'supabase/functions');
const IGNORED_PATHS = ['_shared/credentials.ts', '__tests__/', 'node_modules/'];

const FORBIDDEN_PATTERNS = [
  /\.from\s*\(\s*["']pack_source_credentials["']\s*\)/,
  /\.select\s*\(\s*["']credential_value["']\s*\)/,
  /credential_value/,
];

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

let violations = 0;
const files = walk(FUNCTIONS_DIR);

for (const file of files) {
  const relPath = path.relative(FUNCTIONS_DIR, file);
  if (IGNORED_PATHS.some((p) => relPath.includes(p))) continue;

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(lines[i])) {
        console.error(
          `❌ ${relPath}:${i + 1}: Direct credential read detected: "${lines[i].trim()}"`,
        );
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(
    `\n⚠️ Found ${violations} direct credential read(s). Use _shared/credentials.ts (Vault-backed RPC) instead.`,
  );
  process.exit(1);
}

console.log('✅ No direct credential reads found. All retrieval uses Vault-backed helpers.');
process.exit(0);
