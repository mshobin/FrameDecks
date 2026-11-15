/* FrameDecks 26.11.23 - the meeting summary.
 * When the meeting goes off live, the Studio offers a one-page summary: how long it ran, each Frame and how long it
 * was on (against the plan), the questions asked and the scriptures read, and what people sent (Memory Cards shown,
 * prayer requests). Print / Save as PDF, Copy, or Email. Past meetings stay on this PC (src/meeting_log.py).
 * 26.11.24 a second view: the sermon notes for members, shareable on members' phones.
 * 26.11.28 a third: the moment, one picture to share after the meeting (the verse, a question to carry into the week,
 * when you meet next), in the meeting's own colours and season: Save the picture, Copy it, WhatsApp, members' phones. */
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
    stat(s.memory, 'Memory Cards shown'), stat(s.prayer.received || 0, (s.prayer.received === 1 ? 'prayer request' : 'prayer requests')),
    s.responses && s.responses.opened ? stat(s.responses.opened, s.responses.opened === 1 ? 'poll' : 'polls') : null]);   // 26.11.33
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
var view = 'summary', withScript = true, withSlides = true, notes = null;   // 26.11.48 withSlides: the slides shown, on phones
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
  fetch('api/members', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'share-notes', run: cur.id, script: withScript, slides: withSlides})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); })
    .then(function(){ toast('Sermon notes are on members’ phones'); if (KCMembers.refresh) KCMembers.refresh(); })
    .catch(function(e){ toast(e.message, true); });
}

