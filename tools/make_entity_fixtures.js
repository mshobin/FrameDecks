/* FrameDecks - writes tests/fixtures/entities/*.json: documents, normalized by app/js/store.js, and how
 * app/js/entities.js splits them. tests/entities.test.js and the Dart port (framedecks_app/test/engine/entities_test.dart)
 * both check against them, so the two engines split and join documents the same way.
 *   node tools/make_entity_fixtures.js */
'use strict';
const fs = require('fs'), path = require('path');
const env = require('../tests/helpers/load-store.js')();
const E = require('../app/js/entities.js');
const out = path.join(__dirname, '..', 'tests', 'fixtures', 'entities');

const CASES = {
  // a new install: the built-in sample lists, no Frames
  'defaults': {},
  // a file saved before Decks: Frames without decks, a template, a repeated library id, live state and the cards' text
  'before-decks': {
    rev: 41, v6: true, profile: 'sunday',
    scenes: [
      {id: 'sc_welcome', name: 'Welcome', group: 'Romans', created: 1, modified: 2,
        layers: [{id: 'L1', kind: 'announcement', name: 'Welcome', c: {title: 'Welcome', text: 'Glad you are here'}}]},
      {id: 'sc_study', name: 'Bible Study', group: 'Romans', created: 3, modified: 4,
        layers: [{id: 'L2', kind: 'question', c: {items: [{id: 'q_a', text: 'What stands out?'}], itemId: 'q_a'}},
                 {id: 'L3', kind: 'scripture', c: {items: [{id: 'v_a', ref: 'Romans 8:1', text: 'There is therefore now no condemnation'}]}}]},
      {id: 'sc_tpl', name: 'My template', tpl: true, layers: [{id: 'L4', kind: 'countdown', c: {minutes: 5}}]}],
    library: {questions: [{id: 'q1', text: 'One'}, {id: 'q1', text: 'One again'}, {id: 'q2', text: 'Two'}],
              verses: [{id: 's1', ref: 'Psalm 23:1', version: 'ESV', text: 'The Lord is my shepherd'}]},
    live: {scene: 'sc_study', seq: 7, at: 1700000000000, on: {}},
    question: {text: 'What stands out?', visible: true, itemId: 'q_a', label: 'Discussion', transition: 'rise'},
    birthday: {name: 'Ann', greeting: 'Happy birthday, Ann!', visible: false, label: 'Birthday'},
    brand: {meeting: 'Tuesday Study', org: 'Grace Church', color: '#1f3a6d'},
    meeting: {title: 'Romans · Week 5', presenter: 'Sam', attendees: '24'},
    layout: {qWidth: 80}
  },
  // Decks: a Frame with three Decks, the second one on screen
  'decks': {
    rev: 5, v6: true,
    scenes: [
      {id: 'sc_d', name: 'Study', decks: [{id: 'd1', name: 'Read'}, {id: 'd_talk', name: 'Discuss'}, {id: 'd_pray', name: 'Pray'}],
        layers: [{id: 'A', kind: 'scripture', deck: 'd1', c: {items: [{id: 'v1', ref: 'John 3:16', text: 'For God so loved'}]}},
                 {id: 'B', kind: 'question', deck: 'd_talk', c: {items: [{id: 'qq', text: 'Why?'}]}},
                 {id: 'C', kind: 'prayer', deck: 'd_pray', c: {title: 'Pray', text: 'Amen'}},
                 {id: 'D', kind: 'camera', deck: 'gone', c: {}}]},
      {id: 'sc_e', name: 'End', layers: []}],
    live: {scene: 'sc_d', deck: 'd_talk', seq: 3, on: {}}
  }
};

fs.mkdirSync(out, {recursive: true});
Object.keys(CASES).forEach(name => {
  const input = CASES[name], normalized = env.Store.normalize(JSON.parse(JSON.stringify(input)));
  const split = E.split(normalized);
  const back = E.join(split.entities, split.local);
  if (E.canon(back) !== E.canon(normalized)){ diff(normalized, back, name); throw new Error(name + ": join(split(doc)) is not doc"); }
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({name, input, normalized, split}, null, 1) + '\n');
  console.log('wrote', name + '.json', split.entities.length, 'entities');
});
function diff(a, b, p){
  if (E.canon(a) === E.canon(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object'){ new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diff(a[k], b[k], p + '.' + k)); return; }
  console.error('differs at', p, JSON.stringify(a), '|', JSON.stringify(b));
}
