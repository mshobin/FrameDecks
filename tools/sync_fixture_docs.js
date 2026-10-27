/* FrameDecks - builds the saved plans behind tests/fixtures/sync/ with the app's own store.js (the Frames are made
 * with KCScenes, then saved and normalized as the program does). Prints JSON; tools/make_sync_fixtures.py writes the
 * fixture files. Not run by the tests. */
'use strict';
const env = require('../tests/helpers/load-store.js')(), Store = env.Store, SC = env.Scenes;
const save = st => JSON.parse(JSON.stringify(st));

// 1. A new installation: the defaults and the starter content, nothing live.
const fresh = Store.normalize(null);

// 2. A real-looking service: several Frames (one with a picture and a video), a template, a script, a library with a
// repeated id, branding, the Meeting Form, a Frame live with a question showing and a birthday on screen.
const st = Store.normalize(null);
st.scenes = [];
const welcome = SC.create(st, 'announcement', {name: 'Welcome'});
const study = SC.create(st, 'bible-study', {name: 'Study: John 3', group: 'Teaching'});
study.notes = 'Read verse 16 slowly.\nPause for questions.';
const media = SC.create(st, 'media', {name: 'Video'});
media.layers[0].c.file = 'Opening video.mp4';
const slide = SC.create(st, 'blank', {name: 'Slide'});
slide.layers.push({id: 'img1', kind: 'image', name: 'Welcome slide', visible: true, locked: false, opacity: 1,
  c: {x: 0.5, y: 0.5, w: 0.5, file: 'Welcome slide.png'}});
const tpl = SC.create(st, 'prayer', {name: 'Prayer template'});
tpl.tpl = true;
st.library.questions = [{id: 'q1', text: 'What stands out?', num: '1', note: '', pair: '', mode: ''},
  {id: 'q1', text: 'A second item with the same id', num: '2', note: '', pair: '', mode: ''}];
st.library.verses = [{id: 'v1', ref: 'John 3:16', version: 'ESV', text: 'For God so loved the world…', pair: 'q1'}];
st.brand = {meeting: 'Tuesday Study', org: 'Grace Church', color: '#c9a04a', logo: '3', lw: 400, lh: 120, auto: true};
st.meeting.title = 'BSF Study'; st.meeting.date = '2026-10-27'; st.meeting.presenter = 'Shobin';
st.question.transition = 'rise';
SC.take(st, study.id, 'cut');
st.question.text = 'What does this passage reveal about God?'; st.question.visible = true;
st.birthday.name = 'Ruth'; st.birthday.greeting = 'Happy birthday, Ruth!'; st.birthday.visible = true;
st.rev = 57;
const service = save(st);

// 3. Data saved by an older version (one shared question list before Frames owned their lists).
const older = {rev: 3, question: {text: 'Old question', visible: false}, library: {questions: [{id: 'a', text: 'Old question'}],
  verses: [{id: 'b', ref: 'Psalm 23:1', version: 'KJV', text: 'The Lord is my shepherd'}]},
  scenes: [{id: 'sc_old', name: 'Old Frame', layers: [{id: 'L1', kind: 'question', c: {}}]}], unknownFutureKey: {kept: true}};

const members = [
  {id: 'm1', name: 'Ruth Adams', country: 'Kuwait', phone: '+965 5000 0000', email: 'ruth@example.org', birthDate: '04/02', role: 'Leader'},
  {id: 'm2', name: 'Paul Brown', country: 'India', phone: '', email: '', birthDate: '', role: ''}];

const docs = {
  defaults: {input: null, members: []},
  service: {input: service, members},
  older: {input: older, members: [members[1]]},
};
Object.keys(docs).forEach(k => { docs[k].normalized = Store.normalize(JSON.parse(JSON.stringify(docs[k].input))); });
process.stdout.write(JSON.stringify(docs));
