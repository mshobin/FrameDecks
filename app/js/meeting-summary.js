/* FrameDecks 26.11.23 - the meeting summary.
 * When the meeting goes off live, the Studio offers a one-page summary: how long it ran, each Frame and how long it
 * was on (against the plan), the questions asked and the scriptures read, and what people sent (Memory Cards shown,
 * prayer requests). Print / Save as PDF, Copy, or Email. Past meetings stay on this PC (src/meeting_log.py).
 * 26.11.24 a second view: the sermon notes for members, shareable on members' phones. */
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

var dlg = null, cur = null;   // 26.11.24 view: the summary or the sermon notes (below)
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

/* 26.11.24 the sermon notes: made from what was presented (each Frame's Teleprompter script, the scriptures in full,
 * the questions to reflect on); nothing to fill in. Print / Save as PDF, Copy, Email, or share with members' phones. */
var view = 'summary', withScript = true, notes = null;
function notesPage(n){
  var kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Sermon notes'}), h('h2', {id: 'sum-title', text: n.title}),
    h('p', {cls: 'kc-dlg-sub', text: new Date(n.date).toLocaleDateString(undefined, {dateStyle: 'full'}) + (n.presenter ? ' · ' + n.presenter : '')})];
  if (!n.sections.length) kids.push(h('p', {cls: 'sum-empty', text: 'Nothing to put in the notes yet: they gather each Frame’s script, scriptures and questions.'}));
  n.sections.forEach(function(sec){
    var box = h('section', {cls: 'sn-sec'}, [h('h3', {text: sec.frame})]);
    sec.script.split(/\n\s*\n/).forEach(function(para){ if (para.trim()) box.appendChild(h('p', {cls: 'sn-p', text: para.trim()})); });
    sec.verses.forEach(function(v){ box.appendChild(h('blockquote', {cls: 'sn-verse'}, [v.text ? h('p', {text: v.text}) : null, h('cite', {text: v.ref})])); });
    if (sec.questions.length) box.appendChild(h('div', {cls: 'sn-reflect'}, [h('p', {cls: 'sn-reflect-h', text: 'To reflect on'}), h('ul', null, sec.questions.map(function(q){ return h('li', {text: q}); }))]));
    kids.push(box);
  });
  return kids;
}
function current(){ return view === 'notes' && notes ? notesPage(notes) : page(cur); }
function textUrl(){
  return view === 'notes' ? 'api/summary/notes?format=text&script=' + (withScript ? 1 : 0) + '&run=' + encodeURIComponent(cur.id)
    : 'api/summary?format=text&run=' + encodeURIComponent(cur.id);
}
function what(){ return view === 'notes' ? 'Sermon notes' : 'Summary'; }
function text(){ return get(textUrl()).then(function(r){ return r.text(); }); }
function copy(){
  var w = what();
  text().then(function(t){ return navigator.clipboard.writeText(t); }).then(function(){ toast(w + ' copied'); })
    .catch(function(){ toast('Could not copy the ' + w.toLowerCase(), true); });
}
function email(){
  var w = what();
  text().then(function(t){
    if (t.length > 1800) t = t.slice(0, 1800) + '\n…\n(The full ' + w.toLowerCase() + ': Print / Save as PDF in FrameDecks.)';
    var url = 'mailto:?subject=' + encodeURIComponent(w + ': ' + cur.meeting) + '&body=' + encodeURIComponent(t);
    return fetch('api/app/open-external', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: url})})
      .then(function(r){ return r.json(); }).then(function(d){ if (!d.opened) location.href = url; });
  }).catch(function(){ toast('Could not open your email app', true); });
}
function print(){
  var old = document.getElementById('sum-print'); if (old) old.remove();
  var sheet = h('div', {id: 'sum-print', 'aria-hidden': 'true'}, current());
  document.body.appendChild(sheet); document.body.classList.add('kc-print-summary');
  var done = function(){ document.body.classList.remove('kc-print-summary'); sheet.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  if (dlg && dlg.open) dlg.close();
  setTimeout(function(){ window.print(); setTimeout(done, 1500); }, 30);
}
function loadNotes(){
  return get('api/summary/notes?script=' + (withScript ? 1 : 0) + '&run=' + encodeURIComponent(cur.id)).then(function(r){ return r.json(); })
    .then(function(d){ notes = d.notes; draw(); }).catch(function(e){ toast(e.message, true); });
}
function share(){
  var m = window.KCMembers && KCMembers.state(), opened = m && m.room && m.room.open;
  if (!opened){
    toast('Open Members’ phones first: one code for everyone in the meeting');
    if (window.KCMembers){ dlg.close(); KCMembers.open(); }
    return;
  }
  fetch('api/members', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'share-notes', run: cur.id, script: withScript})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); })
    .then(function(){ toast('Sermon notes are on members’ phones'); if (KCMembers.refresh) KCMembers.refresh(); })
    .catch(function(e){ toast(e.message, true); });
}

