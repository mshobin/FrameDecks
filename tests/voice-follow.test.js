/* FrameDecks 26.11 - Follow my voice: the words of a script and the matcher that follows the reader
 * (app/js/voice-follow.js). The real speech engine is tested end to end by tools/voice_e2e.py. */
'use strict';
const assert = require('assert');
global.window = {};
require('../app/js/voice-follow.js');
const V = window.KCVoiceFollow;

// words as the engine hears them: markup and cues are not said; numbers are words
assert.deepStrictEqual(V.tokens('# Welcome!\n- Read **John 3:16** [PAUSE] now.'), ['welcome', 'read', 'john', 'three', 'sixteen', 'now']);
assert.deepStrictEqual(V.tokens('Don’t stop --- it’s 2026'), ["don't", 'stop', "it's", 'twenty', 'twenty', 'six']);
assert.deepStrictEqual(V.numberWords('1500'), ['fifteen', 'hundred']);
assert.deepStrictEqual(V.numberWords('2000'), ['two', 'thousand']);
assert.deepStrictEqual(V.numberWords('116'), ['one', 'hundred', 'sixteen']);
assert.deepStrictEqual(V.numberWords('1905'), ['nineteen', 'oh', 'five']);
assert.deepStrictEqual(V.norm('3rd'), ['three']);

const script = V.tokens('Good evening everyone and welcome to our study tonight. We are going to read together from ' +
  'the gospel of John chapter three. Take a moment to open your Bible and find the passage. When you are ready we ' +
  'will begin with a short prayer. Lord we thank you for this evening.');

// reading along moves it forward, phrase by phrase, partial results included
let m = V.matcher(script);
m.hear('good evening', false);
m.hear('good evening everyone and welcome', false);
m.hear('good evening everyone and welcome to our study tonight', true);
assert.strictEqual(script[m.pos() - 1], 'tonight');
m.hear('we are going to read together', true);
assert.strictEqual(script[m.pos() - 1], 'together');

// a misheard or skipped word does not stop it
m.hear('from the gospel john chapter three', true);
assert.strictEqual(script[m.pos() - 1], 'three');

// off-script talk (only little words and words that are not here) holds it still
const at = m.pos();
m.hear('and the and of the', true);
assert.strictEqual(m.pos(), at, 'little words alone never move it');
m.hear('the weather is cold', true);
assert.strictEqual(m.pos(), at);

// skipping a sentence ahead is found (within the look-ahead)
m.hear('when you are ready we will begin', true);
assert.strictEqual(script[m.pos() - 1], 'begin');

// it never goes back on its own, even if an earlier phrase is said again
const later = m.pos();
m.hear('good evening everyone and welcome', true);
assert.strictEqual(m.pos(), later, 'forward only');

// "evening" also appears near the end: a repeated word far ahead does not make it jump
m = V.matcher(script);
m.hear('good evening everyone', true);
assert.ok(m.pos() <= 3, 'stays at the start: ' + m.pos());

// after scrolling by hand it carries on from the new place
m.anchor(script.indexOf('lord'));
m.hear('lord we thank you', true);
assert.strictEqual(script[m.pos() - 1], 'you');

// an empty script or nothing heard: nothing happens
assert.strictEqual(V.matcher([]).hear('hello', true), 0);
assert.strictEqual(V.matcher(script).hear('', true), 0);

// cheap: a long script, many updates
const long = [];
for (let i = 0; i < 300; i++) long.push.apply(long, script);
m = V.matcher(long);
const t = Date.now();
for (let i = 0; i < 2000; i++) m.hear('we are going to read together from the gospel', i % 5 === 0);
assert.ok(Date.now() - t < 500, 'matching stays cheap: ' + (Date.now() - t) + ' ms');
console.log('voice-follow: ok');
