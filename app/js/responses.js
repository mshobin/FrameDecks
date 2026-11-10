/* FrameDecks 26.11.33 - Quick responses and polls (Studio > Engage, or the palette). While members' phones are open,
 * ask one thing at a time: Yes / No, a poll (2 to 6 answers you type) or a rating from 1 to 5. Phones on
 * framedecks.com/follow answer under the screen, once each, and can change their answer while it is open. Choose
 * whether phones see the live results. Show on screen puts the results on a Memory Card, so they reach the camera and
 * the overlays like any card. The counts refresh every 2 seconds while this dialog is open (src/room_responses.py). */
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
var API = 'api/room/response';
function post(body){
  return fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function load(){ return fetch(API, {cache: 'no-store'}).then(function(r){ return r.json(); }); }

var KINDS = [['yesno', 'Yes / No'], ['choice', 'Poll'], ['rating', 'Rating 1–5']];
var MIN = 2, MAX = 6;
var draft = {question: '', kind: 'yesno', options: ['', ''], show: false};
var dlg = null, cur = null, busy = false, timer = 0, drawn = '';

/* Whole percentages that add up to 100 (each the step between rounded running totals), exactly as phones show them
 * (hosted/src/lib/room-responses.ts) */
function percentages(counts){
  var total = counts.reduce(function(a, b){ return a + b; }, 0), run = 0, was = 0;
  return counts.map(function(n){
    run += n;
    var now = total ? Math.round(run * 100 / total) : 0, step = now - was;
    was = now;
    return step;
  });
}
function label(kind, o){ return kind === 'rating' ? o + ' ★' : o; }
function answers(n){ return !n ? 'No answers yet' : n === 1 ? '1 answer' : n + ' answers'; }

function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg rs-dlg', id: 'rs-dlg', 'aria-labelledby': 'rs-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function(){ clearInterval(timer); timer = 0; drawn = ''; });
  document.body.appendChild(dlg);
  return dlg;
}
function act(body, msg){
  if (busy) return Promise.resolve(); busy = true;
  return post(body).then(function(d){ cur = d; draw(true); if (msg) toast(msg); return d; })
    .catch(function(e){ toast(e.message, true); }).then(function(d){ busy = false; return d; });
}

/* The counts as calm bars; the live region says the totals when they change */
function bars(r, counts, total){
  var pct = percentages(counts);
  var list = h('ul', {cls: 'rs-bars'}, r.options.map(function(o, i){
    return h('li', {cls: 'rs-bar'}, [
      h('span', {cls: 'rs-bar-name', text: label(r.kind, o)}),
      h('span', {cls: 'rs-bar-n', text: (counts[i] || 0) + ' · ' + pct[i] + '%'}),
      h('span', {cls: 'rs-bar-track', 'aria-hidden': 'true'}, [h('span', {cls: 'rs-bar-fill', style: 'width:' + pct[i] + '%'})])]);
  }));
  return h('div', {cls: 'rs-results', 'aria-live': 'polite'}, [list, h('p', {cls: 'hint rs-total', text: answers(total)})]);
}

function pickKind(kind){
  draft.kind = kind; draw(true);
  var b = dlg.querySelector('.rs-kinds [aria-checked="true"]'); if (b) b.focus();
}
function kindSeg(){
  var seg = h('div', {cls: 'seg rs-kinds', role: 'radiogroup', 'aria-labelledby': 'rs-kind-label'}, KINDS.map(function(k){
    var on = draft.kind === k[0];
    return h('button', {type: 'button', role: 'radio', 'aria-checked': String(on), tabindex: on ? '0' : '-1', text: k[1], onclick: function(){ pickKind(k[0]); }});
  }));
  seg.addEventListener('keydown', function(e){          // arrow keys move between the three, as in any radio group
    var step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    if (!step) return;
    e.preventDefault();
    var i = KINDS.map(function(k){ return k[0]; }).indexOf(draft.kind);
    pickKind(KINDS[(i + step + KINDS.length) % KINDS.length][0]);
  });
  return seg;
}
function optionRows(){
  var rows = draft.options.map(function(v, i){
    var inp = h('input', {type: 'text', maxlength: '60', id: 'rs-opt-' + i, value: v, placeholder: 'Answer ' + (i + 1), 'aria-label': 'Answer ' + (i + 1)});
    inp.addEventListener('input', function(){ draft.options[i] = inp.value; });
    inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); openIt(); } });
    return h('li', {cls: 'rs-opt'}, [inp, draft.options.length > MIN ? h('button', {cls: 'btn ghost small', type: 'button', text: 'Remove', 'aria-label': 'Remove answer ' + (i + 1), onclick: function(){
      draft.options.splice(i, 1); draw(true); var f = dlg.querySelector('#rs-opt-' + Math.max(0, i - 1)); if (f) f.focus();
    }}) : null]);
  });
  return h('div', {cls: 'rs-opts-wrap'}, [h('p', {cls: 'rs-label', text: 'Answers (2 to 6)'}), h('ol', {cls: 'rs-opts'}, rows),
    draft.options.length < MAX ? h('button', {cls: 'btn ghost small', type: 'button', text: '+ Add an answer', onclick: function(){
      draft.options.push(''); draw(true); var f = dlg.querySelector('#rs-opt-' + (draft.options.length - 1)); if (f) f.focus();
    }}) : null]);
}
function openIt(){
  var q = draft.question.trim();
  if (!q){ toast('Type the question first.', true); var f = dlg.querySelector('#rs-q'); if (f) f.focus(); return; }
  var opts = draft.options.map(function(o){ return o.trim(); }).filter(Boolean);
  if (draft.kind === 'choice' && opts.length < MIN){ toast('A poll needs at least 2 answers.', true); return; }
  act({op: 'open', question: q, kind: draft.kind, options: draft.kind === 'choice' ? opts : null, showResults: draft.show}, 'Phones can answer now')
    .then(function(d){ if (d && d.response){ draft.question = ''; draft.options = ['', '']; } });
}

