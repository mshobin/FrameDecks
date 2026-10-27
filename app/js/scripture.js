/* FrameDecks v6 - Scripture: type a reference, the text arrives (ESV API with your own key, cached on this PC
 * for offline use). Typed text (or text from the Meeting Workbook) works exactly as before. Fetching fills the verse editor (the same
 * fields Show and Save to list use), so every existing verse workflow continues from there. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var Store = window.KCStore;
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}

/* ---------- references: "rom 2 28-29" -> "Romans 2:28-29" ---------- */
var BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'];
var ALIAS = {psalms: 'Psalm', ps: 'Psalm', psa: 'Psalm', song: 'Song of Solomon', songs: 'Song of Solomon', sos: 'Song of Solomon', 'song of songs': 'Song of Solomon',
  rev: 'Revelation', revelations: 'Revelation', jn: 'John', jhn: 'John', mt: 'Matthew', mk: 'Mark', lk: 'Luke', phil: 'Philippians', php: 'Philippians',
  philem: 'Philemon', jas: 'James', heb: 'Hebrews', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes', prov: 'Proverbs', pr: 'Proverbs', jdg: 'Judges', judg: 'Judges'};
function norm(b){ return b.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
function book(word){
  var w = norm(word).replace(/^(i{1,3})\s/, function(m, r){ return r.length + ' '; }).replace(/^(first|second|third)\s/, function(m, r){ return {first: 1, second: 2, third: 3}[r] + ' '; });
  w = w.replace(/^([123])(\D)/, '$1 $2');
  if (ALIAS[w]) return ALIAS[w];
  var hit = BOOKS.filter(function(b){ return norm(b) === w; })[0];
  if (hit) return hit;
  if (w.length < 2) return null;
  var pre = BOOKS.filter(function(b){ return norm(b).indexOf(w) === 0; });
  return pre.length >= 1 ? pre[0] : null;
}
/* Returns a tidy reference, or null when the text doesn't look like one */
function parse(text){
  var m = /^\s*((?:[123]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d{1,3})(?:\s*[:. ]\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3}(?::\d{1,3})?)?(?:\s*,\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)*))?\s*$/i.exec(String(text || ''));
  if (!m) return null;
  var b = book(m[1]); if (!b) return null;
  return b + ' ' + m[2] + (m[3] ? ':' + m[3].replace(/\s+/g, '').replace(/–/g, '-').replace(/,/g, ', ') : '');
}
function chapterOf(ref){ var m = /^(.*?\d+)(?::.*)?$/.exec(ref || ''); return m ? m[1] : ref; }