/* ---------- 26.11.28 the moment: one picture (1080 × 1350) made on this PC ---------- */
var mo = {verse: 0, question: 0, next: null};
function allOf(k){ var out = []; (notes ? notes.sections : []).forEach(function(sec){ sec[k].forEach(function(x){ out.push(x); }); }); return out; }
function nextMeeting(){
  var st = Store.get(), SC = window.KCScenes, after = cur.started + 12 * 36e5, best = null;
  (SC ? SC.meetings(st) : []).forEach(function(m){ var t = Date.parse(m.date || ''); if (!isNaN(t) && t > after && (best === null || t < best)) best = t; });
  var d = new Date(best === null ? cur.started + 7 * 864e5 : best);
  return 'We meet again ' + d.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'});
}
function momentData(){
  var vs = allOf('verses'), qs = allOf('questions'), st = Store.get(), b = st.brand || {};
  var withText = vs.filter(function(v){ return v.text; });
  var v = (withText.length ? withText : vs)[Math.min(mo.verse, Math.max(0, (withText.length ? withText : vs).length - 1))] || null;
  return {verse: v, verses: withText.length ? withText : vs, question: qs[Math.min(mo.question, Math.max(0, qs.length - 1))] || '', questions: qs,
    next: mo.next != null ? mo.next : nextMeeting(), title: b.meeting || cur.meeting, org: b.org || ''};
}
function colours(){
  var st = Store.get(), SC = window.KCScenes, look = SC && SC.lookSurface ? SC.lookSurface(st) : null, pal = SC ? SC.brandPalette((st.brand || {}).color) : null;
  var sea = SC && SC.season ? SC.season(st) : null;
  function hex(rgb){ return 'rgb(' + rgb + ')'; }
  return {a: look ? hex(look.a) : '#182c54', b: look ? hex(look.b) : '#0c1a38', gold: pal ? pal.g2 : '#e3b75a', text: pal ? pal.text : '#f2c35b', season: sea ? sea.id : ''};
}
function wrap(ctx, text, x, y, max, lh, lines){
  var words = String(text || '').split(/\s+/), line = '', out = [];
  words.forEach(function(w){ var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > max && line){ out.push(line); line = w; } else line = t; });
  if (line) out.push(line);
  if (out.length > lines){ out = out.slice(0, lines); out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
  out.forEach(function(l, i){ ctx.fillText(l, x, y + i * lh); });
  return y + out.length * lh;
}
function paint(cv, m){
  var W = 1080, H = 1350, c = colours(), ctx = cv.getContext('2d');
  cv.width = W; cv.height = H;
  var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, c.a); g.addColorStop(1, c.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (c.season === 'christmas'){                              // a gentle snowfall
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (var i = 0; i < 140; i++){ var sx = (i * 397) % W, sy = (i * 211 + (i % 7) * 53) % H; ctx.beginPath(); ctx.arc(sx, sy, 1.5 + (i % 3), 0, 6.3); ctx.fill(); }
  }
  ctx.strokeStyle = c.gold; ctx.lineWidth = 6; ctx.strokeRect(48, 48, W - 96, H - 96);
  var x = 120, max = W - 240, y = 190;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.text; ctx.font = '600 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(('This week · ' + m.title).toUpperCase().slice(0, 48), x, y);
  y += 110;
  if (m.verse){
    ctx.fillStyle = '#fbf6ea'; ctx.font = '500 58px Georgia, "Times New Roman", serif';
    y = wrap(ctx, m.verse.text ? '“' + m.verse.text + '”' : m.verse.ref, x, y, max, 76, 7);
    ctx.fillStyle = c.text; ctx.font = '600 38px "Segoe UI", system-ui, sans-serif';
    if (m.verse.text) { y += 30; ctx.fillText(m.verse.ref, x, y); }
    y += 80;
  }
  if (m.question){
    ctx.fillStyle = c.gold; ctx.fillRect(x, y, 90, 5); y += 70;
    ctx.fillStyle = c.text; ctx.font = '600 30px "Segoe UI", system-ui, sans-serif'; ctx.fillText('TO CARRY INTO THE WEEK', x, y); y += 64;
    ctx.fillStyle = '#ffffff'; ctx.font = '500 44px "Segoe UI", system-ui, sans-serif';
    y = wrap(ctx, m.question, x, y, max, 60, 4);
  }
  ctx.fillStyle = '#ffffff'; ctx.font = '600 38px "Segoe UI", system-ui, sans-serif';
  wrap(ctx, m.next, x, H - 200, max, 50, 2);
  if (m.org){ ctx.fillStyle = c.text; ctx.font = '500 30px "Segoe UI", system-ui, sans-serif'; ctx.fillText(m.org.slice(0, 60), x, H - 110); }
}
function momentPage(){
  var m = momentData();
  if (!m.verse && !m.question) return [h('p', {cls: 'kc-dlg-kicker', text: 'Moment'}), h('h2', {id: 'sum-title', text: cur.meeting}),
    h('p', {cls: 'sum-empty', text: 'A moment needs a scripture or a question that was shown in this meeting.'})];
  var cv = h('canvas', {cls: 'mo-canvas', width: '1080', height: '1350', role: 'img', 'aria-label': 'The moment picture'});
  paint(cv, m);
  var vsel = h('select', {'aria-label': 'Scripture'}, m.verses.map(function(v, i){ var o = h('option', {value: String(i), text: v.ref}); if (v === m.verse) o.selected = true; return o; }));
  vsel.addEventListener('change', function(){ mo.verse = Number(vsel.value); draw(); });
  var qsel = h('select', {'aria-label': 'Question'}, m.questions.map(function(q, i){ var o = h('option', {value: String(i), text: q.length > 70 ? q.slice(0, 70) + '…' : q}); if (q === m.question) o.selected = true; return o; }));
  qsel.addEventListener('change', function(){ mo.question = Number(qsel.value); draw(); });
  var nx = h('input', {type: 'text', maxlength: '80', value: m.next, 'aria-label': 'When you meet next'});
  nx.addEventListener('change', function(){ mo.next = nx.value.trim(); draw(); });
  return [h('p', {cls: 'kc-dlg-kicker', text: 'Moment'}), h('h2', {id: 'sum-title', text: 'One picture to share'}),
    h('p', {cls: 'kc-dlg-sub', text: 'In your meeting’s colours. Choose what it says, then save, copy or share it.'}),
    h('div', {cls: 'mo-wrap'}, [cv, h('div', {cls: 'mo-pick'}, [
      m.verses.length > 1 ? h('label', {cls: 'field'}, [h('span', {text: 'Scripture'}), vsel]) : null,
      m.questions.length > 1 ? h('label', {cls: 'field'}, [h('span', {text: 'To carry into the week'}), qsel]) : null,
      h('label', {cls: 'field'}, [h('span', {text: 'When you meet next'}), nx])])])];
}
function momentBlob(){
  return new Promise(function(resolve, reject){ var cv = document.createElement('canvas'); paint(cv, momentData()); cv.toBlob(function(b){ if (b) resolve(b); else reject(new Error('Could not make the picture')); }, 'image/png'); });
}
function momentSave(){
  momentBlob().then(function(b){
    var a = h('a', {href: URL.createObjectURL(b), download: 'Moment - ' + cur.meeting.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.png'});
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Saved: choose where in the window that opens');
  }).catch(function(e){ toast(e.message, true); });
}
function momentCopy(){
  if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write){ toast('Copying pictures is not possible here: use Save the picture', true); return; }
  momentBlob().then(function(b){ return navigator.clipboard.write([new ClipboardItem({'image/png': b})]); })
    .then(function(){ toast('Picture copied: paste it into WhatsApp, an email or a post'); }).catch(function(){ toast('Could not copy the picture: use Save the picture', true); });
}
function momentWords(m){
  return [m.title, m.verse ? (m.verse.text ? '“' + m.verse.text + '” ' + m.verse.ref : m.verse.ref) : '', m.question ? 'To carry into the week: ' + m.question : '', m.next].filter(Boolean).join('\n\n');
}
function momentWhatsApp(){
  var url = 'https://wa.me/?text=' + encodeURIComponent(momentWords(momentData()));
  fetch('api/app/open-external', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: url})})
    .then(function(r){ return r.json(); }).then(function(d){ if (!d.opened) window.open(url, '_blank'); toast('WhatsApp opens with the words: attach the saved picture if you like'); })
    .catch(function(){ toast('Could not open WhatsApp', true); });
}
function momentPhones(){
  var mm = window.KCMembers && KCMembers.state(), opened = mm && mm.room && mm.room.open;
  if (!opened){ toast('Open Members’ phones first: one code for everyone in the meeting'); if (window.KCMembers){ dlg.close(); KCMembers.open(); } return; }
  var m = momentData();
  fetch('api/members', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'share-moment',
    moment: {title: m.title, verse: m.verse, question: m.question, next: m.next}})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); })
    .then(function(){ toast('The moment is on members’ phones'); if (KCMembers.refresh) KCMembers.refresh(); })
    .catch(function(e){ toast(e.message, true); });
}

