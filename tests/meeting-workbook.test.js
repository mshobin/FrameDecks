/* Checks the Meeting Workbook: the template (Dashboard + Meeting Form) imports without errors, an imported meeting
 * exports and imports again (the program's styled export and the plain one), a hand-made form imports, and workbooks
 * from 6.5-6.8 (one sheet per list) still import.
 *   node tests/meeting-workbook.test.js
 * Uses the app's own code (app/js/store.js, app/js/meeting-book.js), SheetJS (app/vendor) and, for the styled export,
 * meeting_form.py through Python (skipped when Python is not found). */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert'), os = require('os');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const X = require(path.join(root, 'app/vendor/xlsx.full.min.js'));
const ls = {};
const ctx = {console, Math, Date, JSON, setTimeout, clearTimeout, Promise, Object, Array, String, Number, isFinite, RegExp, Error,
  location: {protocol: 'file:'}, localStorage: {getItem: k => ls[k] || null, setItem: (k, v) => { ls[k] = v; }},
  document: {addEventListener(){}, hidden: false}, addEventListener(){}, fetch: () => Promise.reject()};
ctx.window = ctx;
vm.createContext(ctx);
['app/js/store.js', 'app/js/meeting-book.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx));
const B = ctx.KCMeetingBook, Store = ctx.KCStore;
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const TEMPLATE = path.join(root, 'app/templates/Kingdom-Connect-Meeting-Workbook.xlsx');

function text(c){ return String(c == null ? '' : c).replace(/\r\n?/g, '\n').trim(); }
function readWorker(wb){          // the same reading as app/js/import-worker.js with {all: true}
  const book = {}, grids = {};
  wb.SheetNames.forEach(n => {
    const rows = X.utils.sheet_to_json(wb.Sheets[n], {header: 1, defval: '', blankrows: true, raw: false});
    if (!rows.length) return;
    grids[n] = {first: X.utils.decode_range(wb.Sheets[n]['!ref'] || 'A1').s.r + 1, rows: rows.map(r => Array.from(r, text))};
    let hr = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) if (rows[i].filter(c => text(c) !== '').length >= 2){ hr = i; break; }
    const headers = rows[hr].map((h, j) => text(h) || 'Column ' + (j + 1));
    book[n] = {headers, rows: rows.slice(hr + 1).map(r => headers.map((_, j) => text(r[j]))), headerRow: hr + 1};
  });
  return {sheets: wb.SheetNames, book, grids};
}
function planOf(wb){ const fb = B.bookOf(readWorker(wb)); assert.ok(fb, 'a Meeting Workbook'); return B.parse(fb.book, {form: fb.form}); }

/* 1. the template: two tabs, the form's tables have the app's columns, and it imports cleanly */
const tpl = X.read(fs.readFileSync(TEMPLATE), {type: 'buffer'});
same(tpl.SheetNames, ['Dashboard', 'Meeting Form'], 'two tabs');
const d = readWorker(tpl);
const fb = B.bookOf(d);
assert.strictEqual(fb.form, 'Meeting Form', 'the Meeting Form is found');
B.FORM_TABLES.forEach(t => {
  const head = d.grids['Meeting Form'].rows.find(r => r.length && text(r[0]) === 'Frame #' && r[2] === t[2][2]);
  assert.ok(head, 'table ' + t[1]);
  same(head.slice(0, t[2].length), t[2], 'columns of ' + t[1]);
});
const plan = B.parse(fb.book, {form: fb.form});
same(plan.errors, [], 'the template imports without errors');
assert.strictEqual(plan.counts.frames, 6);
assert.strictEqual(plan.counts.content, 8);
assert.strictEqual(plan.counts.questions, 3);
assert.strictEqual(plan.counts.scriptures, 2);
assert.strictEqual(plan.meeting.title, 'Romans · Week 5');
assert.strictEqual(plan.meeting.date, '2026-10-25');
assert.strictEqual(plan.meeting.time, '19:00');
assert.strictEqual(plan.meeting.attendees, '24');
assert.strictEqual(plan.meeting.presenter, 'Your name');
assert.ok(plan.warnings.every(w => /^Meeting Form · /.test(w.sheet)), 'problems name the form and its section');
const st = Store.defaults();
assert.strictEqual(B.apply(st, plan, {}).length, 6);
assert.strictEqual(st.meeting.title, 'Romans · Week 5');
assert.strictEqual(st.meeting.location, 'Fellowship Hall, or paste the Zoom / Teams link');
// FRAMEDECKS: the template's Frame 6 has two Decks (Deck column); the others one
const closing = st.scenes[5], deckNames = sc => sc.decks.map(d => d.name);
same(deckNames(closing), ['Prayer', 'Goodbye'], 'the Deck column makes the Decks');
same(closing.layers.filter(l => l.kind !== 'background').map(l => closing.decks.find(d => d.id === l.deck).name), ['Prayer', 'Goodbye']);
same(deckNames(st.scenes[0]), ['Deck 1'], 'no Deck column: one Deck');
assert.ok(st.scenes[0].layers.some(l => l.kind === 'background'), 'Frame 1 has its background');
const kept = Store.normalize ? Store.normalize(JSON.parse(JSON.stringify(st))) : st;
assert.strictEqual(kept.meeting.attendeeNotes, 'Two newcomers expected: welcome them by name.', 'the store keeps the new details');

