/* FrameDecks 26.11.57 - the Song Library's readers and layout (app/js/songs-lib.js). Run: node tests/run.js */
const L = require('../app/js/songs-lib.js'), assert = require('assert');

// plain text with labels and details
let s = L.fromText('Title: Amazing Grace\nAuthor: John Newton\nCCLI: 22025\nCopyright: Public Domain\n\n[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\nChorus:\nMy chains are gone\n\nV2\nTwas grace that taught\n\nOrder: V1 C V2 C');
assert.strictEqual(s.title, 'Amazing Grace');
assert.strictEqual(s.author, 'John Newton');
assert.strictEqual(s.ccli, '22025');
assert.strictEqual(s.copyright, 'Public Domain');
assert.deepStrictEqual(s.sections.map(x => x.label), ['Verse 1', 'Chorus', 'Verse 2']);
assert.deepStrictEqual(s.order, ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
assert.deepStrictEqual(L.arrange(s).map(x => x.label), ['Verse 1', 'Chorus', 'Verse 2', 'Chorus'], 'the chorus repeats without copying');
assert.strictEqual(L.arrange(s)[1].text, 'My chains are gone');

// no labels: blank lines split, verses numbered
s = L.fromText('Line one\nLine two\n\nLine three\n\n\nLine four');
assert.deepStrictEqual(s.sections.map(x => x.label), ['Verse 1', 'Verse 2', 'Verse 3']);
assert.deepStrictEqual(L.arrange(s).length, 3, 'no order: as written');

// ChordPro
s = L.fromChordPro('{title: How Great}\n{artist: Someone}\n{ccli: 1234}\n{key: G}\n\n{comment: Verse 1}\n[G]O Lord my [C]God\nWhen I in awesome wonder\n\n{start_of_chorus}\nThen sings my [D]soul\n{end_of_chorus}\n# a note\n{start_of_bridge}\nBridge words\n{end_of_bridge}');
assert.strictEqual(s.title, 'How Great');
assert.strictEqual(s.ccli, '1234');
assert.strictEqual(s.key, 'G');
assert.deepStrictEqual(s.sections.map(x => x.label), ['Verse 1', 'Chorus', 'Bridge']);
assert.strictEqual(s.sections[0].text, 'O Lord my God\nWhen I in awesome wonder', 'chords removed');

// OpenLyrics
s = L.fromOpenLyrics('<?xml version="1.0"?><song xmlns="http://openlyrics.info/namespace/2009/song"><properties><titles><title>Holy Holy</title></titles><authors><author>Heber</author></authors><ccliNo>1156</ccliNo><copyright>Public Domain</copyright><verseOrder>v1 c v2 c</verseOrder></properties><lyrics><verse name="v1"><lines>Holy holy holy<br/>Lord God</lines></verse><verse name="c"><lines>Early in the morning</lines></verse><verse name="v2"><lines>Holy &amp; true</lines></verse></lyrics></song>');
assert.strictEqual(s.title, 'Holy Holy');
assert.strictEqual(s.author, 'Heber');
assert.strictEqual(s.ccli, '1156');
assert.deepStrictEqual(s.sections.map(x => x.label), ['Verse 1', 'Chorus', 'Verse 2']);
assert.strictEqual(s.sections[0].text, 'Holy holy holy\nLord God');
assert.strictEqual(s.sections[2].text, 'Holy & true');
assert.deepStrictEqual(L.arrange(s).map(x => x.label), ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);

// a PowerPoint's slides
s = L.fromSlides([{title: 'Blessed Assurance', text: ''}, {title: 'Verse 1', text: 'Blessed assurance'}, {title: '', text: 'This is my story'}, {title: 'Chorus', text: 'This is my song'}], 'Blessed.pptx');
assert.strictEqual(s.title, 'Blessed');
assert.deepStrictEqual(s.sections.map(x => x.label), ['Verse 1', 'Verse 2', 'Chorus'], 'an unlabelled slide after Verse 1 is Verse 2');
s = L.fromSlides([{title: 'Blessed Assurance', text: ''}, {title: '', text: 'One'}], '');
assert.strictEqual(s.title, 'Blessed Assurance', 'a first slide with a title and no words names the song');

// picking the reader
assert.strictEqual(L.fromFile('song.cho', '{title: A}\nwords').title, 'A');
assert.strictEqual(L.fromFile('song.xml', '<song><properties><titles><title>B</title></titles></properties><lyrics><verse name="v1"><lines>x</lines></verse></lyrics></song>').title, 'B');
assert.strictEqual(L.fromFile('My Song.txt', 'Just words').title, 'My Song');

// jump keys
const items = [{label: 'Verse 1'}, {label: 'Chorus'}, {label: 'Verse 2'}, {label: 'Chorus'}, {label: 'Bridge'}, {label: 'Chorus'}];
assert.strictEqual(L.jumpTo(items, 0, 'c'), 1);
assert.strictEqual(L.jumpTo(items, 1, 'c'), 3, 'the next chorus after the one on screen');
assert.strictEqual(L.jumpTo(items, 3, 'b'), 4);
assert.strictEqual(L.jumpTo(items, 4, '2'), 2);
assert.strictEqual(L.jumpTo(items, 0, 'p'), -1, 'no pre-chorus');
assert.strictEqual(L.jumpTo(items, 0, 'x'), -1);

// credit line
assert.strictEqual(L.credit({ccli: '22025', copyright: '© Public Domain'}, '123456'), 'CCLI Song # 22025 · © Public Domain · CCLI Licence # 123456');
assert.strictEqual(L.credit({}, ''), '');
assert.deepStrictEqual(L.parseOrder('v1, c  v2 b'), ['Verse 1', 'Chorus', 'Verse 2', 'Bridge']);
console.log('songs-lib: ok');
