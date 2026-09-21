import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Deliberately local-only: this helper cannot apply to a remote database.
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const binding = config.d1_databases?.find(value => value.binding === 'DB');
if (!binding) throw new Error('Build first with the logical DB binding enabled.');
binding.migrations_dir = resolve('drizzle');
// Only D1 fields are needed. Do not inherit Worker asset paths or remote bindings.
mkdirSync('.sites-runtime', { recursive: true });
const filename = '.sites-runtime/local-migrations.json';
writeFileSync(filename, JSON.stringify({ name: 'independent-erp-local', compatibility_date: '2026-05-15', d1_databases: [{ binding: 'DB', database_name: 'independent-erp-local', database_id: '00000000-0000-4000-8000-000000000000', migrations_dir: binding.migrations_dir }] }, null, 2));
const result = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--local', '--config', filename, '--persist-to', '.wrangler/state'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
