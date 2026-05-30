import * as fs from 'fs';
import * as path from 'path';

/**
 * scripts/check_internal_calls_use_header.ts
 *
 * Lint script to ensure Edge functions use `X-Rocketboard-Internal` for internal 
 * function-to-function calls rather than bare `Authorization: Bearer <service_role_key>`.
 */

const FUNCTIONS_DIR = path.resolve(process.cwd(), 'supabase/functions');
const IGNORED_PATHS = ['node_modules/', '__tests__/'];

const FORBIDDEN_PATTERN = /Authorization:\s*`Bearer \${[a-zA-Z0-9_]*serviceKey[a-zA-Z0-9_]*}`/;
const INTERNAL_SECRET_PATTERN = /X-Rocketboard-Internal/;

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
  
  if (FORBIDDEN_PATTERN.test(content) && !INTERNAL_SECRET_PATTERN.test(content)) {
    console.error(`❌ ${relPath}: Uses Bearer serviceKey without X-Rocketboard-Internal fallback logic.`);
    violations++;
  }
}

if (violations > 0) {
  console.error(`\n⚠️ Found ${violations} files using bare Service Role Bearer tokens for fetch(). Use X-Rocketboard-Internal instead.`);
  process.exit(1);
} else {
  console.log('✅ No bare internal Bearer token calls found.');
  process.exit(0);
}
