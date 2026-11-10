/* FrameDecks 26.11.41 - Sync in the Frames panel, as on framedecks.com: the Sync button (where the meeting clock was)
 * first shows what would change, Frame by Frame, and changes nothing until you press Sync now:
 *   From framedecks.com   new, changed or removed Frames (a Frame on screen waits until it leaves)
 *   From this PC          new, changed or removed Frames sent to the workspace
 *   Changed in both places  the website's version is kept, and this PC's is kept as a copy (nothing is lost)
 *   Already here           the same Frame made in both places: kept once, never twice
 * The program does the work (src/cloud_sync.py Engine.sync_preview, then the same round as Sync now everywhere else:
 * window.KCResync in js/account.js). Light: nothing runs until the button is pressed. */
(function(){
'use strict';
var btn = document.getElementById('frames-sync');
if (!btn || document.body.getAttribute('data-win') === 'spotlight') return;
function $(id){ return document.getElementById(id); }
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function call(action){
  return fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: action})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'The program did not answer.'); return d; }); });
}
var WHAT = {'new': 'New', changed: 'Changed', removed: 'Removed'};
function plural(n, one){ return n + ' ' + one + (n === 1 ? '' : 's'); }

function dialog(){
  var dlg = $('fsync-dlg');
  if (!dlg){
    dlg = h('dialog', {cls: 'kc-dlg fsync-dlg', id: 'fsync-dlg', 'aria-labelledby': 'fsync-title'});
    dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }
  return dlg;
}
function group(title, icon, rows, hint){
  if (!rows.length) return null;
  return h('section', {cls: 'fsync-group'}, [
    h('h3', {}, [h('span', {cls: 'fsync-ic', 'aria-hidden': 'true', text: icon}), title, h('span', {cls: 'fsync-n', text: String(rows.length)})]),
    hint ? h('p', {cls: 'hint', text: hint}) : null,
    h('ul', {cls: 'fsync-list'}, rows.slice(0, 60).map(function(r){
      return h('li', {}, [h('span', {cls: 'fsync-name', text: r.name}), r.what ? h('span', {cls: 'fsync-what fsync-' + r.what, text: WHAT[r.what] || r.what}) : null,
        r.held ? h('span', {cls: 'fsync-held', text: 'waits until it leaves the screen'}) : null]);
    }).concat(rows.length > 60 ? [h('li', {cls: 'hint', text: 'and ' + (rows.length - 60) + ' more'})] : []))]);
}
function paint(d){
  var dlg = dialog(), p = d.preview, res = d.result;
  dlg.innerHTML = '';
  var body = h('div', {cls: 'fsync-body'}), go = null;
  if (d.first){
    body.appendChild(h('p', {text: 'This PC has just been connected. Settings → Sync shows what the first sync will do; nothing changes until you choose.'}));
    go = h('button', {cls: 'btn primary', type: 'button', text: 'Open Settings → Sync', onclick: function(){ dlg.close(); if (window.KCSetTab) KCSetTab('settings'); if (window.KCShowSection) KCShowSection('account'); }});
  } else if (!p){
    body.appendChild(h('p', {cls: 'fsync-msg', role: 'status', text: (res && res.message) || 'Sync could not look right now.'}));
    if (d.state === 'unlinked' || /not linked/.test((res && res.message) || ''))
      go = h('button', {cls: 'btn primary', type: 'button', text: 'Link this PC', onclick: function(){ dlg.close(); if (window.KCSetTab) KCSetTab('settings'); if (window.KCShowSection) KCShowSection('account'); }});
  } else if (p.empty){
    body.appendChild(h('p', {cls: 'fsync-msg fsync-ok', role: 'status', text: 'Everything is up to date. This PC and framedecks.com have the same Frames.'}));
  } else {
    var other = [];
    if (p.otherIn) other.push(plural(p.otherIn, 'other change') + ' from framedecks.com (meeting details, order or looks)');
    if (p.otherOut) other.push(plural(p.otherOut, 'other change') + ' from this PC');
    [group('From framedecks.com', '↓', p['in']),
     group('From this PC', '↑', p.out),
     group('Changed in both places', '⇄', (p.both || []).map(function(n){ return {name: n}; }), 'The website’s version is kept, and this PC’s is kept beside it as a copy, so nothing is lost.'),
     group('Already here', '✓', (p.same || []).map(function(n){ return {name: n}; }), 'The same Frame was made in both places: it is kept once, not twice.')]
      .forEach(function(g){ if (g) body.appendChild(g); });
    if (other.length) body.appendChild(h('p', {cls: 'hint fsync-other', text: other.join('; ') + '.'}));
    go = h('button', {cls: 'btn primary', type: 'button', id: 'fsync-go', text: 'Sync now'});
    go.onclick = function(){ run(go); };                  // a property, so Done can replace it
  }
  dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, [
    h('p', {cls: 'kc-dlg-kicker', text: 'Sync'}),
    h('h2', {id: 'fsync-title', text: d.workspace ? 'Sync with “' + d.workspace + '”' : 'Sync your Frames'}),
    h('p', {cls: 'kc-dlg-sub', text: 'What Sync now changes, before it does. Frames are matched by who they are, so nothing is added twice.'}),
    body,
    h('p', {cls: 'fsync-result', id: 'fsync-result', role: 'status', 'aria-live': 'polite'}),
    h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn', type: 'button', text: go ? 'Cancel' : 'Close', onclick: function(){ dlg.close(); }}), go])]));
  if (!dlg.open) dlg.showModal();
  (go || dlg.querySelector('.kc-dlg-foot .btn')).focus();
}
function run(go){
  go.disabled = true; go.textContent = 'Syncing…';
  var sync = window.KCResync ? window.KCResync() : call('sync-now').then(function(d){ return d.result || {}; });
  Promise.resolve(sync).then(function(r){
    var out = $('fsync-result'); if (out) out.textContent = (r && r.message) || '';
    go.textContent = r && r.outcome === 'failed' ? 'Try again' : 'Done';
    go.disabled = false;
    go.onclick = r && r.outcome === 'failed' ? function(){ run(go); } : function(){ var d = $('fsync-dlg'); if (d) d.close(); };
  });
}
function open(){
  btn.disabled = true; btn.classList.add('is-busy');
  call('preview').then(paint, function(e){ paint({result: {message: e.message}}); })
    .then(function(){ btn.disabled = false; btn.classList.remove('is-busy'); });
}
btn.addEventListener('click', function(e){ e.stopPropagation(); open(); });
window.KCFramesSync = {open: open};
})();
