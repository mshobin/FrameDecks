/* FrameDecks - the phone's pairing keys (app/js/pair-crypto.js) agree with the PC's (pairing_crypto.py): the same
 * relay key and check digits from the same X25519 keys, and each side opens what the other sealed.
 * Vector: tools/make_pairing_vector.py. Run: node tests/run.js */
'use strict';
const assert = require('assert'), P = require('../app/js/pair-crypto.js'), V = require('./fixtures/pairing-vector.json');
const subtle = globalThis.crypto.subtle;
const priv = k => subtle.importKey('jwk', {kty: 'OKP', crv: 'X25519', d: k.d, x: k.x}, {name: 'X25519'}, false, ['deriveBits']);

(async () => {
  // the phone's side of the PC's pairing: the same key and the same six check digits
  const phone = await P.derive(await priv(V.phone), V.pc.x, V.pairingId);
  assert.strictEqual(phone.raw, V.key, 'the relay key matches the PC');
  assert.strictEqual(phone.check, V.check, 'the check digits match the PC');
  const pc = await P.derive(await priv(V.pc), V.phone.x, V.pairingId);
  assert.strictEqual(pc.raw, V.key, 'and from the other side');

  // the phone opens what the PC sealed, and the other way round
  assert.deepStrictEqual(await P.open(phone.key, 'res', V.device, V.sealedRes), V.plainRes);
  const s = await P.seal(phone.key, 'req', V.device, {n: 7, method: 'GET', path: 'api/state'});
  assert.deepStrictEqual(await P.open(pc.key, 'req', V.device, s), {n: 7, method: 'GET', path: 'api/state'});

  // a seal for one device, or one direction, does not open as another
  await assert.rejects(P.open(phone.key, 'req', V.device, V.sealedRes), 'direction is bound');
  await assert.rejects(P.open(phone.key, 'res', 'dev_other', V.sealedRes), 'the device is bound');
  const other = await P.derive(await priv(V.phone), (await P.newKeyPair()).pub, V.pairingId);
  await assert.rejects(P.open(other.key, 'res', V.device, V.sealedRes), 'another key cannot open it');

  // a fresh pairing: both sides agree
  const a = await P.newKeyPair(), b = await P.newKeyPair();
  const ka = await P.derive(a.priv, b.pub, 'pr_x'), kb = await P.derive(b.priv, a.pub, 'pr_x');
  assert.strictEqual(ka.raw, kb.raw); assert.strictEqual(ka.check, kb.check);
  assert.match(ka.check, /^\d{3} \d{3}$/);
  console.log('pair crypto: OK');
})().catch(e => { console.error(e); process.exit(1); });
