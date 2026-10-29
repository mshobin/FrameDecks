/* FrameDecks - the update service Worker (infra/update-api/src/index.js) against a stand-in R2 bucket. */
'use strict';
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

function bucket(files){
  return {
    get: async (k) => (k in files ? { text: async () => files[k] } : null),
    head: async (k) => (k in files ? {} : null)
  };
}

(async () => {
  const { handle } = await import(pathToFileURL(path.join(__dirname, '..', 'infra', 'update-api', 'src', 'index.js')).href);
  const latest = JSON.stringify({ version: '7.0' });
  const env = { RELEASES: bucket({ 'releases/latest.json': latest, 'releases/index.json': '{"latest":"7.0","releases":[]}', 'releases/7.0/manifest.json': latest }) };
  const get = (p, method) => handle(new Request('https://api.framedecks.com' + p, { method: method || 'GET' }), env);

  let r = await get('/releases/latest');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(await r.text(), latest);
  assert.strictEqual(r.headers.get('access-control-allow-origin'), '*');
  assert.match(r.headers.get('cache-control'), /max-age=300/);
  assert.strictEqual((await get('/releases')).status, 200);
  assert.strictEqual((await get('/releases/7.0')).status, 200);
  assert.strictEqual((await get('/releases/6.9')).status, 404, 'an unknown version');
  assert.strictEqual((await get('/releases/..%2F..%2Fsecret')).status, 404, 'no path tricks');
  assert.strictEqual((await get('/releases/latest', 'POST')).status, 405);
  assert.strictEqual((await get('/health')).status, 200);
  const broken = { RELEASES: { head: async () => { throw new Error('down'); } } };
  assert.strictEqual((await handle(new Request('https://api.framedecks.com/health'), broken)).status, 503);
  console.log('update service: ok');
})().catch((e) => { console.error(e); process.exit(1); });
