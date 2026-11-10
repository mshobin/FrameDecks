/* FrameDecks 26.11.22 - soft sounds for the presses that matter (Settings → Start here → Running the meeting; off by default):
 * Go Live, Next, and a light tap for Hide all / Black screen. Made with Web Audio (no sound files), only in the window
 * that was pressed, very quiet, and never while the setting is off. */
(function(){
'use strict';
var ctx = null;
function on(){ var S = window.KCStore; return !!(S && S.setting && S.setting('uiSounds')); }
function tone(freq, at, dur, vol){
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + dur + 0.02);
}
var SOUNDS = {
  live: function(t){ tone(523.25, t, 0.32, 0.05); tone(659.25, t + 0.06, 0.32, 0.04); tone(783.99, t + 0.12, 0.4, 0.035); },
  next: function(t){ tone(880, t, 0.12, 0.035); tone(1174.66, t + 0.05, 0.14, 0.025); },
  tap: function(t){ tone(1320, t, 0.05, 0.02); }
};
function play(kind){
  if (!on() || !SOUNDS[kind]) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[kind](ctx.currentTime + 0.01);
  } catch(e){}
}
window.KCSound = {play: play};
})();