/* ---------- recent passages and favourites (this PC) ---------- */
function load(k){ try { return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch(e){ return []; } }
function save(k, v){ try { localStorage.setItem(k, JSON.stringify(v.slice(0, 12))); } catch(e){} }
function remember(ref){ var r = load('bcc-scr-recent').filter(function(x){ return x !== ref; }); r.unshift(ref); save('bcc-scr-recent', r); }

/* ---------- the Scripture layer's fetch bar ---------- */
var refIn = $('scr-ref'), trSel = $('scr-tr'), msg = $('scr-msg');
function say(t, bad){ if (!msg) return; msg.textContent = t || ''; msg.className = 'scr-msg' + (bad ? ' bad' : ''); }
function setField(id, v){ var f = $(id); if (!f) return; f.value = v; f.dispatchEvent(new Event('input', {bubbles: true})); }
function fill(d){
  if ($('v-text')){ setField('v-ref', d.ref); setField('v-version', d.version || 'ESV'); setField('v-text', d.text); }   // the open editor
  else if (window.KCFrameLists) window.KCFrameLists.onVerse(d);                  // v6.5: a new scripture in this Frame
  if (refIn) refIn.value = d.ref;
  remember(d.ref); chips();
}
function fetchRef(ref, fresh){
  var r = parse(ref) || String(ref || '').trim();
  if (!r){ say('Type a reference, for example Romans 2:29.', true); return Promise.resolve(null); }
  if (!Store.served){ say('Fetching needs the installed app. Type or paste the verse text below.', true); return Promise.resolve(null); }
  if (trSel && trSel.value !== 'ESV'){ say('Type or paste the verse below, with its translation. Choose ESV (online) to fetch it.'); setField('v-ref', r); return Promise.resolve(null); }
  say('Fetching ' + r + '…');
  return fetch('api/scripture?ref=' + encodeURIComponent(r) + '&tr=ESV' + (fresh ? '&fresh=1' : ''), {cache: 'no-store'})
    .then(function(x){ return x.json(); })
    .then(function(d){
      if (d.error){ say(d.error, true); return null; }
      fill(d);
      say(d.stale ? 'Offline: the copy saved on this PC is shown.' : d.cached ? 'From this PC (saved for offline use). It is in this Frame’s list.' : 'Fetched from the ESV and saved for offline use. It is in this Frame’s list.');
      return d;
    })
    .catch(function(){ say('The program did not answer. Try again in a moment.', true); return null; });
}
function chips(){
  var box = $('scr-chips'); if (!box) return;
  box.innerHTML = '';
  var fav = load('bcc-scr-fav'), rec = load('bcc-scr-recent').filter(function(r){ return fav.indexOf(r) < 0; }).slice(0, 6);
  fav.forEach(function(r){
    var star = h('span', {'aria-hidden': 'true'}); if (window.KCIcon) star.innerHTML = window.KCIcon('star', 13); else star.textContent = '★';
    box.appendChild(h('button', {cls: 'vchip fav', type: 'button', title: 'Favourite: fetch ' + r, onclick: function(){ refIn.value = r; fetchRef(r); }}, [star, ' ' + r]));
  });
  rec.forEach(function(r){ box.appendChild(h('button', {cls: 'vchip', type: 'button', title: 'Recent: fetch ' + r, text: r, onclick: function(){ refIn.value = r; fetchRef(r); }})); });
}
if (refIn){
  var dl = $('scr-books'); BOOKS.forEach(function(b){ dl.appendChild(h('option', {value: b + ' '})); });
  refIn.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); fetchRef(refIn.value); } });
  refIn.addEventListener('blur', function(){ var p = parse(refIn.value); if (p) refIn.value = p; });
  $('scr-fetch').addEventListener('click', function(){ fetchRef(refIn.value); });
  $('scr-refresh').addEventListener('click', function(){ fetchRef(refIn.value || ($('v-ref') && $('v-ref').value), true); });
  $('scr-context').addEventListener('click', function(){
    var r = parse(refIn.value || ($('v-ref') && $('v-ref').value)); var box = $('scr-context-box');
    if (!r){ say('Type a reference first.', true); return; }
    if (!box.hidden && box.dataset.ref === chapterOf(r)){ box.hidden = true; return; }
    var ch = chapterOf(r);
    fetch('api/scripture?ref=' + encodeURIComponent(ch) + '&tr=ESV', {cache: 'no-store'}).then(function(x){ return x.json(); }).then(function(d){
      if (d.error){ say(d.error, true); return; }
      box.hidden = false; box.dataset.ref = ch; box.innerHTML = '';
      box.appendChild(h('div', {cls: 'scr-ctx-head'}, [h('b', {text: d.ref + ' (ESV)'}), h('button', {cls: 'btn quiet small', type: 'button', text: 'Close', onclick: function(){ box.hidden = true; }})]));
      box.appendChild(h('p', {cls: 'scr-ctx-text', text: d.text}));
    });
  });
  $('scr-read').addEventListener('click', function(){
    var t = ($('v-text') && $('v-text').value || '').trim();
    if (!window.speechSynthesis || !t){ say(t ? 'Read aloud is not available on this PC.' : 'Nothing to read yet.', true); return; }
    if (speechSynthesis.speaking){ speechSynthesis.cancel(); return; }
    var u = new SpeechSynthesisUtterance((($('v-ref') && $('v-ref').value) || '') + '. ' + t); speechSynthesis.speak(u);
    say('Reading aloud on this PC only (not sent to the meeting). Select Read aloud again to stop.');
  });
  $('scr-fav').addEventListener('click', function(){
    var r = parse(refIn.value || ($('v-ref') && $('v-ref').value)); if (!r) return;
    var f = load('bcc-scr-fav'), i = f.indexOf(r);
    if (i >= 0) f.splice(i, 1); else f.unshift(r);
    save('bcc-scr-fav', f); chips(); toast(i >= 0 ? 'Removed from favourites' : 'Added to favourites: ' + r);
  });
  trSel.addEventListener('change', function(){
    try { localStorage.setItem('bcc-scr-tr', trSel.value); } catch(e){}
    ['scr-fetch', 'scr-refresh', 'scr-context'].forEach(function(id){ $(id).disabled = trSel.value !== 'ESV'; });
    say(trSel.value === 'ESV' ? '' : 'Type or paste the verse below, with its translation.');
  });
  try { var t0 = localStorage.getItem('bcc-scr-tr'); if (t0) { trSel.value = t0; trSel.dispatchEvent(new Event('change')); } } catch(e){}
  chips();
}

