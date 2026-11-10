/* FrameDecks 26.11.28 - the ready check, before you go live (src/ready_check.py, GET api/app/ready).
 * One calm card: the camera, the light and framing, the microphone, the meeting app, this meeting's scriptures and
 * media, and this PC. Each line says what it found in one sentence and, where there is one, has the one button that
 * fixes it. It never blocks Go Live. In the Studio it sits under Go Live (in the Live Stage column) and in the Command
 * Center's Control above the Go Live switch, as a short line ("Ready check · all good"); the card opens from there.
 * Asking keeps the webcam on for a few seconds so the light and framing can be judged; it is asked only while the card
 * is open (every 2 s) and once when the line is shown, never while live. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !Store.served) return;
var cc = document.body.getAttribute('data-win') === 'spotlight';
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }); });
}
var last = null, dlg = null, timer = 0, live = false;
function load(){ return fetch('api/app/ready', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d){ last = d; paint(); } return d; }).catch(function(){ return null; }); }
function summary(d){
  if (!d) return 'Ready check';
  var fails = d.items.filter(function(i){ return i.state === 'fail'; }).length;
  if (fails) return 'Ready check · ' + fails + ' to fix first';
  if (d.warn) return 'Ready check · ' + d.warn + ' to look at';
  return 'Ready check · all good';
}

/* ---------- the actions ---------- */
function translation(){ var t = ''; try { t = localStorage.getItem('bcc-scr-tr') || ''; } catch(e){} return ['ESV', 'KJV', 'WEB'].indexOf(t) >= 0 ? t : 'ESV'; }
function fetchVerses(btn){
  if (cc || !window.KCCommit){ toast('Open the Studio to fetch the words'); return; }
  var st = Store.get(), want = [];
  SC.order(st).forEach(function(sc){ (sc.layers || []).forEach(function(l){ if (l.kind !== 'scripture' || !l.c || !Array.isArray(l.c.items)) return;
    l.c.items.forEach(function(it){ if (it && String(it.ref || '').trim() && !String(it.text || '').trim() && want.indexOf(it.ref) < 0) want.push(it.ref); }); }); });
  if (!want.length){ load(); return; }
  btn.disabled = true; btn.textContent = 'Fetching…';
  var tr = translation(), got = {};
  Promise.all(want.map(function(ref){
    return fetch('api/scripture?ref=' + encodeURIComponent(ref) + '&tr=' + tr, {cache: 'no-store'}).then(function(r){ return r.json(); })
      .then(function(d){ if (d && !d.error && d.text) got[ref] = d; }).catch(function(){});
  })).then(function(){
    var n = Object.keys(got).length;
    if (!n){ toast('Could not fetch the words. Check the internet connection, or add them by hand.', true); return; }
    return window.KCCommit(function(s){
      s.scenes.forEach(function(sc){ (sc.layers || []).forEach(function(l){ if (l.kind !== 'scripture' || !l.c || !Array.isArray(l.c.items)) return;
        l.c.items.forEach(function(it){ var d = it && got[it.ref]; if (d && !String(it.text || '').trim()){ it.text = d.text; it.version = it.version || d.version || tr; } }); }); });
    }).then(function(){ toast(n + ' scripture' + (n === 1 ? '' : 's') + ' fetched'); });
  }).then(function(){ btn.disabled = false; load(); });
}
var ACT = {
  'close-camera': ['Close it', function(){ post('api/app/guard', {do: 'close-camera'}).then(function(){ setTimeout(load, 1500); }); }],
  'power': ['Battery settings', function(){ post('api/app/guard', {do: 'power'}); }],
  'fetch-verses': ['Fetch the words', function(e){ fetchVerses(e.currentTarget); }]
};

/* ---------- the card ---------- */
var MARK = {ok: '✓', warn: '!', fail: '✕', off: '·'};
function row(i){
  var act = i.action && ACT[i.action];
  return h('li', {cls: 'rc-row rc-' + i.state}, [
    h('span', {cls: 'rc-mark', 'aria-hidden': 'true', text: MARK[i.state] || '·'}),
    h('div', {cls: 'rc-t'}, [h('b', {text: i.label}), h('span', {text: i.text}),
      i.more ? h('ul', {cls: 'rc-more'}, i.more.map(function(t){ return h('li', {text: t}); })) : null]),
    act ? h('button', {cls: 'btn small', type: 'button', text: act[0], onclick: act[1]}) : null]);
}
/* 26.11.30 (release audit L5): the calm top bar keeps Black screen and Emergency inside the Control chip, so the
   Ready check says, once before going live, how to reach them in a hurry. */
