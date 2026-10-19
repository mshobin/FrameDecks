/* Checks the Meeting Workbook: the template imports without errors, and an imported meeting exports and imports again.
 *   node tests/meeting-workbook.test.js
 * Uses the app's own code (app/js/store.js, app/js/meeting-book.js) and SheetJS (app/vendor). */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const X = require(path.join(root, 'app/vendor/xlsx.full.min.js'));
const ls = {};
const ctx = {console, Math, Date, JSON, setTimeout, clearTimeout, Promise, Object, Array, String, Number, isFinite, RegExp, Error,
  location: {protocol: 'file:'}, localStorage: {getItem: k => ls[k] || null, setItem: (k, v) => { ls[k] = v; }},
  document: {addEventListener(){}, hidden: false}, addEventListener(){}, fetch: () => Promise.reject()};
ctx.window = ctx;
vm.createContext(ctx);
['app/js/store.js', 'app/js/meeting-book.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx));
const B = ctx.BSFMeetingBook, Store = ctx.BSFStore;
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

function readBook(wb){            // the same reading as app/js/import-worker.js (all sheets)
  const out = {};
  wb.SheetNames.forEach(n => {
    const rows = X.utils.sheet_to_json(wb.Sheets[n], {header: 1, defval: '', blankrows: true, raw: false});
    let hr = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) if (rows[i].filter(c => String(c).trim() !== '').length >= 2){ hr = i; break; }
    if (!rows.length) return;
    const headers = rows[hr].map((h, j) => String(h).trim() || 'Column ' + (j + 1));
    out[n] = {headers, rows: rows.slice(hr + 1).map(r => headers.map((_, j) => String(r[j] == null ? '' : r[j]).trim())), headerRow: hr + 1};
  });
  return out;
}
const tpl = X.read(fs.readFileSync(path.join(root, 'app/templates/Kingdom-Connect-Meeting-Workbook.xlsx')), {type: 'buffer'});
const book = readBook(tpl);
assert.ok(B.isBook(Object.keys(book)), 'the template is a Meeting Workbook');
['Meeting Overview', 'Frames', 'Content', 'Questions', 'Scriptures'].forEach(n => assert.ok(book[n], 'sheet ' + n));
['frames', 'content', 'questions', 'scriptures'].forEach(k => same(book[B.SHEETS[k].name].headers, B.header(k), 'columns of ' + k));
const plan = B.parse(book, {});
same(plan.errors, [], 'the template imports without errors');
assert.strictEqual(plan.counts.frames, 6);
assert.strictEqual(plan.counts.questions, 3);
const st = Store.defaults();
const made = B.apply(st, plan, {});
assert.strictEqual(made.length, 6);
assert.strictEqual(st.meeting.title, 'Romans · Week 5');
const again = X.read(X.write(B.exportBook(X, st), {type: 'buffer', bookType: 'xlsx'}), {type: 'buffer'});
const plan2 = B.parse(readBook(again), {});
same(plan2.errors, [], 'an exported meeting imports again');
assert.strictEqual(plan2.counts.frames, 6);
assert.strictEqual(plan2.counts.questions, 3);
/* 6.7: an older workbook (v6.5 / 6.6) with Answer Text and Notes columns still imports. The answers and notes are not
   stored on the questions any more; they become talking points in that Frame's teleprompter script. */
const old = JSON.parse(JSON.stringify(book));
old.Frames.headers[5] = 'Presenter Notes';
old.Questions.headers = ['Frame Number', 'Content Name', 'Question Number', 'Label', 'Question Text', 'Answer Text', 'Media', 'Timer', 'Animation', 'Notes'];
old.Questions.rows = old.Questions.rows.map((r, i) => [r[0], r[1], r[2], r[3], r[4], i === 0 ? 'Freedom from guilt because of Christ.' : '', r[5], r[6], r[7], i === 0 ? 'Start with this one.' : '']);
const plan3 = B.parse(old, {});
same(plan3.errors, [], 'an older workbook with Answer and Notes columns imports');
const st3 = Store.defaults(); B.apply(st3, plan3, {});
const qf = st3.scenes.filter(s => s.layers.some(l => l.kind === 'question'))[0], ql = qf.layers.filter(l => l.kind === 'question')[0];
assert.ok(qf.notes.indexOf('Q1 answer: Freedom from guilt because of Christ.') >= 0, 'answer → teleprompter script');
assert.ok(qf.notes.indexOf('Q1 note: Start with this one.') >= 0, 'note → teleprompter script');
assert.ok(qf.notes.indexOf('Allow 10 minutes per question.') >= 0, 'Presenter Notes column still read');
assert.ok(ql.c.items.every(it => it.answer === undefined && it.note === undefined), 'questions no longer carry answers or notes');
['Answer Text', 'Notes'].forEach(h => assert.ok(B.header('questions').indexOf(h) < 0, h + ' is not exported any more'));
console.log('Meeting Workbook: template and export OK (' + plan.counts.frames + ' Frames, ' + plan.counts.content + ' Content, ' + plan.warnings.length + ' notes)');
