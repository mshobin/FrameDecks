/* FrameDecks 26.11.63 - meeting together, the leader's side (src/meeting_together.py, src/prayer_journey.py, src/care.py).
 * Five small dialogs in the same style as Typed answers (js/answers.js):
 *  - Discussion: first names (optional) and "I'd like to share" hands from members' phones, the queue in the order
 *    hands went up, who has not shared yet, and a quiet timer for each question (only you see it).
 *  - Bible quiz: questions made from this meeting's scriptures (edit any of them), asked on phones with a countdown,
 *    the answer and a leaderboard shown on screen as Chat Bubbles.
 *  - Take-home page: what members keep for the week after the meeting (the verses, the questions, the songs, shared
 *    prayer requests, when you meet next), on the same follow page, for up to 14 days.
 *  - Prayer journey: every prayer request kept on this PC, Still praying or Answered; private unless OK to share.
 *  - Care and attendance: who joined, who is new, who has missed twice. On this PC only.
 * Each refreshes every 2 seconds while open where phones change it. */
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
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function load(url){ return fetch(url, {cache: 'no-store'}).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); }); }
function btn(text, cls, onclick, title){ return h('button', {cls: 'btn ' + (cls || ''), type: 'button', text: text, title: title || null, onclick: onclick}); }
function sw(label, on, onchange, hint){
  var b = h('button', {cls: 'tg-switch', type: 'button', role: 'switch', 'aria-checked': String(!!on), onclick: function(){ onchange(!on); }}, [h('span', {cls: 'tg-knob', 'aria-hidden': 'true'})]);
  return h('div', {cls: 'tg-row'}, [h('div', {cls: 'tg-row-t'}, [h('b', {text: label}), hint ? h('span', {cls: 'hint', text: hint}) : null]), b]);
}
function openPhones(dlg){ return btn('Open members’ phones', 'primary', function(){ dlg.close(); if (window.KCMembers && KCMembers.open) KCMembers.open(); }); }

/* one dialog shell: a draw() that is called after every load, and a 2 s refresh while it is open */
function Shell(id, url, drawFn, poll){
  var self = {dlg: null, cur: null, busy: false, timer: 0};
  self.el = function(){
    if (self.dlg) return self.dlg;
    self.dlg = h('dialog', {cls: 'kc-dlg tg-dlg', id: id, 'aria-labelledby': id + '-title'});
    self.dlg.addEventListener('click', function(e){ if (e.target === self.dlg) self.dlg.close(); });
    self.dlg.addEventListener('close', function(){ clearInterval(self.timer); self.timer = 0; if (self.onclose) self.onclose(); });
    document.body.appendChild(self.dlg);
    return self.dlg;
  };
  self.draw = function(force){
    if (!self.dlg || !self.dlg.open || !self.cur) return;
    var k = JSON.stringify(self.cur);
    if (!force && k === self.drawn && !(self.live && self.live())) return;    // nothing new: keep focus where it is
    self.drawn = k; drawFn(self, !!force);
  };
  self.paint = function(kids){
    var keep = self.dlg.querySelector('.kc-dlg-in'), y = keep ? keep.scrollTop : 0, a = document.activeElement;
    var mark = a && self.dlg.contains(a) ? (a.id || a.textContent || '') : '';
    self.dlg.innerHTML = '';
    var box = h('div', {cls: 'kc-dlg-in'}, kids.filter(Boolean));
    self.dlg.appendChild(box); box.scrollTop = y;
    if (mark){   // the button or field you were on keeps the focus after a redraw
      var back = document.getElementById(mark) || Array.prototype.find.call(box.querySelectorAll('button'), function(b){ return b.textContent === mark; });
      if (back) back.focus();
    }
  };
  self.act = function(body, msg, u){
    if (self.busy) return Promise.resolve(null); self.busy = true;
    return post(u || url, body).then(function(d){ if (!u || u === url) self.cur = d; self.draw(true); if (msg) toast(msg); return d; })
      .catch(function(e){ toast(e.message, true); return null; }).then(function(d){ self.busy = false; return d; });
  };
  self.refresh = function(force){ return load(url).then(function(d){ self.cur = d; self.draw(force); }); };
  self.open = function(){
    if (window.KCOnboarding && KCOnboarding.isOpen && KCOnboarding.isOpen()) return Promise.resolve();
    var d = self.el(); if (!d.open) d.showModal();
    if (poll && !self.timer) self.timer = setInterval(function(){ if (!document.hidden && !self.busy) self.refresh(false).catch(function(){}); }, 2000);
    return self.refresh(true).catch(function(e){ toast(e.message || 'That could not load. Try again.', true); });
  };
  return self;
}
function errLine(cur){ return cur && cur.error ? h('p', {cls: 'pw-err', role: 'status', text: /0030|function/i.test(cur.error) ? cur.error : 'Reconnecting… (' + cur.error + ')'}) : null; }