/* 2. export: the plain one-sheet form (no program running) imports again */
const plainWb = X.read(X.write(B.exportBook(X, st), {type: 'buffer', bookType: 'xlsx'}), {type: 'buffer'});
same(plainWb.SheetNames, ['Meeting Form'], 'the plain export is one sheet');
const plan2 = planOf(plainWb);
same(plan2.errors, [], 'a plain export imports again');
same([plan2.counts.frames, plan2.counts.content, plan2.counts.questions, plan2.counts.scriptures], [6, 8, 3, 2]);
assert.strictEqual(plan2.meeting.contact, 'name@example.com · 555 0100');
const st2 = Store.defaults(); B.apply(st2, plan2, {});
same(st2.scenes[5].decks.map(d => d.name), ['Prayer', 'Goodbye'], 'the Decks survive the plain export');

/* 3. export: the program's styled form (meeting_form.py fills the template) imports again */
const sheetsJson = path.join(os.tmpdir(), 'kc-mb-' + process.pid + '.json'), filled = sheetsJson.replace('.json', '.xlsx');
fs.writeFileSync(sheetsJson, JSON.stringify(B.exportSheets(st)));
const py = ['python3', 'python'].map(p => spawnSync(p, ['-c', [
  'import json, sys; sys.path.insert(0, sys.argv[1]); import meeting_form as M',
  'm, t = M.from_sheets(json.load(open(sys.argv[2], encoding="utf-8")))',
  'open(sys.argv[3], "wb").write(M.fill(open(sys.argv[4], "rb").read(), m, t))'].join('\n'), root, sheetsJson, filled, TEMPLATE], {encoding: 'utf8'}))
  .find(r => !r.error);
if (py && py.status === 0){
  const styled = X.read(fs.readFileSync(filled), {type: 'buffer'});
  same(styled.SheetNames, ['Dashboard', 'Meeting Form'], 'the styled export keeps both tabs');
  const plan3 = planOf(styled);
  same(plan3.errors, [], 'a styled export imports again');
  same([plan3.counts.frames, plan3.counts.content, plan3.counts.questions, plan3.counts.scriptures], [6, 8, 3, 2]);
  same(plan3.meeting, plan.meeting, 'the meeting details survive the round trip');
  const st3 = Store.defaults(); B.apply(st3, plan3, {});
  same(st3.scenes[5].decks.map(d => d.name), ['Prayer', 'Goodbye'], 'the Decks survive the styled export');
  [sheetsJson, filled].forEach(f => fs.unlinkSync(f));
} else {
  assert.ok(!py || py.status === 0, 'meeting_form.py failed: ' + (py && py.stderr));
  console.log('(Python not found: the styled export was not checked)');
}

/* 4. a hand-made form: labels anywhere on the row, its own section names, "None" animations */
const hand = [['KINGDOM CONNECT | MEETING FORM'], ['Fill the highlighted fields.'], [], ['1 · MEETING DETAILS'],
  ['Meeting title', 'Hand made', '', '', 'Date', '2026-12-01'], ['Presenter', 'Sam'], [],
  ['2 · MEETING FRAMES'], ['Frame #', 'Frame name', 'Purpose / description', 'Background', 'Transition', 'Presenter script'],
  [1, 'Welcome', '', 'Navy', 'Fade', 'Say hello'], [2, 'Talk', '', '', '', ''], [],
  ['3 · PRESENTATION CONTENT'], ['Frame #', 'Order', 'Content type', 'Item name', 'Main content / file', 'On-screen label', 'Duration (min)', 'Animation'],
  [1, 1, 'Text', 'Hello', 'Welcome!', '', '', 'None'], [2, 1, 'Question', 'Discuss', '', '', '', ''], [],
  ['4 · DISCUSSION QUESTIONS'], ['Frame #', 'Content name', 'Question #', 'Label', 'Question text'], [2, 'Discuss', 1, '', 'Why?']];
