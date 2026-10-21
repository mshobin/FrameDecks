/* FRAMEDECKS - Teleprompter tests (app/js/teleprompter.js, 6.7).
 * The audience can never see the script: no output reads a Frame's notes. The script markup is always escaped.
 * Run: node tests/run.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/* ---------- 1. No output reads the script ---------- */
// every page an audience sees (camera overlay, OBS / browser pages, Presentation window) and the scripts they load
const OUTPUT_PAGES = ['app/stage.html', 'app/present.html', 'app/focus-verse.html', 'app/discussion-question.html', 'app/birthday.html'];
const files = new Set();
OUTPUT_PAGES.forEach(p => {
  files.add(p);
  const html = read(p), re = /<script[^>]+src="([^"]+)"/g; let m;
  while ((m = re.exec(html))) if (!/^(https?:)?\/\//.test(m[1])) files.add(path.join('app', m[1]));
});
files.delete(path.join('app', 'js', 'store.js'));   // the store keeps the field (cleanScene); it never draws it
fs.readdirSync(path.join(root, 'vcam')).filter(f => f.endsWith('.py')).forEach(f => files.add(path.join('vcam', f)));
const NOTES = /\.notes\b|\[\s*["']notes["']\s*\]|\bget\(\s*["']notes["']/;
files.forEach(f => {
  if (!fs.existsSync(path.join(root, f))) return;
  const code = read(f).split('\n').filter(l => !/^\s*(\/\/|#|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!NOTES.test(code), f + ' must not read a Frame\'s notes (the Teleprompter script)');
});
assert.ok(files.size > 10, 'the output files were found');
// the store's own helpers that build what outputs show never copy notes either
const store = read('app/js/store.js');
['liveText', 'previewState'].forEach(fn => {
  const i = store.indexOf(fn + ':'), body = i < 0 ? '' : store.slice(i, i + 1500);
  assert.ok(!/\.notes\b/.test(body), 'KCScenes.' + fn + ' must not use notes');
});

/* ---------- 2. Rendering is safe and understands the markup ---------- */
const env = require('./helpers/load-store.js')();
const ctx = {window: {KCScenes: env.Scenes}, console};
ctx.window.window = ctx.window;
vm.createContext(ctx.window);
vm.runInContext(read('app/js/teleprompter.js'), ctx.window);
const P = ctx.window.KCPrompter;
assert.ok(P && typeof P.render === 'function' && typeof P.create === 'function');
const html = P.render('<script>alert(1)</script>\n# Welcome\n- one **two** *three*\n[PAUSE] then\n---');
assert.ok(!/<script/i.test(html), 'markup is escaped');
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(html.includes('<h3>Welcome</h3>'));
assert.ok(html.includes('<ul><li>one <b>two</b> <i>three</i></li></ul>'));
assert.ok(html.includes('<span class="tp-cue">PAUSE</span>'));
assert.ok(html.includes('<hr>'));
assert.strictEqual(P.render(''), '');
assert.ok(!/onerror/.test(P.render('<img src=x onerror=alert(1)>').replace(/&lt;img[^&]*&gt;/, '')));

/* ---------- 3. Cues: where we are and what comes next ---------- */
const raw = {v6: true, scenes: [
  {id: 'sc_a', name: 'Welcome', notes: 'Hello', layers: [{id: 'L1', kind: 'question', c: {}}]},
  {id: 'sc_b', name: 'Bible Study', layers: [{id: 'L1', kind: 'scripture', c: {}}]}]};
const st = env.Store.normalize(JSON.parse(JSON.stringify(raw)));
const order = env.Scenes.order(st);
assert.ok(order.length >= 2, 'the default meeting has Frames');
const c = P.cues(st, order[0]);
assert.strictEqual(c.pos, 'Frame 1 of ' + order.length);
assert.strictEqual(c.name, order[0].name);
assert.strictEqual(c.next, order[1].name);
assert.deepStrictEqual(JSON.parse(JSON.stringify(P.cues(st, null))), {pos: '', name: '', next: '', upcoming: ''});
assert.strictEqual(P.speeds.length, 5, 'Very slow to Very fast');

/* ---------- 4. Long scripts are kept ---------- */
const big = 'x'.repeat(15000), r2 = JSON.parse(JSON.stringify(raw));
r2.scenes[0].notes = big;
const n = env.Store.normalize(r2);
assert.strictEqual(n.scenes[0].notes.length, 15000, 'a 15,000-character script survives');
console.log('teleprompter tests passed');