var runs = [];
function draw(){
  var d = dialog(); d.innerHTML = '';
  var tabs = h('div', {cls: 'sum-tabs', role: 'tablist'}, [['summary', 'Summary'], ['notes', 'Sermon notes']].map(function(t){
    return h('button', {type: 'button', role: 'tab', 'aria-selected': String(view === t[0]), onclick: function(){
      view = t[0]; if (view === 'notes' && !notes) loadNotes(); else draw();
    }, text: t[1]});
  }));
  var pick = null;
  if (runs && runs.length > 1){
    pick = h('select', {cls: 'sum-pick', 'aria-label': 'Show another meeting'});
    runs.forEach(function(r){ var o = h('option', {value: r.id, text: (r.meeting || 'Meeting') + ' · ' + new Date(r.started).toLocaleDateString(undefined, {day: 'numeric', month: 'short'}) + ', ' + clock(r.started)}); if (r.id === cur.id) o.selected = true; pick.appendChild(o); });
    pick.addEventListener('change', function(){ open(pick.value); });
  }
  var extra = null;
  if (view === 'notes'){
    var sc = h('input', {type: 'checkbox', id: 'sn-script'}); sc.checked = withScript;
    sc.addEventListener('change', function(){ withScript = sc.checked; loadNotes(); });
    extra = h('label', {cls: 'check sn-opt', title: 'Each Frame’s Teleprompter script: what you planned to say. Untick to leave it out.'}, [sc, ' Include what I planned to say (Teleprompter script)']);
  }
  var foot = h('div', {cls: 'kc-dlg-foot sum-foot'}, [pick ? h('label', {cls: 'sum-past'}, ['Past meetings ', pick]) : null,
    h('button', {cls: 'btn ghost', type: 'button', text: 'Copy', onclick: copy}),
    h('button', {cls: 'btn ghost', type: 'button', text: 'Email', onclick: email}),
    view === 'notes' ? h('button', {cls: 'btn', type: 'button', text: 'Share with members’ phones', onclick: share}) : null,
    h('button', {cls: 'btn', type: 'button', text: 'Print / Save as PDF', onclick: print}),
    h('button', {cls: 'btn primary', type: 'button', text: 'Close', onclick: function(){ d.close(); }})]);
  var body = view === 'notes' && !notes ? [h('p', {cls: 'sum-empty', text: 'Making the notes…'})] : current();
  d.appendChild(h('div', {cls: 'kc-dlg-in'}, [tabs].concat(body, [extra, foot])));
  if (!d.open) d.showModal();
}
function show(s, list){ cur = s; runs = list || []; notes = null; if (view === 'notes') loadNotes(); draw(); }
function open(run, as){
  if (as) view = as;
  return Promise.all([get('api/summary?run=' + encodeURIComponent(run || 'latest')).then(function(r){ return r.json(); }),
                      get('api/summary/list').then(function(r){ return r.json(); }).catch(function(){ return {runs: []}; })])
    .then(function(a){
      if (!a[0].summary){ toast('No meeting summary yet: it is made while a Frame is live'); return; }
      show(a[0].summary, a[1].runs);
    }).catch(function(e){ toast(e.message, true); });
}
window.KCSummary = {open: open, notes: function(run){ return open(run || 'latest', 'notes'); }};

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
