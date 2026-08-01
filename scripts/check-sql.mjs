// Parse-checks every migration against real PostgreSQL grammar (libpg_query).
// This proves the SQL parses; it does not prove the semantics are right —
// that needs a real run against the Supabase project.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'pgsql-parser';

const dir = join(process.cwd(), 'supabase', 'migrations');
let failed = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(dir, file), 'utf8');
  try {
    const stmts = await parse(sql);
    const n = Array.isArray(stmts) ? stmts.length : (stmts?.stmts?.length ?? '?');
    console.log(`  ok   ${file}  (${n} statements)`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${file}`);
    console.log(`       ${err.message}`);
    if (err.cursorPosition) {
      const upto = sql.slice(0, err.cursorPosition);
      const line = upto.split('\n').length;
      console.log(`       around line ${line}: ${sql.split('\n')[line - 1]?.trim()}`);
    }
  }
}

console.log(failed ? `\n${failed} file(s) failed to parse.` : '\nAll migrations parse.');
process.exit(failed ? 1 : 0);