/* ---------- Discussion ---------- */
var talk = {left: 0, ends: 0, tick: 0, len: 3};
function timerText(){
  if (!talk.ends) return talk.len + ':00';
  var s = Math.max(0, Math.round((talk.ends - Date.now()) / 1000));
  return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}
function timerTick(){
  var out = document.getElementById('tg-clock');
  if (out) out.textContent = timerText();
  if (talk.ends && Date.now() >= talk.ends){
    talk.ends = 0; clearInterval(talk.tick); talk.tick = 0;
    toast('Time for this question is up');
    if (out){ out.textContent = '0:00'; out.classList.add('done'); }
  }
}
function timerStart(min){
  talk.len = min || talk.len; talk.ends = Date.now() + talk.len * 60000;
  clearInterval(talk.tick); talk.tick = setInterval(timerTick, 500); timerTick();
}
function timerStop(){ talk.ends = 0; clearInterval(talk.tick); talk.tick = 0; timerTick(); }
function who(p){ return p.name || 'Someone without a name'; }
function since(t){ var s = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 1000)); return isNaN(s) ? '' : s < 60 ? 'just now' : Math.round(s / 60) + ' min'; }
var discussion = Shell('tg-talk', 'api/room/together', function(S, force){
  var c = S.cur, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Discussion'})];
  if (!c.room){
    kids.push(h('h2', {id: 'tg-talk-title', text: 'Open members’ phones first'}),
      h('p', {cls: 'kc-dlg-sub', text: 'People raise a hand on the page that follows the meeting screen. Open members’ phones, then switch on hands.'}),
      h('div', {cls: 'kc-dlg-foot'}, [btn('Not now', 'ghost', function(){ S.dlg.close(); }), openPhones(S.dlg)]));
    return S.paint(kids);
  }
  if (!force && document.activeElement && S.dlg.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  kids.push(h('h2', {id: 'tg-talk-title', text: 'Who would like to share'}),
    h('p', {cls: 'kc-dlg-sub', text: c.joined + (c.joined === 1 ? ' phone' : ' phones') + ' following' + (c.named ? ' · ' + c.named + ' gave a first name' : '') + '. Only you see this list.'}),
    sw('“I’d like to share” on phones', c.hands, function(on){ S.act({op: 'flag', name: 'hands', on: on}, on ? 'Phones can raise a hand' : 'Hands are off'); }, 'A hand goes up here, in the order people raise it.'),
    sw('Ask for a first name', c.people, function(on){ S.act({op: 'flag', name: 'people', on: on}); }, 'Optional for everyone. Kept for Care and attendance on this PC.'));
  var q = c.queue || [];
  kids.push(h('p', {cls: 'rs-label', text: q.length ? 'Hands up (' + q.length + ')' : 'Hands up'}));
  kids.push(q.length ? h('ol', {cls: 'ta-list tg-queue', 'aria-live': 'polite'}, q.map(function(p){
    return h('li', {cls: 'ta-item'}, [h('p', null, [who(p), h('span', {cls: 'hint', text: ' · ' + since(p.hand)})]),
      btn('Shared', 'small', function(){ S.act({op: 'handDown', id: p.id, shared: true}); }, 'Lower the hand and tick them as having shared'),
      btn('Lower', 'small ghost', function(){ S.act({op: 'handDown', id: p.id}); })]);
  })) : h('p', {cls: 'hint', 'aria-live': 'polite', text: c.hands ? 'No hands up yet.' : 'Switch on “I’d like to share” above.'}));
  var ny = c.notYet || [];
  if (ny.length) kids.push(h('p', {cls: 'rs-label', text: 'Not shared yet (' + ny.length + ')'}),
    h('ul', {cls: 'tg-chips'}, ny.map(function(p){ return h('li', null, [h('button', {cls: 'tg-chip', type: 'button', title: 'Tick ' + p.name + ' as having shared', text: p.name, onclick: function(){ S.act({op: 'tick', id: p.id}); }})]); })));
  var len = h('select', {'aria-label': 'Minutes for this question'}, [1, 2, 3, 5, 8, 10].map(function(m){ var o = h('option', {value: String(m), text: m + ' min'}); if (m === talk.len) o.selected = true; return o; }));
  len.addEventListener('change', function(){ talk.len = +len.value; if (!talk.ends) timerTick(); });
  kids.push(h('div', {cls: 'tg-timer'}, [h('span', {cls: 'rs-label', text: 'Time for this question'}), h('output', {id: 'tg-clock', 'aria-live': 'off', text: timerText()}), len,
    talk.ends ? btn('Stop', 'small ghost', function(){ timerStop(); S.draw(true); }) : btn('Start', 'small', function(){ timerStart(+len.value); S.draw(true); })]));
  kids.push(errLine(c), h('div', {cls: 'kc-dlg-foot'}, [q.length ? btn('Lower all hands', 'ghost', function(){ S.act({op: 'handDown'}, 'Every hand is down'); }) : null,
    btn('Done for now', 'primary', function(){ S.dlg.close(); })]));
  S.paint(kids);
}, true);

/* ---------- Bible quiz ---------- */
var quiz = {list: [], done: {}, seconds: 20, edit: -1, made: false};
function letters(i){ return 'ABCD'.charAt(i); }
function makeQuestions(S){
  return post('api/room/together', {op: 'quizBuild', n: 6}).then(function(d){
    quiz.list = (d.questions || []).map(function(q){ return {question: q.question, options: q.options.slice(), correct: q.correct}; });
    quiz.made = true; quiz.done = {}; quiz.edit = -1; S.draw(true);
    if (!quiz.list.length) toast('No scriptures in this meeting yet: write a question of your own', true);
  }).catch(function(e){ toast(e.message, true); });
}
function editor(S, q, i){
  var t = h('input', {type: 'text', maxlength: '200', value: q.question, 'aria-label': 'Question'});
  t.addEventListener('input', function(){ q.question = t.value; });
  t.addEventListener('keydown', function(e){ e.stopPropagation(); });
  var rows = q.options.map(function(o, j){
    var r = h('input', {type: 'radio', name: 'tg-right-' + i, 'aria-label': 'Answer ' + letters(j) + ' is right'}); r.checked = q.correct === j;
    r.addEventListener('change', function(){ q.correct = j; });
    var v = h('input', {type: 'text', maxlength: '80', value: o, 'aria-label': 'Answer ' + letters(j)});
    v.addEventListener('input', function(){ q.options[j] = v.value; });
    v.addEventListener('keydown', function(e){ e.stopPropagation(); });
    return h('li', {cls: 'rs-opt'}, [r, h('b', {text: letters(j)}), v,
      q.options.length > 2 ? h('button', {cls: 'btn small ghost', type: 'button', 'aria-label': 'Remove answer ' + letters(j), text: '×', onclick: function(){ q.options.splice(j, 1); if (q.correct >= q.options.length) q.correct = 0; S.draw(true); }}) : null]);
  });
  return h('div', {cls: 'tg-edit'}, [h('label', {cls: 'field'}, [h('span', {text: 'Question'}), t]),
    h('p', {cls: 'rs-label', text: 'Answers (choose the right one)'}), h('ul', {cls: 'rs-opts'}, rows),
    h('div', {cls: 'tg-edit-foot'}, [q.options.length < 4 ? btn('Add an answer', 'small ghost', function(){ q.options.push(''); S.draw(true); }) : null,
      btn('Remove question', 'small ghost', function(){ quiz.list.splice(i, 1); quiz.edit = -1; S.draw(true); }),
      btn('Done', 'small', function(){ quiz.edit = -1; S.draw(true); })])]);
}
function ask(S, i){
  var q = quiz.list[i];
  var clean = {question: (q.question || '').trim(), options: q.options.map(function(o){ return (o || '').trim(); }).filter(Boolean), correct: q.correct};
  if (!clean.question || clean.options.length < 2){ toast('A question needs words and at least two answers', true); return; }
  S.act({op: 'quizOpen', question: clean, seconds: quiz.seconds}, 'On phones and on screen').then(function(d){ if (d) quiz.done[i] = true; });
}
function countdown(q){
  if (!q || q.revealed || !q.closesAt) return '';
  var s = Math.max(0, Math.round((Date.parse(q.closesAt) - Date.now()) / 1000));
  return isNaN(s) ? '' : s ? s + ' s left' : 'Time is up';
}
var quizDlg = Shell('tg-quiz', 'api/room/together', function(S, force){
  var c = S.cur, qz = c.quiz || {}, q = qz.quiz, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Bible quiz'})];
  if (!c.room && !q){
    kids.push(h('h2', {id: 'tg-quiz-title', text: 'Open members’ phones first'}),
      h('p', {cls: 'kc-dlg-sub', text: 'Everyone answers on their own phone, on the page that follows the meeting screen. Quick answers score more.'}),
      h('div', {cls: 'kc-dlg-foot'}, [btn('Not now', 'ghost', function(){ S.dlg.close(); }), openPhones(S.dlg)]));
    return S.paint(kids);
  }
  if (!force && S.dlg.querySelector('.tg-edit')) return;      // never redraw under the leader's typing
  if (q){
    var total = qz.answered || 0, counts = qz.counts || [];
    kids.push(h('h2', {id: 'tg-quiz-title', text: q.question}),
      h('p', {cls: 'kc-dlg-sub', 'aria-live': 'polite', text: total + (total === 1 ? ' answer' : ' answers') + (countdown(q) ? ' · ' + countdown(q) : q.revealed ? ' · answer shown' : '')}),
      h('ul', {cls: 'rs-bars'}, q.options.map(function(o, j){
        var n = counts[j] || 0, pct = total ? Math.round(n * 100 / total) : 0, right = q.revealed && j === q.correct;
        return h('li', {cls: 'rs-bar' + (right ? ' tg-right' : '')}, [h('span', {text: letters(j) + '  ' + o + (right ? '  ✓' : '')}), h('span', {cls: 'rs-bar-n', text: n + ' · ' + pct + '%'}),
          h('span', {cls: 'rs-bar-track'}, [h('span', {cls: 'rs-bar-fill', style: 'width:' + pct + '%'})])]);
      })));
    if (q.revealed && (qz.board || []).length) kids.push(h('p', {cls: 'rs-label', text: 'Leaderboard'}),
      h('ol', {cls: 'tg-board'}, qz.board.slice(0, 5).map(function(r){ return h('li', null, [h('span', {text: r.name}), h('b', {text: String(r.points)})]); })));
    kids.push(errLine(c), h('div', {cls: 'kc-dlg-foot'}, q.revealed ? [
      btn('End quiz', 'ghost', function(){ S.act({op: 'quizClose'}, 'Quiz closed'); }),
      btn('Leaderboard on screen', '', function(){ S.act({op: 'quizBoard'}, 'Leaderboard on screen'); }),
      btn('Next question', 'primary', function(){ S.act({op: 'quizClose'}); })]
      : [btn('Stop this question', 'ghost', function(){ S.act({op: 'quizClose'}); }), btn('Show the answer', 'primary', function(){ S.act({op: 'quizReveal'}, 'The answer is on screen'); })]));
    return S.paint(kids);
  }
  if (!quiz.made && !quiz.list.length){ makeQuestions(S); }
  var secs = h('select', {'aria-label': 'Seconds to answer'}, [10, 15, 20, 30, 45, 60].map(function(n){ var o = h('option', {value: String(n), text: n + ' seconds'}); if (n === quiz.seconds) o.selected = true; return o; }));
  secs.addEventListener('change', function(){ quiz.seconds = +secs.value; });
  kids.push(h('h2', {id: 'tg-quiz-title', text: 'A quick quiz on today’s scriptures'}),
    h('p', {cls: 'kc-dlg-sub', text: 'Made from this meeting’s verses. Change any question, then Ask: phones answer, the screen shows the question as a Chat Bubble.'}),
    h('div', {cls: 'tg-timer'}, [h('span', {cls: 'rs-label', text: 'Time to answer'}), secs]));
  kids.push(h('ol', {cls: 'ta-list tg-qlist'}, quiz.list.map(function(x, i){
    if (quiz.edit === i) return h('li', null, [editor(S, x, i)]);
    return h('li', {cls: 'ta-item' + (quiz.done[i] ? ' tg-done' : '')}, [h('p', null, [x.question, h('span', {cls: 'hint', text: ' · ' + letters(x.correct) + ' ' + (x.options[x.correct] || '')})]),
      btn('Edit', 'small ghost', function(){ quiz.edit = i; S.draw(true); }),
      btn(quiz.done[i] ? 'Ask again' : 'Ask', 'small', function(){ ask(S, i); })]);
  })));
  if (!quiz.list.length) kids.push(h('p', {cls: 'hint', text: quiz.made ? 'No questions yet.' : 'Making questions…'}));
  kids.push(errLine(c), h('div', {cls: 'kc-dlg-foot'}, [
    btn('Write a question', 'ghost', function(){ quiz.list.push({question: '', options: ['', '', ''], correct: 0}); quiz.edit = quiz.list.length - 1; S.draw(true); }),
    btn('New questions', 'ghost', function(){ makeQuestions(S); }),
    (qz.board || []).length ? btn('Leaderboard on screen', '', function(){ S.act({op: 'quizBoard'}, 'Leaderboard on screen'); }) : null,
    btn('Done for now', 'primary', function(){ S.dlg.close(); })]));
  S.paint(kids);
}, true);
quizDlg.live = function(){ var q = quizDlg.cur && quizDlg.cur.quiz && quizDlg.cur.quiz.quiz; return !!(q && !q.revealed); };   // the countdown

/* ---------- Take-home page ---------- */
var th = {note: '', withNotes: true, days: 8, preview: null};
function preview(S){
  return post('api/room/together', {op: 'takehomePreview', note: th.note, withNotes: th.withNotes}).then(function(d){ th.preview = d.body; S.draw(true); })
    .catch(function(e){ toast(e.message, true); });
}
function part(label, items){ return items && items.length ? h('div', {cls: 'tg-part'}, [h('b', {text: label}), h('ul', null, items.slice(0, 6).map(function(t){ return h('li', {text: t}); }))]) : null; }
var takehome = Shell('tg-home', 'api/room/together', function(S, force){
  var c = S.cur, on = c.takehome && c.takehome.on, b = th.preview, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Take-home page'})];
  if (!force) return;
  kids.push(h('h2', {id: 'tg-home-title', text: on ? 'Members have the take-home page' : 'Something to keep for the week'}),
    h('p', {cls: 'kc-dlg-sub', text: 'On the same follow page as the meeting, for members with the code. It stays after the meeting, then is removed by itself.'}));
  if (b){
    kids.push(h('div', {cls: 'tg-preview'}, [h('p', {cls: 'tg-pv-h', text: b.meeting + (b.date ? ' · ' + new Date(b.date + 'T12:00').toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'}) : '')}),
      part('Scriptures', (b.verses || []).map(function(v){ return v.ref; })), part('To reflect on', b.questions),
      part('Songs', (b.songs || []).map(function(s){ return s.title; })), part('Praying for', b.prayers), part('Answered prayers', b.answered),
      b.notes ? h('p', {cls: 'hint', text: 'With the sermon notes.'}) : null,
      b.next ? h('p', {cls: 'hint', text: 'Next: ' + b.next.name + (b.next.date ? ' · ' + b.next.date : '')}) : null,
      !(b.verses || []).length && !(b.questions || []).length && !(b.songs || []).length ? h('p', {cls: 'hint', text: 'Nothing from a meeting yet: go live with a Frame first, or add a note.'}) : null]));
  }
  var note = h('textarea', {rows: '2', maxlength: '500', placeholder: 'A word for the week (optional)', id: 'tg-note'}); note.value = th.note;
  note.addEventListener('input', function(){ th.note = note.value; });
  note.addEventListener('keydown', function(e){ e.stopPropagation(); });
  note.addEventListener('change', function(){ preview(S); });
  var days = h('select', {id: 'tg-days'}, [[3, '3 days'], [8, 'Until next week'], [14, '2 weeks']].map(function(x){ var o = h('option', {value: String(x[0]), text: x[1]}); if (x[0] === th.days) o.selected = true; return o; }));
  days.addEventListener('change', function(){ th.days = +days.value; });
  kids.push(h('label', {cls: 'field', 'for': 'tg-note'}, [h('span', {text: 'Your note'}), note]),
    sw('Include the sermon notes', th.withNotes, function(v){ th.withNotes = v; preview(S); }, 'When they are shared on members’ phones.'),
    h('label', {cls: 'field tg-inline', 'for': 'tg-days'}, [h('span', {text: 'Keep it'}), days]));
  if (on && c.takehome.until) kids.push(h('p', {cls: 'hint', text: 'Available until ' + new Date(c.takehome.until).toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'}) + '.'}));
  kids.push(errLine(c), h('div', {cls: 'kc-dlg-foot'}, [on ? btn('Remove it', 'ghost', function(){ S.act({op: 'takehomeRemove'}, 'The take-home page is removed'); }) : btn('Not now', 'ghost', function(){ S.dlg.close(); }),
    btn(on ? 'Update it' : 'Give it to members', 'primary', function(){ S.act({op: 'takehomePublish', note: th.note, withNotes: th.withNotes, days: th.days}, 'Members can open the take-home page'); })]));
  S.paint(kids);
}, false);
var thOpen = takehome.open;
takehome.open = function(){ th.preview = null; return thOpen().then(function(){ return preview(takehome); }); };

/* ---------- Prayer journey ---------- */
var pj = {tab: 'praying'};
var journey = Shell('tg-pray', 'api/prayer-journey', function(S, force){
  var c = S.cur, items = (c.items || []).filter(function(i){ return i.status === pj.tab; }), kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Prayer journey'})];
  if (!force && S.dlg.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  kids.push(h('h2', {id: 'tg-pray-title', text: 'Praying over the weeks'}),
    h('p', {cls: 'kc-dlg-sub', text: 'Every request from members’ phones, kept on this PC. Private unless you tick OK to share; shared ones never show a name.'}),
    h('div', {cls: 'sum-tabs', role: 'tablist'}, [['praying', 'Still praying · ' + (c.praying || 0)], ['answered', 'Answered · ' + (c.answered || 0)]].map(function(t){
      return h('button', {type: 'button', role: 'tab', 'aria-selected': String(pj.tab === t[0]), text: t[1], onclick: function(){ pj.tab = t[0]; S.draw(true); }});
    })));
  kids.push(items.length ? h('ul', {cls: 'ta-list tg-prayers'}, items.map(function(it){
    var share = h('input', {type: 'checkbox'}); share.checked = it.share;
    share.addEventListener('change', function(){ S.act({op: 'update', id: it.id, share: share.checked}); });
    var note = it.status === 'answered' ? h('input', {type: 'text', maxlength: '300', value: it.note || '', placeholder: 'How it was answered (optional)', 'aria-label': 'How it was answered'}) : null;
    if (note){ note.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Enter') note.blur(); }); note.addEventListener('change', function(){ S.act({op: 'update', id: it.id, note: note.value}); }); }
    return h('li', {cls: 'tg-prayer'}, [h('p', {text: it.body}),
      h('p', {cls: 'hint', text: (it.name || 'No name') + ' · ' + new Date(it.at).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}), note,
      h('div', {cls: 'tg-prayer-foot'}, [h('label', {cls: 'check'}, [share, ' OK to share']),
        it.status === 'praying' ? btn('Answered', 'small', function(){ S.act({op: 'update', id: it.id, status: 'answered'}, 'Moved to Answered'); })
          : btn('Still praying', 'small ghost', function(){ S.act({op: 'update', id: it.id, status: 'praying'}); }),
        btn('Remove', 'small ghost', function(){ if (confirm('Remove this prayer request from this PC?')) S.act({op: 'remove', id: it.id}); })])]);
  })) : h('p', {cls: 'hint', text: pj.tab === 'praying' ? 'Requests sent from members’ phones are kept here.' : 'When a prayer is answered, press Answered on it.'}));
  kids.push(h('div', {cls: 'kc-dlg-foot'}, [btn('Answered prayers on screen', '', function(){ S.act({op: 'showAnswered'}, 'Answered prayers are on screen'); }, 'The shared answered prayers of the last month as a Chat Bubble, without names'),
    btn('Done', 'primary', function(){ S.dlg.close(); })]));
  S.paint(kids);
}, false);

/* ---------- Care and attendance ---------- */
var care = Shell('tg-care', 'api/care', function(S){
  var c = S.cur, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Care and attendance'})];
  kids.push(h('h2', {id: 'tg-care-title', text: 'Who to reach out to'}),
    h('p', {cls: 'kc-dlg-sub', text: 'From the first names people typed on their phones. On this PC only, never a register: remove any meeting or name.'}));
  if (!c.meetings){
    kids.push(h('p', {cls: 'hint', text: 'Nothing yet. When members’ phones close, the first names given are kept here with the date.'}));
  } else {
    var hist = c.history || [], top = Math.max.apply(null, hist.map(function(x){ return x.count; }).concat([1]));
    kids.push(h('div', {cls: 'sum-stats'}, [h('div', {cls: 'sum-stat'}, [h('b', {text: String(c.last.count)}), h('span', {text: 'joined last time'})]),
      h('div', {cls: 'sum-stat'}, [h('b', {text: String(c.average)}), h('span', {text: 'on average'})]),
      h('div', {cls: 'sum-stat'}, [h('b', {text: String(c.meetings)}), h('span', {text: c.meetings === 1 ? 'meeting kept' : 'meetings kept'})])]),
      h('ol', {cls: 'tg-hist', 'aria-label': 'People who joined, the last ' + hist.length + ' meetings'}, hist.map(function(x){
        return h('li', {title: x.date + ': ' + x.count + ' joined', style: 'height:' + Math.max(8, Math.round(x.count * 100 / top)) + '%'}, [h('span', {cls: 'sr-only', text: x.date + ': ' + x.count})]);
      })));
    var names = function(label, list, empty){
      return [h('p', {cls: 'rs-label', text: label + (list.length ? ' (' + list.length + ')' : '')}),
        list.length ? h('ul', {cls: 'tg-chips'}, list.map(function(n){ return h('li', null, [h('span', {cls: 'tg-chip', text: n})]); })) : h('p', {cls: 'hint', text: empty})];
    };
    kids = kids.concat(names('New last time', c.new || [], 'Nobody new.'), names('Missed the last 2 meetings', c.missed || [], 'Nobody has missed twice in a row.'));
    var day = h('select', {'aria-label': 'Meeting to remove'}, [h('option', {value: '', text: 'Choose a meeting…'})].concat(hist.slice().reverse().map(function(x){ return h('option', {value: x.date, text: x.date + ' · ' + x.count}); })));
    var nm = h('input', {type: 'text', maxlength: '40', placeholder: 'A first name', 'aria-label': 'Name to remove'});
    nm.addEventListener('keydown', function(e){ e.stopPropagation(); });
    kids.push(h('details', {cls: 'tg-forget'}, [h('summary', {text: 'Remove a meeting or a name'}),
      h('div', {cls: 'tg-timer'}, [day, btn('Remove meeting', 'small ghost', function(){ if (day.value) S.act({op: 'forget', date: day.value}, 'Removed'); })]),
      h('div', {cls: 'tg-timer'}, [nm, btn('Remove name', 'small ghost', function(){ if (nm.value.trim()) S.act({op: 'forget', name: nm.value.trim()}, 'Removed from every meeting'); })])]));
  }
  kids.push(h('div', {cls: 'kc-dlg-foot'}, [btn('Save today’s attendance', '', function(){
    post('api/room/together', {op: 'attendance'}).then(function(){ toast('Attendance kept on this PC'); return S.refresh(true); }).catch(function(e){ toast(e.message, true); });
  }, 'Keep the first names given on phones so far (this happens by itself when members’ phones close)'), btn('Done', 'primary', function(){ S.dlg.close(); })]));
  S.paint(kids);
}, false);

/* ---------- 26.11.63 the co-leader seat: a second PIN for the phone remote, with Take back ---------- */
var coWas = 0, coTimer = 0, coPill = null;
function coPillShow(c){
  var n = c && c.on ? c.connected : 0;
  if (n && !coPill){
    coPill = h('button', {cls: 'co-pill', type: 'button', title: 'A co-leader is running the meeting from a phone. Press to see or take back.', onclick: function(){ coleader.open(); }},
      [h('span', {cls: 'co-dot', 'aria-hidden': 'true'}), 'Co-leader connected']);
    document.body.appendChild(coPill);
  }
  if (coPill) coPill.hidden = !n;
  if (n > coWas && window.KCActions && KCActions.toastAction) KCActions.toastAction('A co-leader joined from a phone', 'Take back', function(){ post('api/co-leader', {op: 'end'}).then(coCheck); });
  coWas = n;
  clearTimeout(coTimer);
  if (c && c.on) coTimer = setTimeout(coCheck, 5000);         // only while a handover is open
}
function coCheck(){ return load('api/co-leader').then(function(c){ coPillShow(c); if (coleader.dlg && coleader.dlg.open){ coleader.cur = c; coleader.draw(false); } return c; }).catch(function(){}); }
var coUrl = '';
var coleader = Shell('tg-co', 'api/co-leader', function(S){
  var c = S.cur, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Co-leader'})];
  if (!c.on){
    kids.push(h('h2', {id: 'tg-co-title', text: 'Hand the meeting to a co-leader'}),
      h('p', {cls: 'kc-dlg-sub', text: 'They run Next, Previous, Hide all, the Content and Chat Bubbles from their own phone, while you lead. A new PIN just for them, separate from yours. Take back ends it at once.'}),
      h('div', {cls: 'kc-dlg-foot'}, [btn('Not now', 'ghost', function(){ S.dlg.close(); }),
        btn('Make a co-leader PIN', 'primary', function(){ S.act({op: 'start'}).then(function(d){ if (d) coPillShow(d); }); })]));
    return S.paint(kids);
  }
  var qr = h('div', {cls: 'qr co-qr'});
  if (coUrl && window.qrcode){ var q = window.qrcode(0, 'M'); q.addData(coUrl); q.make(); qr.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
  kids.push(h('h2', {id: 'tg-co-title', text: c.connected ? 'Your co-leader is connected' : 'Waiting for your co-leader'}),
    h('p', {cls: 'kc-dlg-sub', text: 'On their phone, on the same Wi-Fi: scan the code, then type this PIN. It works until you take back (or for 8 hours).'}),
    h('div', {cls: 'co-hand'}, [qr, h('div', null, [h('p', {cls: 'pw-code', text: c.pin}), coUrl ? h('p', {cls: 'hint mono', text: coUrl}) : null,
      h('p', {cls: 'hint', 'aria-live': 'polite', text: c.connected ? c.connected + (c.connected === 1 ? ' phone' : ' phones') + ' connected as co-leader' : 'Nobody has joined yet.'})])]),
    h('div', {cls: 'kc-dlg-foot'}, [btn('Take back', '', function(){ S.act({op: 'end'}, 'You have the meeting back').then(function(d){ if (d) coPillShow(d); }); }),
      btn('Done', 'primary', function(){ S.dlg.close(); })]));
  S.paint(kids);
}, true);
var coOpen = coleader.open;
coleader.open = function(){
  return load('api/remote-info').then(function(r){ coUrl = (r.urls || [])[0] || ''; }).catch(function(){}).then(coOpen);
};
coCheck();

window.KCTogether = {coleader: coleader.open, discussion: discussion.open, quiz: quizDlg.open, takehome: takehome.open, journey: journey.open, care: care.open,
  state: function(){ return discussion.cur; }};
})();
