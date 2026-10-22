/* FRAMEDECKS - runs every tests/*.test.js file with Node (no packages to install).
 * Usage: node tests/run.js        Exit code 0 = all passed. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files){
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  process.stdout.write((ok ? 'PASS  ' : 'FAIL  ') + f + '\n');
  const out = (r.stdout || '') + (r.stderr || '');
  if (!ok || process.env.VERBOSE) process.stdout.write(out.replace(/^/gm, '      ') + '\n');
}
process.stdout.write('\n' + (files.length - failed) + ' of ' + files.length + ' test files passed\n');
process.exit(failed ? 1 : 0);
