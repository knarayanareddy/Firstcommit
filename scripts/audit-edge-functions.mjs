import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FUNCTIONS_DIR = path.resolve(__dirname, '../supabase/functions');

// Functions that are allowed to use SUPABASE_SERVICE_ROLE_KEY without requireUser/requireInternal
// (e.g., webhooks, background cron jobs)
const AUTH_GUARD_ALLOWLIST = [
  'github-webhook',
  'check-staleness',
  'lifecycle-retention-job',
  'process-staleness-queue',
  'rollup-pack-quality-daily',
  'sync-feedback-to-langfuse',
  'auto-remediate-module', // System worker
  'google-oauth-callback' // Auth flow
];

// Special case: Ingestion functions are allowed to use SERVICE_ROLE_KEY
const INGEST_PREFIX = 'ingest-';

const FORBIDDEN_PATTERNS = [
  {
    pattern: /Access-Control-Allow-Origin['"]:\s*['"]\*['"]/i,
    message: 'Wildcard CORS ("*") is forbidden. Use a shared allowlist-based approach.'
  },
  {
    pattern: /\|\|\s*['"]\*['"]/i,
    message: 'CORS fallback to wildcard "|| *" is forbidden. Use a shared allowlist.'
  },
  {
    pattern: /redirect:\s*['"]follow['"]/i,
    message: 'redirect: "follow" is forbidden. Use safeFetch() with redirect: "manual" to prevent SSRF.'
  },
  {
    pattern: /allowAnyHost:\s*true/i,
    message: 'allowAnyHost: true is forbidden in URL validation policies.',
    skipIf: (p) => p.endsWith('.test.ts')
  },
  {
    pattern: /@supabase\/supabase-js['"]?(?:@latest|@2(?!\.45\.6)|(?![@\w.-]))/i,
    message: 'Unpinned or non-standard @supabase/supabase-js version. Use @2.45.6 for stability.'
  },
  {
    pattern: /req\.json\(\)/g,
    message: 'Using raw req.json() is discouraged. Use readJson(req, corsHeaders) from _shared/http.ts for safe 400 errors.',
    skipIf: (p) => p.endsWith('_shared/http.ts')
  }
];

function auditFile(dirName, filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check forbidden patterns
  for (const { pattern, message, skipIf } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      if (skipIf && skipIf(relativePath || '')) continue;
      issues.push(message);
    }
  }

  // Check Service Role usage without guards
  const usesServiceRole = content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('createServiceClient');
  const hasAuthGuard = content.includes('requireUser(') || content.includes('requireInternal(') || content.includes('authenticateRequest(');

  // RULE C: Only enforce on entrypoints, skip _shared
  const isEntryPoint = filePath.endsWith('index.ts');
  const isShared = dirName === '_shared' || (relativePath && relativePath.includes('_shared/'));
  const isAllowed = AUTH_GUARD_ALLOWLIST.includes(dirName) || dirName.startsWith(INGEST_PREFIX) || isShared || !isEntryPoint;

  if (usesServiceRole && !hasAuthGuard && !isAllowed) {
    issues.push('Uses SUPABASE_SERVICE_ROLE_KEY but lacks requireUser() or requireInternal() guard.');
  }

  // Refinement: If it's in rocketboard-mcp, we trust the deno.json pins
  if (filePath.includes('rocketboard-mcp')) {
    const versionIssueIndex = issues.indexOf('Unpinned or non-standard @supabase/supabase-js version. Use @2.45.6 for stability.');
    if (versionIssueIndex !== -1) {
      issues.splice(versionIssueIndex, 1);
    }
  }

  return issues;
}

function main() {
  console.log('--- Edge Function Security Audit ---');
  let totalIssues = 0;
  let filesChecked = 0;

  // Support for specific paths via CLI or Env Var
  // CLI: node audit-edge-functions.mjs --paths supabase/functions/a.ts,supabase/functions/b.ts
  // Env: EDGE_AUDIT_PATHS=...
  let filterPaths = [];
  const pathsArgIndex = process.argv.indexOf('--paths');
  if (pathsArgIndex !== -1 && process.argv[pathsArgIndex + 1]) {
    filterPaths = process.argv[pathsArgIndex + 1].split(',').map(p => p.trim());
  } else if (process.env.EDGE_AUDIT_PATHS) {
    filterPaths = process.env.EDGE_AUDIT_PATHS.split(',').map(p => p.trim());
  }

  const isFiltered = filterPaths.length > 0;
  const filesToAudit = [];

  if (isFiltered) {
    console.log(`Filtering audit to ${filterPaths.length} specific paths.`);
    for (const p of filterPaths) {
      // Resolve to absolute path if it is relative to the repo root
      const fullPath = path.resolve(process.cwd(), p);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && p.endsWith('.ts')) {
        // Extract the directory name as the function name (e.g., 'supabase/functions/my-func/index.ts' -> 'my-func')
        const parts = p.split(/[\\/]/);
        const funcIndex = parts.indexOf('functions');
        const dirName = (funcIndex !== -1 && parts[funcIndex + 1]) ? parts[funcIndex + 1] : 'unknown';
        filesToAudit.push({ dirName, filePath: fullPath, relativePath: p });
      }
    }
  } else {
    if (!fs.existsSync(FUNCTIONS_DIR)) {
      console.error(`Functions directory not found: ${FUNCTIONS_DIR}`);
      process.exit(1);
    }

    const dirs = fs.readdirSync(FUNCTIONS_DIR);
    for (const dir of dirs) {
      if (dir === '_shared' || dir === 'node_modules') continue;
      const dirPath = path.join(FUNCTIONS_DIR, dir);
      if (!fs.statSync(dirPath).isDirectory()) continue;

      const walk = (d) => {
        const list = fs.readdirSync(d);
        for (const item of list) {
          const fullPath = path.join(d, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            if (item === 'node_modules') continue;
            walk(fullPath);
          } else if (item.endsWith('.ts')) {
            filesToAudit.push({ 
              dirName: dir, 
              filePath: fullPath, 
              relativePath: path.relative(FUNCTIONS_DIR, fullPath) 
            });
          }
        }
      };
      walk(dirPath);
    }
  }

  for (const { dirName, filePath, relativePath } of filesToAudit) {
    filesChecked++;
    const issues = auditFile(dirName, filePath, relativePath);
    if (issues.length > 0) {
      console.error(`\n[!] Issues found in ${relativePath}:`);
      issues.forEach(issue => console.error(`  - ${issue}`));
      totalIssues += issues.length;
    }
  }

  console.log(`\n--- Audit Complete ---`);
  console.log(`Checked ${filesChecked} functions.`);
  
  if (totalIssues > 0) {
    console.error(`Total security issues found: ${totalIssues}`);
    process.exit(1);
  } else {
    console.log('No security regressions detected. \u2705');
  }
}

main();
