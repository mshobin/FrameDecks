/* FrameDecks 26.11.23 - the meeting summary.
 * When the meeting goes off live, the Studio offers a one-page summary: how long it ran, each Frame and how long it
 * was on (against the plan), the questions asked and the scriptures read, and what people sent (Memory Cards shown,
 * prayer requests). Print / Save as PDF, Copy, or Email. Past meetings stay on this PC (src/meeting_log.py). */
(function(){
'use strict';
var Store = window.KCStore;
if (!Store || !Store.served) return;
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
function hm(ms){ var m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60 < 10 ? '0' : '') + (m % 60) + ' min' : (m < 1 ? 'under a minute' : m + ' min'); }
function when(t){
  var d = new Date(t);
  return d.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}) + ' · ' + d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
}
function clock(t){ return new Date(t).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'}); }
function get(url){ return fetch(url, {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error('That did not work'); return r; }); }

var dlg = null, cur = null;
function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg sum-dlg', id: 'sum-dlg', 'aria-labelledby': 'sum-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
  document.body.appendChild(dlg);
  return dlg;
}
function stat(n, label){ return h('div', {cls: 'sum-stat'}, [h('b', {text: String(n)}), h('span', {text: label})]); }

/* the page itself: the same for the dialog and for printing */
function page(s){
  var stats = h('div', {cls: 'sum-stats'}, [stat(s.frames.length, s.frames.length === 1 ? 'Frame' : 'Frames'),
    stat(s.questionCount, s.questionCount === 1 ? 'question' : 'questions'), stat(s.verseCount, s.verseCount === 1 ? 'scripture' : 'scriptures'),
    stat(s.memory, 'Memory Cards shown'), stat(s.prayer.received || 0, (s.prayer.received === 1 ? 'prayer request' : 'prayer requests'))]);
  var list = h('ol', {cls: 'sum-flow'});
  s.frames.forEach(function(f){
    var over = f.planMin && f.ms > f.planMin * 60000 * 1.1;
    var kids = [h('div', {cls: 'sum-f-head'}, [h('span', {cls: 'sum-f-at', text: clock(f.at)}), h('b', {text: f.name}),
      h('span', {cls: 'sum-f-time' + (over ? ' over' : ''), text: hm(f.ms) + (f.planMin ? ' of ' + f.planMin + ' planned' : '')})])];
    f.questions.forEach(function(q){ kids.push(h('p', {cls: 'sum-q'}, [h('span', {cls: 'sum-tag', text: 'Question'}), q.text])); });
    f.verses.forEach(function(v){
      kids.push(h('p', {cls: 'sum-v'}, [h('span', {cls: 'sum-tag', text: v.label}), v.text && v.text !== v.label ? v.text : '']));
    });
    list.appendChild(h('li', null, kids));
  });
  if (!s.frames.length) list.appendChild(h('li', {cls: 'sum-empty', text: 'Nothing was put on screen in this meeting.'}));
  return [h('p', {cls: 'kc-dlg-kicker', text: 'Meeting summary'}), h('h2', {id: 'sum-title', text: s.meeting}),
    h('p', {cls: 'kc-dlg-sub', text: when(s.started) + ' · ' + hm(s.ms)}), stats, list];
}

function text(){ return get('api/summary?format=text&run=' + encodeURIComponent(cur.id)).then(function(r){ return r.text(); }); }
function copy(){
  text().then(function(t){ return navigator.clipboard.writeText(t); }).then(function(){ toast('Summary copied'); })
    .catch(function(){ toast('Could not copy the summary', true); });
}
function email(){
  text().then(function(t){
    if (t.length > 1800) t = t.slice(0, 1800) + '\n…\n(The full summary: Print / Save as PDF in FrameDecks.)';
    var url = 'mailto:?subject=' + encodeURIComponent('Meeting summary: ' + cur.meeting) + '&body=' + encodeURIComponent(t);
    return fetch('api/app/open-external', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: url})})
      .then(function(r){ return r.json(); }).then(function(d){ if (!d.opened) location.href = url; });
  }).catch(function(){ toast('Could not open your email app', true); });
}
function print(){
  var old = document.getElementById('sum-print'); if (old) old.remove();
  var sheet = h('div', {id: 'sum-print', 'aria-hidden': 'true'}, page(cur));
  document.body.appendChild(sheet); document.body.classList.add('kc-print-summary');
  var done = function(){ document.body.classList.remove('kc-print-summary'); sheet.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  if (dlg && dlg.open) dlg.close();
  setTimeout(function(){ window.print(); setTimeout(done, 1500); }, 30);
}

function show(s, runs){
  cur = s;
  var d = dialog(); d.innerHTML = '';
  var pick = null;
  if (runs && runs.length > 1){
    pick = h('select', {cls: 'sum-pick', 'aria-label': 'Show another meeting'});
    runs.forEach(function(r){ var o = h('option', {value: r.id, text: (r.meeting || 'Meeting') + ' · ' + new Date(r.started).toLocaleDateString(undefined, {day: 'numeric', month: 'short'}) + ', ' + clock(r.started)}); if (r.id === s.id) o.selected = true; pick.appendChild(o); });
    pick.addEventListener('change', function(){ open(pick.value); });
  }
  var foot = h('div', {cls: 'kc-dlg-foot sum-foot'}, [pick ? h('label', {cls: 'sum-past'}, ['Past meetings ', pick]) : null,
    h('button', {cls: 'btn ghost', type: 'button', text: 'Copy', onclick: copy}),
    h('button', {cls: 'btn ghost', type: 'button', text: 'Email', onclick: email}),
    h('button', {cls: 'btn', type: 'button', text: 'Print / Save as PDF', onclick: print}),
    h('button', {cls: 'btn primary', type: 'button', text: 'Close', onclick: function(){ d.close(); }})]);
  d.appendChild(h('div', {cls: 'kc-dlg-in'}, page(s).concat([foot])));
  if (!d.open) d.showModal();
}
function open(run){
  return Promise.all([get('api/summary?run=' + encodeURIComponent(run || 'latest')).then(function(r){ return r.json(); }),
                      get('api/summary/list').then(function(r){ return r.json(); }).catch(function(){ return {runs: []}; })])
    .then(function(a){
      if (!a[0].summary){ toast('No meeting summary yet: it is made while a Frame is live'); return; }
      show(a[0].summary, a[1].runs);
    }).catch(function(e){ toast(e.message, true); });
}
window.KCSummary = {open: open};

/* off live: offer the summary (a meeting of at least a minute) */
var wasLive = '', since = 0;
Store.subscribe(function(st){
  var sid = (st.live && st.live.scene) || '';
  if (sid && !wasLive) since = Date.now();
  if (!sid && wasLive && Date.now() - since > 60000 && window.KCActions && KCActions.toastAction){
    setTimeout(function(){ KCActions.toastAction('Meeting ended · ' + hm(Date.now() - since), 'Summary', function(){ open('latest'); }); }, 900);
  }
  wasLive = sid;
});
})();
