/* FrameDecks 26.11.33 - songs (lyrics split into verses, stepped with Next before the next Frame) and the timing plan
 * (on time / minutes over against each Frame's planned minutes, for the leader only). */
const assert = require('assert');
const env = require('./helpers/load-store.js')();
const SC = env.Scenes || env.KCScenes;
const J = (x) => JSON.parse(JSON.stringify(x));
const N = (s) => JSON.parse(JSON.stringify(env.Store.normalize(JSON.parse(JSON.stringify(s)))));

// lyrics into verses, with labels
const v = J(SC.parseLyrics('Verse 1\nAmazing grace\nhow sweet the sound\n\nChorus\nMy chains are gone\n\n\n[Bridge]\nThe earth\n\nNo label\nline two\n\nV2:\nTwas grace'));
assert.deepStrictEqual(v.map((x) => x.label), ['Verse 1', 'Chorus', 'Bridge', '', 'Verse 2']);
assert.strictEqual(v[0].text, 'Amazing grace\nhow sweet the sound');
assert.strictEqual(v[3].text, 'No label\nline two', 'a verse with no label keeps all its lines');
assert.strictEqual(J(SC.parseLyrics('Chorus')).length, 1, 'a lone word is a verse, not a label');
assert.strictEqual(J(SC.parseLyrics(Array(80).fill('la').join('\n\n'))).length, 60, 'at most 60 verses');

// a song is a text card: the verse on screen is its title and text; the credit on the first and last verse
assert.ok(SC.isText('song'));
const song = SC.cleanLayer({id: 'Ls', kind: 'song', visible: true, c: {song: 'Amazing Grace', credit: 'Public domain', items: v}});
SC.songApply(song, 0);
assert.strictEqual(song.c.title, 'Amazing Grace · Verse 1');
assert.ok(song.c.text.endsWith('\n\nPublic domain'));
SC.songApply(song, 1);
assert.strictEqual(song.c.text, 'My chains are gone', 'no credit in the middle');
SC.songApply(song, 99);
assert.strictEqual(song.c.at, 4, 'clamped to the last verse');

// Next steps the verses of a song on screen, then the Frame
let st = N({scenes: [{id: 'a', name: 'Worship', layers: [J(song)]}, {id: 'b', name: 'Discussion', layers: []}]});
SC.take(st, 'a', 'cut');
assert.strictEqual(st.live.on.Ls, true);
assert.strictEqual(st.scenes[0].layers[0].c.at, 0, 'taking the Frame starts the song at its first verse');
assert.ok(SC.songCan(st, 1)); assert.ok(!SC.songCan(st, -1));
assert.strictEqual(SC.songStep(st, 1), 'Chorus (2 of 5)');
for (let i = 0; i < 3; i++) SC.songStep(st, 1);
assert.ok(!SC.songCan(st, 1), 'after the last verse Next moves to the next Frame');
delete st.live.on.Ls;
assert.ok(!SC.songCan(st, 1), 'a hidden song never holds Next');

// the timing plan
const T0 = 1e12;
st = N({scenes: [{id: 'a', name: 'Welcome', plan: 5, layers: []}, {id: 'b', name: 'Talk', plan: 10, layers: []}, {id: 'c', name: 'End', layers: []}]});
assert.strictEqual(SC.timing(st, T0), null, 'nothing live');
SC.take(st, 'a', 'cut'); st.live.since = T0; st.live.at = T0;
let t = J(SC.timing(st, T0 + 3 * 60e3));
assert.strictEqual(t.state, 'ontime'); assert.strictEqual(t.frame, '3:00 of 5 min');
t = J(SC.timing(st, T0 + 8 * 60e3));
assert.strictEqual(t.label, '3 min over', 'the live Frame ran past its plan');
SC.take(st, 'b', 'cut'); st.live.since = T0; st.live.at = T0 + 3 * 60e3;          // moved on after 3 of its 5 minutes
t = J(SC.timing(st, T0 + 4 * 60e3));
assert.strictEqual(t.label, '2 min ahead');
SC.take(st, 'c', 'cut'); st.live.since = T0; st.live.at = T0 + 20 * 60e3;           // 15 planned before, started at 20
assert.strictEqual(J(SC.timing(st, T0 + 21 * 60e3)).label, '5 min over');
st = N({scenes: [{id: 'a', name: 'No plan', layers: []}]}); SC.take(st, 'a', 'cut');
assert.strictEqual(SC.timing(st), null, 'quiet when no Frame has a plan');
console.log('premium 26.11.33: ok');
