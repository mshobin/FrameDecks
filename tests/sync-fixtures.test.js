/* FrameDecks - the saved plans in tests/fixtures/sync/ are still what store.js saves today. If this fails after a
 * change to normalize, run: python tools/make_sync_fixtures.py (and check the record tests still pass). */
const fs = require('fs'), path = require('path'), assert = require('assert');
const env = require('./helpers/load-store.js')();
const dir = path.join(__dirname, 'fixtures', 'sync');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
assert.ok(files.length >= 3, 'sync fixtures present');
files.forEach(f => {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  // compared as JSON text: objects made inside the store's sandbox have another Object prototype
  assert.strictEqual(JSON.stringify(env.Store.normalize(JSON.parse(JSON.stringify(fx.input)))), JSON.stringify(fx.normalized),
    f + ': normalize unchanged');
});
console.log('sync fixtures: OK (' + files.length + ')');
