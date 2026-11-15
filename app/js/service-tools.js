/* FrameDecks 26.11.57 - tools for running a whole service.
 * - Themes: one background (a picture or a looping video, dimmed a little) for every Frame with a song, a scripture
 *   or an announcement. Choose it once (Command palette: Themes, or Settings > Meeting & Branding); Apply puts it
 *   behind every such Frame of the meeting shown, and songs added from the Song Library get it too.
 * - Videos set to "Play once, then Next": the Studio knows the clip's length (/api/media/duration), shows the time
 *   left above the Next button and moves on when it ends.
 * - Show a verse: the box above the Next button while live ("Rom 8 28" + Enter) fetches the verse into the live Frame
 *   and puts it on screen; a long passage is split into parts that fit (KCScenes.splitPassage). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, I = window.KCIcon || function(){ return ''; };
if (!Store || !SC || !Store.served) return;
function $(id){ return document.getElementById(id); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function rid(p){ return (p || 'L') + Math.random().toString(36).slice(2, 9); }
var live = null; Store.subscribe(function(st){ live = st; });

/* ---------- Themes ---------- */
var TYPES = [['song', 'Songs', 'music'], ['scripture', 'Scripture', 'book-open'], ['announcement', 'Announcements', 'megaphone']];
var NAME = {song: 'Theme: Songs', scripture: 'Theme: Scripture', announcement: 'Theme: Announcements'};
function themes(){ var t = Store.setting && Store.setting('themes'); return t && typeof t === 'object' ? JSON.parse(JSON.stringify(t)) : {}; }
function saveThemes(t){ return fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({themes: t})}).then(function(){ return Store.loadSettings ? Store.loadSettings() : null; }); }
/* the background layer for one kind (null: no theme for it) */
function layerFor(type){
  var t = themes()[type]; if (!t || !t.file) return null;
  var c = {x: 0.5, y: 0.5, w: 1, h: 1, file: t.file, props: {fit: 'cover'}};
  if (t.kind === 'video') c.loop = true;
  return SC.cleanLayer({id: rid(), kind: t.kind, name: NAME[type], visible: true, opacity: Math.max(0.2, 1 - (t.dim || 0)), c: c});
}
function kindsOf(sc){ var out = {}; sc.layers.forEach(function(l){ if (NAME[l.kind] || l.kind === 'scripture') out[l.kind] = 1; }); return out; }
/* put each theme behind every Frame of the meeting shown that has that kind of Content (the old theme is replaced) */
function apply(){
  var n = 0;
  return window.KCCommit(function(st){
    SC.order(st).forEach(function(sc){
      var has = kindsOf(sc), type = has.song ? 'song' : has.scripture ? 'scripture' : has.announcement ? 'announcement' : '';
      var before = sc.layers.length;
      sc.layers = sc.layers.filter(function(l){ return !/^Theme: /.test(l.name || ''); });
      var l = type && layerFor(type);
      if (l){ sc.layers.push(l); n++; }
      else if (sc.layers.length !== before) n++;
    });
  }).then(function(){ toast(n ? 'Themes applied to ' + n + (n === 1 ? ' Frame.' : ' Frames.') : 'No Frame here has songs, scripture or announcements yet.'); });
}
var tdlg;
function open(){
  if (!tdlg){ tdlg = h('dialog', {cls: 'kc-dlg th-dlg', 'aria-labelledby': 'th-title'}); tdlg.addEventListener('click', function(e){ if (e.target === tdlg) tdlg.close(); }); document.body.appendChild(tdlg); }
  paint();
  if (!tdlg.open) tdlg.showModal();
}
function paint(){
  var t = themes();
  tdlg.innerHTML = '';
  var rows = TYPES.map(function(x){
    var cur = t[x[0]] || null;
    var dim = h('input', {type: 'range', min: '0', max: '80', step: '5', value: String(Math.round(((cur && cur.dim) || 0.3) * 100)), 'aria-label': 'Dim the ' + x[1] + ' background'});
    dim.addEventListener('change', function(){ var tt = themes(); if (tt[x[0]]){ tt[x[0]].dim = +dim.value / 100; saveThemes(tt); } });
    function choose(kind){
      window.KCAddContent.pickFile(kind).then(function(f){ if (!f) return; var tt = themes(); tt[x[0]] = {file: f, kind: kind, dim: +dim.value / 100}; saveThemes(tt).then(paint); });
    }
    return h('div', {cls: 'th-row'}, [h('span', {cls: 'th-ic', html: I(x[2], 18)}), h('div', {cls: 'th-t'}, [h('b', {text: x[1]}), h('small', {text: cur ? (cur.kind === 'video' ? 'Video: ' : 'Picture: ') + cur.file : 'No background yet'})]),
      h('label', {cls: 'th-dim'}, ['Dim ', dim]),
      h('button', {cls: 'btn small', type: 'button', html: I('image', 14) + ' Picture…', onclick: function(){ choose('image'); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('film', 14) + ' Video…', onclick: function(){ choose('video'); }}),
      cur ? h('button', {cls: 'btn small quiet', type: 'button', text: 'Remove', onclick: function(){ var tt = themes(); delete tt[x[0]]; saveThemes(tt).then(paint); }}) : null]);
  });
  tdlg.appendChild(h('div', {cls: 'kc-dlg-in'}, [h('p', {cls: 'kc-dlg-kicker', text: 'Themes'}), h('h2', {id: 'th-title', text: 'One look for each kind of Content'}),
    h('p', {cls: 'kc-dlg-sub', text: 'A picture or a looping video behind every song, scripture or announcement. Apply puts it behind each such Frame of this meeting; songs added later get it too.'})]
    .concat(rows, [h('div', {cls: 'kc-dlg-foot'}, [h('span', {cls: 'mi-spacer'}), h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: function(){ tdlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', html: I('check', 15) + ' Apply to this meeting', onclick: function(){ apply().then(function(){ tdlg.close(); }); }})])])));
}

/* ---------- Videos: play once, then Next; the time left ---------- */
var lengths = {}, movedFor = '';
function length(file){
  if (!(file in lengths)){ lengths[file] = 0; fetch('api/media/duration?name=' + encodeURIComponent(file), {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ lengths[file] = d.seconds || 0; }).catch(function(){}); }
  return lengths[file];
}
function clip(st){
  var sc = SC.liveScene(st); if (!sc) return null;
  return sc.layers.filter(function(l){ return l.kind === 'video' && l.visible && l.c && l.c.file && l.c.next; })[0] || null;
}
var leftEl = null;
function videoTick(){
  var st = live, v = st && clip(st);
  if (!leftEl){ var go = $('ls-go'); if (go){ leftEl = h('p', {cls: 'vid-left', id: 'vid-left', role: 'status', hidden: 'hidden'}); go.parentNode.insertBefore(leftEl, go); } }
  if (!v){ if (leftEl) leftEl.hidden = true; return; }
  var secs = length(v.c.file); if (!secs){ if (leftEl) leftEl.hidden = true; return; }
  var left = Math.ceil(secs - (Date.now() - st.live.at) / 1000);
  if (leftEl){ leftEl.hidden = false; var a = Math.max(0, left); leftEl.textContent = (v.name || 'Video') + ': ' + Math.floor(a / 60) + ':' + ('0' + (a % 60)).slice(-2) + ' left, then Next'; }
  var key = st.live.seq + ':' + v.id;
  if (left <= 0 && movedFor !== key){ movedFor = key; if (window.KCWorkspace) window.KCWorkspace.step(1); }
}
if (window.KCTick) window.KCTick.every(500, videoTick, true); else setInterval(videoTick, 500);

/* ---------- Discussion minutes and breakout rooms ---------- */
/* A question with discussion minutes (its editor's Minutes field) counts down above the Next button from the moment
   it is shown, and says once when the time is up. Breakout puts a countdown on the screen (top) for those minutes,
   with the question kept visible, so groups talking in breakout rooms or round tables see both; phones following the
   meeting see the question too. */
var discEl = null, discDone = '';
function breakout(){
  var st = live, d = st && SC.discussion(st), mins = d ? Math.max(1, Math.round(d.minutes)) : 5;
  return Store.update(function(n){
    var sc = SC.liveScene(n); if (!sc) return;
    var l = sc.layers.filter(function(x){ return x.kind === 'countdown' && x.name === 'Breakout'; })[0];
    if (!l){ l = SC.cleanLayer({id: rid(), kind: 'countdown', name: 'Breakout', visible: true, opacity: 1, c: {title: 'Back together in', text: 'Time to come back together', mode: 'duration', minutes: mins, pos: 'top', scale: 1, label: true}}); sc.layers.push(l); }
    else l.c.minutes = mins;
    n.live.on[l.id] = true; n.live.cd[l.id] = Date.now();
  }).then(function(){ toast('Breakout: ' + mins + ' minutes on screen, with the question.'); });
}
function discTick(){
  var st = live, d = st && SC.discussion(st);
  if (!discEl){ var go = $('ls-go'); if (go){ discEl = h('p', {cls: 'vid-left disc-left', id: 'disc-left', role: 'status', hidden: 'hidden'}, [h('span', {cls: 'disc-t'}),
    h('button', {cls: 'btn small quiet', type: 'button', text: 'Breakout', title: 'A countdown on screen for the discussion, with the question kept visible', onclick: breakout})]); go.parentNode.insertBefore(discEl, go); } }
  if (!discEl) return;
  if (!d){ discEl.hidden = true; return; }
  discEl.hidden = false; discEl.classList.toggle('over', d.left < 0);
  discEl.firstChild.textContent = d.left < 0 ? 'Discussion: ' + SC.clockText(d.left) + ' over' : 'Discussion: ' + SC.clockText(d.left) + ' left';
  if (d.left <= 0 && discDone !== d.key){ discDone = d.key; toast('Discussion time is up.'); }
}
if (window.KCTick) window.KCTick.every(1000, discTick, true); else setInterval(discTick, 1000);

/* ---------- Show a verse (while live) ---------- */
var qv = null;
function buildVerseBox(){
  var go = $('ls-go'); if (!go || $('qv-form')) return;
  var input = h('input', {type: 'search', id: 'qv-in', placeholder: 'Show a verse: Rom 8 28', 'aria-label': 'Show a verse on screen now', autocomplete: 'off'});
  qv = h('form', {cls: 'qv-form', id: 'qv-form', hidden: 'hidden'}, [input]);
  qv.addEventListener('submit', function(e){ e.preventDefault(); showVerse(input.value).then(function(ok){ if (ok) input.value = ''; }); });
  input.addEventListener('keydown', function(e){ e.stopPropagation(); });
  go.parentNode.insertBefore(qv, go);
}
function showVerse(text){
  var S = window.KCScripture, ref = S && S.parse ? (S.parse(text) || String(text || '').trim()) : String(text || '').trim();
  if (!ref) return Promise.resolve(false);
  var tr = S && S.translation ? S.translation() || 'ESV' : 'ESV';
  return fetch('api/scripture?ref=' + encodeURIComponent(ref) + '&tr=' + tr, {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    if (d.error){ toast(d.error, true); return false; }
    var parts = SC.splitPassage(d.text);
    return Store.update(function(n){
      var sc = SC.liveScene(n); if (!sc) return;
      var l = SC.first(sc, 'scripture');
      if (!l){ l = SC.cleanLayer({id: rid(), kind: 'scripture', name: 'Scripture', visible: true, opacity: 1, c: {items: []}}); sc.layers.unshift(l); }
      if (!Array.isArray(l.c.items)) l.c.items = [];
      var first = null;
      parts.forEach(function(t, i){ var it = {id: rid('v'), ref: d.ref + (parts.length > 1 ? ' (' + (i + 1) + '/' + parts.length + ')' : ''), version: d.version || tr, text: t}; l.c.items.push(it); if (!first) first = it; });
      if (first) SC.showItem(n, 'verse', first.id);
    }).then(function(){ toast(d.ref + ' is on screen' + (parts.length > 1 ? ' (part 1 of ' + parts.length + '; Next shows the rest)' : '') + '.'); return true; });
  }).catch(function(){ toast('Could not fetch that verse.', true); return false; });
}
buildVerseBox();
Store.subscribe(function(st){ if (qv) qv.hidden = !(st && st.live && st.live.scene); });

/* Settings > Meeting & Branding: where Themes opens */
(function(){
  var sec = $('sec-meeting'); if (!sec || $('themes-box')) return;
  var box = h('section', {cls: 'box', id: 'themes-box', 'aria-labelledby': 'themes-h'}, [h('div', {cls: 'box-head'}, [h('h2', {id: 'themes-h', text: 'Themes'})]),
    h('p', {cls: 'hint', text: 'One background (a picture or a looping video) behind every song, scripture or announcement.'}),
    h('div', {cls: 'actions'}, [h('button', {cls: 'btn small', type: 'button', html: I('palette', 14) + ' Choose themes…', onclick: open})])]);
  var head = sec.querySelector('.s-head'); sec.insertBefore(box, head ? head.nextSibling : sec.firstChild);
})();
window.KCThemes = {open: open, apply: apply, layerFor: layerFor};
window.KCQuickVerse = {show: showVerse};
window.KCDiscussion = {breakout: breakout};
})();