/* ---------- Settings > Scripture ---------- */
function renderSettings(){
  var root = $('scripture-body'); if (!root) return;
  root.innerHTML = '';
  if (!Store.served){ root.appendChild(h('p', {cls: 'plain', text: 'Fetching scripture needs the installed app.'})); return; }
  fetch('api/scripture/settings', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    root.innerHTML = '';
    var key = h('input', {type: 'password', id: 'scr-key', placeholder: d.hasKey ? 'Saved (' + d.keyHint + ') - type a new key to replace it' : 'Paste your ESV API key', autocomplete: 'off', 'aria-label': 'ESV API key'});
    var status = h('p', {cls: 'hint', id: 'scr-health'});
    function show(x){
      var hl = x.health || {};
      status.textContent = (x.hasKey ? 'Key saved. ' : 'No key yet. ') + (hl.ok === true ? '✓ ' + hl.message : hl.ok === false ? '⚠ ' + hl.message : '') +
        ' · ' + x.cached + ' passage' + (x.cached === 1 ? '' : 's') + ' saved for offline use.' + (x.test && x.test !== 'ok' ? ' Test: ' + x.test : x.test === 'ok' ? ' Test: ✓ John 3:16 fetched.' : '');
      var dot = $('sn-scripture'); if (dot) dot.className = 'sn-dot ' + (hl.ok === false ? 'warn' : x.hasKey ? 'ok' : '');
    }
    function post(body){ return fetch('api/scripture/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(function(r){ return r.json(); }); }
    root.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Provider'}), h('span', {cls: 'plain', text: 'ESV API (api.esv.org) - English Standard Version'})]));
    root.appendChild(h('label', {cls: 'field'}, [h('span', {text: 'ESV API key'}), key]));
    root.appendChild(h('div', {cls: 'actions'}, [
      h('button', {cls: 'btn primary small', type: 'button', id: 'scr-key-save', text: 'Save and test', onclick: function(){
        var body = {test: true}; if (key.value.trim()) body.key = key.value.trim();
        post(body).then(function(x){ key.value = ''; show(x); toast(x.test === 'ok' ? 'ESV connected' : 'ESV: ' + x.test, x.test !== 'ok'); }); }}),
      h('button', {cls: 'btn small', type: 'button', text: 'Remove the key', onclick: function(){ post({key: ''}).then(show); }}),
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Clear the offline copies', onclick: function(){ if (confirm('Remove the passages saved on this PC?')) post({clearCache: true}).then(show); }})]));
    root.appendChild(status);
    root.appendChild(h('p', {cls: 'hint', text: 'Get a free key for church and non-commercial use at api.esv.org (Create an API application). The key stays on this PC: it is never sent to the phone remote or the overlay pages. ' +
      'Fetched passages are saved here so a Bible study keeps working without internet (up to ' + d.cacheMax + ' passages; the ESV terms limit how much may be stored). ' +
      'Other translations (NIV, NKJV, KJV, CSB, NLT, NASB…): choose “Type it myself” on the Scripture Content and type or paste the text.'}));
    show(d);
  }).catch(function(){ root.textContent = 'Not available right now.'; });
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'scripture') renderSettings(); });

window.KCScripture = {parse: parse, books: BOOKS, fetch: fetchRef, chapterOf: chapterOf,
  focus: function(ref){ if (refIn){ if (ref) refIn.value = ref; refIn.focus(); } }};
})();