function key(){
  if (!cur) return '';
  var r = cur.response;
  return [cur.room ? 1 : 0, r ? r.id : '', r && r.open ? 1 : 0, cur.error ? 1 : 0].join('|');
}
/* force: redraw everything; otherwise only the counts change in place (typing is never interrupted) */
function draw(force){
  if (!dlg || !dlg.open || !cur) return;
  var k = key();
  if (!force && k === drawn){
    var old = dlg.querySelector('.rs-results');
    if (old && cur.response) old.replaceWith(bars(cur.response, cur.counts || [], cur.total || 0));
    return;
  }
  drawn = k;
  var r = cur.response, live = r && r.open, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Quick responses'})];
  if (!cur.room){
    kids.push(h('h2', {id: 'rs-title', text: 'Open members’ phones first'}),
      h('p', {cls: 'kc-dlg-sub', text: 'Phones answer on the same page that follows the meeting screen. Open members’ phones, then come back here to ask your question.'}));
    if (r && r.question) kids.push(h('div', {cls: 'rs-last'}, [h('p', {cls: 'rs-label', text: 'Last question: ' + r.question}), bars(r, cur.counts || [], cur.total || 0)]));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ dlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Open members’ phones', onclick: function(){
        dlg.close(); if (window.KCMembers && KCMembers.open) KCMembers.open(); else toast('Members’ phones are in Studio > Engage.', true);
      }})]));
  } else if (live){
    kids.push(h('h2', {id: 'rs-title', text: r.question}),
      h('p', {cls: 'kc-dlg-sub', text: (r.showResults ? 'Phones see the results as they come in.' : 'Only you see the results.') + ' Phones can change their answer until you close it.'}),
      bars(r, cur.counts || [], cur.total || 0));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Close the poll', onclick: function(){ act({op: 'close'}, 'Closed. Phones stop answering'); }}),
      h('button', {cls: 'btn', type: 'button', text: 'Show on screen', title: 'The results as a Memory Card', onclick: function(){ act({op: 'show'}, 'On screen'); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Done for now', onclick: function(){ dlg.close(); }})]));
  } else {
    var q = h('input', {type: 'text', id: 'rs-q', maxlength: '200', value: draft.question, placeholder: 'For example: Did this help you this week?'});
    q.addEventListener('input', function(){ draft.question = q.value; });
    q.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); openIt(); } });
    var show = h('input', {type: 'checkbox', id: 'rs-show'}); show.checked = draft.show;
    show.addEventListener('change', function(){ draft.show = show.checked; });
    kids.push(h('h2', {id: 'rs-title', text: 'Ask everyone a quick question'}),
      h('p', {cls: 'kc-dlg-sub', text: 'Phones answer under the meeting screen, once each, with no names. You see the counts as they come in.'}),
      h('label', {cls: 'field', 'for': 'rs-q'}, [h('span', {text: 'Your question'}), q]),
      h('p', {cls: 'rs-label', id: 'rs-kind-label', text: 'How people answer'}), kindSeg(),
      draft.kind === 'choice' ? optionRows() : h('p', {cls: 'hint', text: draft.kind === 'rating' ? 'Phones show 1 to 5 stars. 1 is low, 5 is high.' : 'Phones show two big buttons: Yes and No.'}),
      h('label', {cls: 'check rs-switch'}, [show, ' Show results on phones']));
    if (r && r.question) kids.push(h('div', {cls: 'rs-last'}, [
      h('p', {cls: 'rs-label', text: 'Last question: ' + r.question}), bars(r, cur.counts || [], cur.total || 0),
      h('button', {cls: 'btn ghost small', type: 'button', text: 'Show on screen', onclick: function(){ act({op: 'show'}, 'On screen'); }})]));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ dlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Open', onclick: openIt})]));
  }
  if (cur.error) kids.push(h('p', {cls: 'pw-err', role: 'status', text: 'Reconnecting… (' + cur.error + ')'}));
  var had = document.activeElement && dlg.contains(document.activeElement) ? document.activeElement.id : '';
  dlg.innerHTML = ''; dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, kids));
  var back = had && dlg.querySelector('#' + had); if (back) back.focus();
}
function refresh(){
  return load().then(function(d){ cur = d; draw(false); }).catch(function(){});
}
/* never over the Welcome (a new install): its own pages come first */
function welcome(){ return !!(window.KCOnboarding && KCOnboarding.isOpen && KCOnboarding.isOpen()); }
function open(){
  if (welcome()) return;
  dialog(); if (!dlg.open) dlg.showModal();
  if (!timer) timer = setInterval(function(){ if (!document.hidden && !busy) refresh(); }, 2000);
  return load().then(function(d){ cur = d; draw(true); var f = dlg.querySelector('#rs-q'); if (f) f.focus(); }).catch(function(){ toast('Quick responses could not load. Try again.', true); });
}
window.KCResponses = {open: open, state: function(){ return cur; }, percentages: percentages};
})();
