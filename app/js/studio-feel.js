/* FrameDecks 26.11.22 - the Studio's finishing touches:
 *  - Settings → General: Smart Next (Next shows the live Frame's questions, then its scriptures, then the next Frame)
 *    and Sounds (a soft chime on Go Live and Next; off by default).
 *  - "Recovered": after a crash the program puts the live Frame back and the Studio says so once.
 *  - Settings search finds a setting inside its page too, opens that page and lights the setting up.
 *  - "Reset this section" on each Settings page that has settings of its own (with a confirmation).
 *  - Nothing blank while loading: the picture shows a soft shimmer until its first frame arrives. */
(function(){
'use strict';
var Store = window.KCStore;
if (!Store || !Store.served) return;
function $(id){ return document.getElementById(id); }
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function info(){ return fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }); }
function saved(o){ return post('api/app/settings', o).then(function(d){ try { document.dispatchEvent(new CustomEvent('kc-settings')); } catch(e){} return d; }); }

/* ---------- Settings → General: Smart Next and Sounds ---------- */
function renderGeneral(){
  var sec = $('sec-general'); if (!sec) return;
  var box = $('feel-settings');
  if (!box){ box = h('section', {cls: 'box feel-settings', id: 'feel-settings', 'aria-labelledby': 'feel-h'}); var first = sec.querySelector('section.box'); sec.insertBefore(box, first ? first.nextSibling : null); }
  info().then(function(d){
    var s = d.settings || {};
    box.innerHTML = '';
    var smart = h('input', {type: 'checkbox', id: 'feel-smart'}), snd = h('input', {type: 'checkbox', id: 'feel-sound'});
    smart.checked = !!s.smartNext; snd.checked = !!s.uiSounds;
    var card = h('input', {type: 'checkbox', id: 'feel-card'}); card.checked = s.leaderCard !== false;
    card.addEventListener('change', function(){ saved({leaderCard: card.checked}).then(function(){ toast(card.checked ? 'The corner card tells you what is waiting while the Studio is behind your meeting' : 'Corner card is off'); }); });
    smart.addEventListener('change', function(){ saved({smartNext: smart.checked}).then(function(){ toast(smart.checked ? 'Smart Next: questions, then scriptures, then the next Frame' : 'Next goes to the next Frame'); }); });
    snd.addEventListener('change', function(){ saved({uiSounds: snd.checked}).then(function(){ if (snd.checked && window.KCSound){ Store.loadSettings().then(function(){ KCSound.play('live'); }); } }); });
    box.appendChild(h('h3', {cls: 'vl-set-h', id: 'feel-h', text: 'Running the meeting'}));
    box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Smart Next'}), h('label', {cls: 'check'}, [smart, ' Next shows the live Frame’s questions, then its scriptures, then the next Frame'])]));
    box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Corner card'}), h('label', {cls: 'check'}, [card, ' While the Studio is behind Zoom or Teams, a card in the corner shows a verse heard or a prayer request waiting (only you see it, never in screen sharing)'])]));
    box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Sounds'}), h('label', {cls: 'check'}, [snd, ' A soft chime on Go Live and Next (only you hear it)'])]));
    box.appendChild(h('div', {cls: 'row', 'data-feature': 'summary'}, [h('span', {cls: 'lbl', text: 'Meeting summary'}), h('button', {cls: 'btn ghost small', type: 'button', id: 'feel-summary', text: 'Open the last meeting’s summary', onclick: function(){ if (window.KCSummary) KCSummary.open('latest', 'summary'); }}), ' ', h('button', {cls: 'btn ghost small', type: 'button', id: 'feel-notes', text: 'Sermon notes', onclick: function(){ if (window.KCSummary) KCSummary.notes(); }})]));
    box.appendChild(h('p', {cls: 'hint', text: 'Next, Previous, Hide all, Black screen and Emergency off can be undone for 5 seconds. When a meeting ends, its summary is offered: print it, save it as a PDF or email it.'}));
  }).catch(function(){});
}

