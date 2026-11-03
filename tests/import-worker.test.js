/* 9.3 (production audit L16): an Excel file whose stated range ('!ref') is huge is read quickly, because the import
 * worker clamps each sheet's range to the rows and columns FrameDecks reads. Runs app/js/import-worker.js in a
 * stand-in worker (vm) with the bundled SheetJS. */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');

function worker(){
  const ctx = { console, Uint8Array, ArrayBuffer, Date, Math, setTimeout, clearTimeout };
  ctx.self = ctx; ctx.window = undefined;
  ctx.importScripts = (rel) => vm.runInContext(fs.readFileSync(path.join(APP, 'js', rel), 'utf8'), ctx);
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(APP, 'js', 'import-worker.js'), 'utf8'), ctx);
  return ctx;
}

const w = worker();
const X = w.XLSX;
assert.ok(X, 'SheetJS loaded in the stand-in worker');
const ws = X.utils.aoa_to_sheet([['Scene Name', 'Notes'], ['Welcome', 'Hello'], ['Prayer', '']]);
const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Plan');
// the file then claims sixteen thousand columns by a million rows (its <dimension>), as a crafted file could
const zip = X.CFB.read(new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' })), { type: 'array' });
const sheet = zip.FileIndex.find((f) => /sheet1\.xml$/.test(f.name));
const xml = Buffer.from(sheet.content).toString('utf8');
assert.ok(/<dimension ref="[^"]+"/.test(xml));
sheet.content = Buffer.from(xml.replace(/<dimension ref="[^"]+"/, '<dimension ref="A1:XFD1048576"'));
const buf = X.CFB.write(zip, { type: 'array', fileType: 'zip' });

for (const all of [false, true]){
  let answer = null;
  w.postMessage = (m) => { answer = m; };
  const t0 = Date.now();
  w.onmessage({ data: { buffer: buf, name: 'plan.xlsx', all } });
  const ms = Date.now() - t0;
  assert.ok(answer && answer.ok, JSON.stringify(answer && answer.error));
  assert.ok(ms < 5000, `read in ${ms} ms`);
  if (!all){
    assert.deepStrictEqual(Array.from(answer.headers.slice(0, 2)), ['Scene Name', 'Notes']);
    assert.strictEqual(answer.rows[0][0], 'Welcome');
    assert.ok(answer.headers.length <= 200, `${answer.headers.length} columns read`);
  } else {
    assert.ok(answer.book.Plan.rows.length <= 5000);
  }
}
console.log('import-worker: a huge stated range is clamped and read quickly');
