/* FrameDecks 7.1 - the workspace look in the program: store.js keeps only a well-formed look (none means the standard
 * navy), and KCScenes.lookSurface gives the output pages the same surface as the camera (vcam/cards.py surface_of). */
const assert = require('assert');
const env = require('./helpers/load-store.js')();
const N = (s) => JSON.parse(JSON.stringify(env.Store.normalize(JSON.parse(JSON.stringify(s)))));
const SC = env.Scenes || env.KCScenes;

const ocean = {id: 'deep-ocean', name: 'Deep Ocean', a: '#0D3349', b: '#06202f', font: 'sans', base: 'dark'};
assert.deepStrictEqual(N({look: ocean}).look, {id: 'deep-ocean', name: 'Deep Ocean', a: '#0d3349', b: '#06202f', font: 'sans', base: 'dark'});
assert.strictEqual('look' in N({}), false, 'no look by default');
assert.strictEqual('look' in N({look: {id: 'x', a: 'red', b: '#000000'}}), false, 'a broken look is dropped');
assert.strictEqual('look' in N({look: {id: 'Bad Id!', a: '#000000', b: '#000000'}}), false);
assert.strictEqual(N({look: Object.assign({}, ocean, {font: 'comic', base: 'pink'})}).look.font, 'serif');
assert.strictEqual(N({look: Object.assign({}, ocean, {base: 'light'})}).look.base, 'light');

assert.ok(SC && SC.lookSurface, 'KCScenes.lookSurface');
assert.deepStrictEqual(JSON.parse(JSON.stringify(SC.lookSurface(N({look: ocean})))), {a: '13,51,73', b: '6,32,47', font: 'sans'});
assert.strictEqual(SC.lookSurface(N({})), null);
console.log('workspace look: OK');