/* ---------- "Reset this section" ---------- */
var SECTION_KEYS = {
  general: ['minimizeTo', 'ccSize', 'ccPlace', 'lowGpu', 'customChrome', 'smartNext', 'uiSounds', 'leaderCard', 'studioMode'],
  scripture: ['scriptureListen', 'scriptureAuto', 'scriptureMeeting', 'voiceCommands', 'voiceKey'],
  ipad: ['remoteNotesAdd', 'remoteNotesRead'],
  output: ['peopleSee'],
  cards: ['memDur', 'memShare', 'memLayout', 'memSide', 'memAuto']
};
var NAMES = {general: 'General', scripture: 'Scripture', ipad: 'Phone & iPad Remote', output: 'How people see it', cards: 'Memory Cards'};
function addReset(id){
  var keys = SECTION_KEYS[id], sec = $('sec-' + id); if (!keys || !sec || sec.querySelector('.kc-reset')) return;
  var head = sec.querySelector('.s-head'); if (!head) return;
  var b = h('button', {cls: 'btn ghost kc-reset', type: 'button', text: 'Reset this section', title: 'Put the settings of ' + NAMES[id] + ' back to how FrameDecks comes', onclick: function(){
    if (!window.confirm('Reset the settings of ' + NAMES[id] + ' to how FrameDecks comes?\n\nYour meetings, Frames and members are not touched.')) return;
    post('api/app/settings-reset', {keys: keys}).then(function(){
      toast(NAMES[id] + ': settings reset');
      try { document.dispatchEvent(new CustomEvent('kc-settings')); } catch(e){}
      if (window.KCShowSection) KCShowSection(id);          // the page draws itself again with the defaults
    }).catch(function(e){ toast(e.message, true); });
  }});
  head.appendChild(b);
}

/* ---------- search finds a setting inside its page, and lights it up ---------- */
var findQ = '';
function findInPages(){
  var input = $('sn-find'); if (!input) return;
  findQ = input.value.trim().toLowerCase();
  if (!findQ) return;
  var any = false;
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav [data-sgroup]'), function(g){
    if (!g.hidden){ any = true; return; }
    var tabs = document.querySelectorAll('#s-tabs [data-in="' + g.dataset.sgroup + '"], [data-in="' + g.dataset.sgroup + '"][data-sec]');
    var hit = '';
    Array.prototype.some.call(tabs, function(t){
      var sec = $('sec-' + t.dataset.sec);
      if (sec && sec.textContent.toLowerCase().indexOf(findQ) >= 0){ hit = t.dataset.sec; return true; }
      return false;
    });
    if (hit){ g.hidden = false; g.dataset.hit = hit; any = true; }
  });
  var none = $('sn-none'); if (none) none.hidden = any;
}
function lightUp(id){
  if (!findQ) return;
  var sec = $('sec-' + id); if (!sec) return;
  var rows = sec.querySelectorAll('.row, label, h3, p.hint, .s-head');
  for (var i = 0; i < rows.length; i++){
    if (rows[i].offsetParent && rows[i].textContent.toLowerCase().indexOf(findQ) >= 0){
      var el = rows[i].closest('.row') || rows[i];
      el.scrollIntoView({block: 'center', behavior: 'smooth'});
      el.classList.remove('kc-found'); void el.offsetWidth; el.classList.add('kc-found');
      return;
    }
  }
}
var find = $('sn-find');
if (find) find.addEventListener('input', findInPages);       // after Settings' own search (it runs first)

(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){
  if (id === 'general') renderGeneral();
  addReset(id);
  setTimeout(function(){ lightUp(id); }, 80);
});

/* ---------- "Recovered" ---------- */
info().then(function(d){
  var r = d && d.recovered; if (!r) return;
  var k = 'kc-recovered-' + r.at;
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch(e){}
  setTimeout(function(){ toast('Recovered: “' + r.frame + '” is live again'); }, 1200);
}).catch(function(){});

/* ---------- 26.11.30 (release audit M2): the saved plan could not be read at start ----------
   The program kept the damaged file and opened the newest backup (or a new plan). Said once on screen, so a leader
   who added Frames since that backup knows to check; Details opens Settings → Diagnostics. */
info().then(function(d){
  var p = d && d.planRecovery; if (!p || !p.at) return;
  var k = 'kc-plan-recovery-' + p.at;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch(e){}
  var msg = p.restoredFrom
    ? 'Your saved plan couldn’t be read, so the backup from ' + p.restoredFrom + ' was opened. The damaged file was kept. Check any Frames added since.'
    : 'Your saved plan couldn’t be read and no backup could either, so a new plan was started. The damaged file was kept.';
  setTimeout(function(){
    if (window.KCActions && KCActions.toastAction) KCActions.toastAction(msg, 'Details', function(){
      if (window.KCSetTab) KCSetTab('settings'); if (window.KCShowSection) KCShowSection('diag');
    });
    else toast(msg, true);
  }, 2600);
}).catch(function(){});

/* ---------- nothing blank: the picture shimmers until its first frame ---------- */
function shimmer(){
  var prog = $('program'); if (!prog) return;
  var img = prog.querySelector('img');
  if (!img || (img.complete && img.naturalWidth)) return;
  prog.classList.add('kc-skel');
  img.addEventListener('load', function(){ prog.classList.remove('kc-skel'); }, {once: true});
  setTimeout(function(){ prog.classList.remove('kc-skel'); }, 8000);     // never stays forever
}
shimmer();
})();
