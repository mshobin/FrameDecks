/* FrameDecks 26.11.57 - the stage screen (stage-display.html) for musicians and speakers. It reads the same shared
 * state as every screen (js/store.js) and shows, large: what is on screen now (the song's part, the scripture, the
 * question, or the Frame), what comes next (the song's next part, the next step, question or scripture, or the next
 * Frame), the clock, the time left in this Frame's planned minutes, and a message typed by the person running the
 * meeting (Studio: Settings > How people see it > Projector, TV and OBS, or the Command palette: Message to the stage). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
function $(id){ return document.getElementById(id); }
if (!Store || !SC) return;
var cur = null;
function first(text){ return String(text || '').split('\n').filter(function(x){ return x.trim(); })[0] || ''; }
function now(st){
  var sc = SC.liveScene(st); if (!sc) return {k: 'Off air', t: 'Nothing on screen yet', where: ''};
  var song = SC.liveSong(st);
  if (song){ var it = song.c.items[song.c.at || 0] || {}; return {k: (song.c.song || song.name || 'Song') + ' · ' + (it.label || ''), t: it.text || '', where: sc.name}; }
  if (st.verse && st.verse.visible && String(st.verse.text || '').trim()) return {k: st.verse.ref || 'Scripture', t: st.verse.text, where: sc.name};
  if (st.question && st.question.visible && String(st.question.text || '').trim()) return {k: 'Question', t: st.question.text, where: sc.name};
  if (st.live.deck && st.live.deck.layer) return {k: 'Slides', t: 'Slide ' + (st.live.deck.pos || 1) + ' of ' + (st.live.deck.count || st.live.deck.pages || '?'), where: sc.name};
  var tl = SC.liveText(st)[0];
  return {k: 'On screen', t: tl ? (tl.c.title || tl.c.text || tl.name) : sc.name, where: sc.name};
}
function next(st){
  var sc = SC.liveScene(st);
  if (!sc){ var o = SC.order(st)[0]; return o ? '<b>' + esc(o.name) + '</b>' : ''; }
  var song = SC.liveSong(st);
  if (song && (song.c.at || 0) + 1 < song.c.items.length){ var n = song.c.items[(song.c.at || 0) + 1]; return '<b>' + esc(n.label || 'Next part') + '</b>\n' + esc(first(n.text)); }
  if (SC.flowCan(st, 1)){ var at = SC.flowAt(st) + 1; return '<b>Step ' + (at + 1) + '</b> · ' + esc(SC.flowLabel(sc, at)); }
  if (Store.setting && Store.setting('smartNext') !== false){
    var t = SC.smartNext(st);
    if (t && t.kind !== 'frame'){ var it = SC.items(st, t.kind).filter(function(x){ return x.id === t.id; })[0] || {};
      return '<b>' + esc(t.kind === 'verse' ? (it.ref || 'Scripture') : 'Question') + '</b>\n' + esc(first(it.text)); }
  }
  var nx = SC.neighbour(st, sc.id, 1);
  return nx ? '<b>' + esc(nx.name) + '</b>' : 'The end of the meeting';
}
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
function paint(){
  var st = cur; if (!st) return;
  var n = now(st);
  $('sd-where').textContent = n.where ? n.where : 'Off air';
  $('sd-now-k').textContent = n.k;
  if ($('sd-now').textContent !== n.t) $('sd-now').textContent = n.t;
  var nx = next(st); if ($('sd-next').innerHTML !== nx) $('sd-next').innerHTML = nx;
  var msg = (st.live && st.live.stageMsg) || '';
  $('sd-msg').hidden = !msg; $('sd-msg').textContent = msg;
  tick();
}
function tick(){
  var d = new Date();
  $('sd-clock').textContent = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  var st = cur, sc = st && SC.liveScene(st), left = $('sd-left'), disc = st && SC.discussion && SC.discussion(st);
  if (disc){                                       // 26.11.57 a question's discussion minutes come first
    left.hidden = false; left.classList.toggle('over', disc.left < 0);
    left.textContent = 'Discussion ' + SC.clockText(disc.left) + (disc.left < 0 ? ' over' : ' left');
  } else if (sc && sc.plan && st.live.at){
    var s = Math.round(sc.plan * 60 - (Date.now() - st.live.at) / 1000), over = s < 0, a = Math.abs(s);
    left.hidden = false; left.classList.toggle('over', over);
    left.textContent = (over ? '+' : '') + Math.floor(a / 60) + ':' + ('0' + (a % 60)).slice(-2) + (over ? ' over' : ' left');
  } else left.hidden = true;
}
Store.subscribe(function(st){ cur = st; paint(); });
Store.onAuthFailed = function(){ $('sd-auth').hidden = false; };
Store.start({longPoll: true});
setInterval(tick, 1000);
tick();
})();