function key(k){ return h('kbd', {cls: 'key', text: k}); }
function safety(){
  var SCK = window.KCShortcuts, black = cc ? 'Alt+B' : (SCK && SCK.short ? SCK.short('blackout') : '') || 'K',
      hide = cc ? 'Alt+H' : (SCK && SCK.short ? SCK.short('hideAll') : '') || 'Esc';
  return h('p', {cls: 'hint rc-safe', id: 'rc-safe'}, ['If something goes wrong: ', key(black), ' blacks the screen, ', key(hide),
    ' hides everything, and Control → Emergency screen shows your message.']);
}
function draw(){
  if (!dlg) return;
  var d = last, inner = h('div', {cls: 'kc-dlg-in'}, [h('p', {cls: 'kc-dlg-kicker', text: 'Before you go live'}), h('h2', {id: 'rc-title', text: 'Ready check'}),
    h('p', {cls: 'kc-dlg-sub', text: d ? (d.ready ? (d.warn ? 'Ready, with ' + d.warn + ' thing' + (d.warn === 1 ? '' : 's') + ' worth a look.' : 'Everything looks good.') : 'Fix the red line first, if you can.') : 'Checking…'}),
    h('ul', {cls: 'rc-list', role: 'list'}, d ? d.items.map(row) : []),
    h('p', {cls: 'hint rc-note', text: 'Suggestions only: nothing is changed by itself, and Go Live always works.'}),
    safety(),
    h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn ghost', type: 'button', text: 'Check again', onclick: load}),
      !cc && document.getElementById('cb-take') ? h('button', {cls: 'btn', type: 'button', text: 'Go Live', onclick: function(){ close(); document.getElementById('cb-take').click(); }}) : null,
      h('button', {cls: 'btn primary', type: 'button', text: 'Close', onclick: close})])]);
  dlg.innerHTML = ''; dlg.appendChild(inner);
}
function open(){
  if (!dlg){
    dlg = h('dialog', {cls: 'kc-dlg rc-dlg', id: 'rc-dlg', 'aria-labelledby': 'rc-title'});
    dlg.addEventListener('click', function(e){ if (e.target === dlg) close(); });
    dlg.addEventListener('close', function(){ clearInterval(timer); });
    document.body.appendChild(dlg);
  }
  draw(); if (!dlg.open) dlg.showModal();
  load(); clearInterval(timer); timer = setInterval(load, 2000);
}
function close(){ clearInterval(timer); if (dlg && dlg.open) dlg.close(); }

/* ---------- the short line ---------- */
var line = h('button', {cls: 'rc-line', type: 'button', id: cc ? 'cc-rc-line' : 'rc-line', hidden: 'hidden', 'data-feature': 'ready', onclick: open}, [h('i', {cls: 'rc-dot', 'aria-hidden': 'true'}), h('span', {text: 'Ready check'})]);
function paint(){
  var d = last, fails = d ? d.items.filter(function(i){ return i.state === 'fail'; }).length : 0;
  line.className = 'rc-line' + (d ? (fails ? ' fail' : d.warn ? ' warn' : ' ok') : '');
  line.lastChild.textContent = summary(d);
  line.hidden = live;
  draw();
}
function place(){
  var at = cc ? document.getElementById('cc-golive') : document.getElementById('ls-go');
  if (!at || line.isConnected) return !!at;
  if (cc) at.parentNode.insertBefore(line, at); else at.parentNode.insertBefore(line, at.nextSibling);
  if (!live) load();
  return true;
}
if (!place()){ var mo = new MutationObserver(function(){ if (place()) mo.disconnect(); }); mo.observe(document.body, {childList: true, subtree: true}); }
Store.subscribe(function(st){
  var now = !!(st.live && st.live.scene);
  if (now !== live){ live = now; if (now) close(); else if (line.isConnected) load(); paint(); }
});
window.addEventListener('focus', function(){ if (!live && line.isConnected && !(dlg && dlg.open)) load(); });
window.KCReady = {open: open, state: function(){ return last; }};
})();