var runs = [];
function draw(){
  var d = dialog(); d.innerHTML = '';
  var tabs = h('div', {cls: 'sum-tabs', role: 'tablist'}, [['summary', 'Summary'], ['notes', 'Sermon notes'], ['moment', 'Moment']].map(function(t){
    return h('button', {type: 'button', role: 'tab', 'aria-selected': String(view === t[0]), onclick: function(){
      view = t[0]; if (view !== 'summary' && !notes) loadNotes(); else draw();
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
    var ss = h('input', {type: 'checkbox', id: 'sn-slides'}); ss.checked = withSlides;
    ss.addEventListener('change', function(){ withSlides = ss.checked; });
    extra = h('div', {cls: 'sn-opts'}, [h('label', {cls: 'check sn-opt', title: 'Each Frame’s Teleprompter script: what you planned to say. Untick to leave it out.'}, [sc, ' Include what I planned to say (Teleprompter script)']),
      h('label', {cls: 'check sn-opt', title: 'On members’ phones, the notes end with each PowerPoint slide shown while their phones were open (never a slide kept off phones).'}, [ss, ' Include the slides shown (on members’ phones)'])]);
  }
  var foot = view === 'moment' ? h('div', {cls: 'kc-dlg-foot sum-foot'}, [pick ? h('label', {cls: 'sum-past'}, ['Past meetings ', pick]) : null,
    h('button', {cls: 'btn ghost', type: 'button', text: 'Copy the picture', onclick: momentCopy}),
    h('button', {cls: 'btn ghost', type: 'button', text: 'WhatsApp', onclick: momentWhatsApp}),
    h('button', {cls: 'btn', type: 'button', text: 'Share with members’ phones', onclick: momentPhones}),
    h('button', {cls: 'btn', type: 'button', text: 'Save the picture', onclick: momentSave}),
    h('button', {cls: 'btn primary', type: 'button', text: 'Close', onclick: function(){ d.close(); }})])
  : h('div', {cls: 'kc-dlg-foot sum-foot'}, [pick ? h('label', {cls: 'sum-past'}, ['Past meetings ', pick]) : null,
    h('button', {cls: 'btn ghost', type: 'button', text: 'Copy', onclick: copy}),
    h('button', {cls: 'btn ghost', type: 'button', text: 'Email', onclick: email}),
    view === 'notes' ? h('button', {cls: 'btn', type: 'button', text: 'Share with members’ phones', onclick: share}) : null,
    h('button', {cls: 'btn', type: 'button', text: 'Print / Save as PDF', onclick: print}),
    h('button', {cls: 'btn primary', type: 'button', text: 'Close', onclick: function(){ d.close(); }})]);
  var body = view !== 'summary' && !notes ? [h('p', {cls: 'sum-empty', text: view === 'moment' ? 'Making the moment…' : 'Making the notes…'})]
    : view === 'moment' ? momentPage() : current();
  d.appendChild(h('div', {cls: 'kc-dlg-in'}, [tabs].concat(body, [extra, foot])));
  if (!d.open) d.showModal();
}
function show(s, list){ cur = s; runs = list || []; notes = null; mo = {verse: 0, question: 0, next: null}; if (view !== 'summary') loadNotes(); draw(); }
function open(run, as){
  if (as) view = as;
  return Promise.all([get('api/summary?run=' + encodeURIComponent(run || 'latest')).then(function(r){ return r.json(); }),
                      get('api/summary/list').then(function(r){ return r.json(); }).catch(function(){ return {runs: []}; })])
    .then(function(a){
      if (!a[0].summary){ toast('No meeting summary yet: it is made while a Frame is live'); return; }
      show(a[0].summary, a[1].runs);
    }).catch(function(e){ toast(e.message, true); });
}
window.KCSummary = {open: open, notes: function(run){ return open(run || 'latest', 'notes'); }, moment: function(run){ return open(run || 'latest', 'moment'); }};

/* off live: offer the summary (a meeting of at least a minute) */
var wasLive = '', since = 0;
Store.subscribe(function(st){
  var sid = (st.live && st.live.scene) || '';
  if (sid && !wasLive) since = Date.now();
  if (!sid && wasLive && Date.now() - since > 60000 && window.KCActions && KCActions.toastAction && !(window.KCFeatures && !KCFeatures.on('summary'))){
    setTimeout(function(){ KCActions.toastAction('Meeting ended · ' + hm(Date.now() - since), 'Summary', function(){ open('latest'); }); }, 900);
  }
  wasLive = sid;
});
})();
