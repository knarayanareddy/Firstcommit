import * as fs from 'fs';
import * as path from 'path';

/**
 * scripts/check_types_tables.ts
 * 
 * Verifies that the Supabase types.ts file includes definitions for critical tables.
 * This prevents "silent drift" where migrations add tables but the frontend types
 * remain outdated, leading to 'as any' casts or runtime errors.
 *
 * Supports both quoted ("table": {) and unquoted (table: {) key formats
 * to handle variations in Supabase type generation output.
 */

const typesPath = path.resolve(process.cwd(), 'src/integrations/supabase/types.ts');

if (!fs.existsSync(typesPath)) {
  console.error(`❌ Types file not found: ${typesPath}`);
  console.error('Run: npx supabase gen types typescript --local --schema public > src/integrations/supabase/types.ts');
  process.exit(1);
}

const content = fs.readFileSync(typesPath, 'utf8');

// The following tables are mandatory for the staleness/remediation subsystem
const requiredTables = [
  'module_remediations',
  'staleness_check_queue',
  'content_freshness',
  'pack_active_generation'
];

let missing = false;
for (const table of requiredTables) {
  // Accept both unquoted (table: {) and quoted ("table": {) key formats
  const hasUnquoted = content.includes(`${table}: {`);
  const hasQuoted = content.includes(`"${table}": {`);
  const hasTableEntry = hasUnquoted || hasQuoted;

  if (!hasTableEntry) {
    console.error(`❌ Missing table definition in types.ts: ${table}`);
    missing = true;
  } else {
    // Basic verification of the definition shape — must contain Row: {
    const splitPattern = hasUnquoted ? `${table}: {` : `"${table}": {`;
    const tableSection = content.split(splitPattern)[1].split('}')[0];
    if (!tableSection.includes('Row: {')) {
      console.error(`❌ Incomplete table definition in types.ts: ${table} (Missing 'Row' type)`);
      missing = true;
    }
  }
}

if (missing) {
  console.error('\n⚠️ DATABASE DRIFT DETECTED!');
  console.error('The supabase/migrations/ directory contains tables that are not reflected in src/integrations/supabase/types.ts.');
  console.log('\nTo resolve this, regenerate the types:');
  console.log('  Local:  npx supabase gen types typescript --local --schema public > src/integrations/supabase/types.ts');
  console.log('  Remote: npx supabase gen types typescript --project-id <ref> --schema public > src/integrations/supabase/types.ts');
  process.exit(1);
}

console.log('✅ types.ts is synchronized with all required hardened tables.');
process.exit(0);