const handWb = X.utils.book_new(); X.utils.book_append_sheet(handWb, X.utils.aoa_to_sheet(hand), 'My form');
const plan4 = planOf(X.read(X.write(handWb, {type: 'buffer', bookType: 'xlsx'}), {type: 'buffer'}));
same(plan4.errors, [], 'a hand-made form imports');
same([plan4.counts.frames, plan4.counts.content, plan4.counts.questions], [2, 2, 1]);
same([plan4.meeting.title, plan4.meeting.date, plan4.meeting.presenter], ['Hand made', '2026-12-01', 'Sam']);
const bad = JSON.parse(JSON.stringify(hand)); bad[14][0] = 9;
const badWb = X.utils.book_new(); X.utils.book_append_sheet(badWb, X.utils.aoa_to_sheet(bad), 'Meeting Form');
const plan5 = planOf(X.read(X.write(badWb, {type: 'buffer', bookType: 'xlsx'}), {type: 'buffer'}));
same(plan5.errors.map(e => [e.sheet, e.row]), [['Meeting Form · Content', 15]], 'a problem names the section and the Excel row');
assert.ok(/Frames table/.test(plan5.errors[0].msg), 'and says "table", not "sheet": ' + plan5.errors[0].msg);

/* 5. a 6.5-6.8 workbook (one sheet per list) still imports; 6.7: its Answer Text and Notes columns become talking
   points in the Frame's teleprompter script */
const legacy = {
  'Meeting Overview': {headers: ['Field', 'Value'], headerRow: 1, rows: [['Meeting Title', 'Old book'], ['Presenter', 'Kim'], ['Notes', 'n']]},
  Frames: {headers: ['Frame Number', 'Frame Name', 'Description', 'Background', 'Transition', 'Presenter Notes'], headerRow: 1,
    rows: [['1', 'Questions', '', '', 'Fade', 'Allow 10 minutes per question.']]},
  Content: {headers: B.header('content'), headerRow: 1, rows: [['1', '1', 'Question', 'Discussion', '', '', '', '', '', '']]},
  Questions: {headers: ['Frame Number', 'Content Name', 'Question Number', 'Label', 'Question Text', 'Answer Text', 'Media', 'Timer', 'Animation', 'Notes'], headerRow: 1,
    rows: [['1', 'Discussion', '1', '', 'Why?', 'Freedom from guilt because of Christ.', '', '', '', 'Start with this one.']]},
  Scriptures: {headers: B.header('scriptures'), headerRow: 1, rows: []}};
const fb6 = B.bookOf({sheets: Object.keys(legacy), book: legacy, grids: {}});
assert.strictEqual(fb6.form, '', 'an older workbook is read sheet by sheet');
const plan6 = B.parse(fb6.book, {});
same(plan6.errors, [], 'an older workbook imports');
same([plan6.meeting.title, plan6.meeting.presenter, plan6.meeting.notes], ['Old book', 'Kim', 'n']);
const st6 = Store.defaults(); B.apply(st6, plan6, {});
const qf = st6.scenes.filter(s => s.layers.some(l => l.kind === 'question'))[0], ql = qf.layers.filter(l => l.kind === 'question')[0];
assert.ok(qf.notes.indexOf('Q1 answer: Freedom from guilt because of Christ.') >= 0, 'answer → teleprompter script');
assert.ok(qf.notes.indexOf('Q1 note: Start with this one.') >= 0, 'note → teleprompter script');
assert.ok(qf.notes.indexOf('Allow 10 minutes per question.') >= 0, 'Presenter Notes column still read');
assert.ok(ql.c.items.every(it => it.answer === undefined && it.note === undefined), 'questions no longer carry answers or notes');
['Answer Text', 'Notes'].forEach(h => assert.ok(B.header('questions').indexOf(h) < 0, h + ' is not exported any more'));
console.log('Meeting Workbook: template, exports, hand-made form and older workbooks OK (' + plan.counts.frames + ' Frames, ' +
  plan.counts.content + ' Content, ' + plan.warnings.length + ' notes)');
