/* FrameDecks 26.11.23 - the prayer requests wall in the Studio (Engage > Prayer requests, or the palette).
 * Open the wall: a QR and a short code for framedecks.com/pray. Requests arrive here only; nothing goes on screen by
 * itself. For each one: Show (anonymously), Show with name (when one was given), or Done. "We're praying for…" puts
 * every request shown so far on one card. On screen they are Memory Cards. The list follows the PC by riding the
 * window's one waiting request ('pr'); closing the wall forgets every request (src/prayer_wall.py). */
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
function post(body){
  return fetch('api/prayer', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function load(){ return fetch('api/prayer', {cache: 'no-store'}).then(function(r){ return r.json(); }); }
function ago(t){ var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m + ' min ago'; }

var dlg = null, cur = null, busy = false;
function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg pw-dlg', id: 'pw-dlg', 'aria-labelledby': 'pw-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
  document.body.appendChild(dlg);
  return dlg;
}
function act(body, msg){
  if (busy) return; busy = true;
  post(body).then(function(d){ cur = d; draw(); if (msg) toast(msg); }).catch(function(e){ toast(e.message, true); })
    .then(function(){ busy = false; });
}
function qr(url){
  var box = h('div', {cls: 'pw-qr', role: 'img', 'aria-label': 'QR code for sending a prayer request'});
  if (window.qrcode){ var q = window.qrcode(0, 'M'); q.addData(url); q.make(); box.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
  return box;
}
function item(it){
  var named = !!it.name;
  var acts = it.status === 'done' ? [h('button', {cls: 'btn ghost small', type: 'button', text: 'Back to the list', onclick: function(){ act({op: 'again', id: it.id}); }})]
    : [h('button', {cls: 'btn small', type: 'button', text: it.status === 'shown' ? 'Show again' : 'Show', title: 'On screen without a name', onclick: function(){ act({op: 'show', id: it.id}, 'On screen'); }}),
       named ? h('button', {cls: 'btn ghost small', type: 'button', text: 'Show with “' + it.name + '”', onclick: function(){ act({op: 'show', id: it.id, name: true}, 'On screen'); }}) : null,
       h('button', {cls: 'btn ghost small', type: 'button', text: 'Done', onclick: function(){ act({op: 'done', id: it.id}); }})];
  return h('li', {cls: 'pw-item pw-' + it.status}, [
    h('p', {cls: 'pw-body', text: it.body}),
    h('p', {cls: 'pw-meta', text: (named ? it.name : 'No name') + ' · ' + ago(it.at) + (it.status === 'shown' ? ' · shown' : it.status === 'done' ? ' · done' : '')}),
    h('div', {cls: 'pw-acts'}, acts)]);
}
function draw(){
  if (!dlg || !dlg.open || !cur) return;
  var d = cur, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Prayer requests'})];
  if (!d.open){
    kids.push(h('h2', {id: 'pw-title', text: 'A prayer wall for this meeting'}),
      h('p', {cls: 'kc-dlg-sub', text: 'People scan a code and send a request from their phone, with no account. Requests come only to you: nothing is shown until you choose it, names only if you choose them, and nothing is kept once you close the wall.'}));
    if (d.error) kids.push(h('p', {cls: 'pw-err', role: 'alert', text: d.error}));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ dlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Open the prayer wall', onclick: function(){ act({op: 'open'}, 'Prayer wall open'); }})]));
  } else {
    var items = d.items.slice().sort(function(a, b){ var o = {'new': 0, shown: 1, done: 2}; return (o[a.status] - o[b.status]) || (a.at - b.at); });
    kids.push(h('h2', {id: 'pw-title', text: d.waiting ? d.waiting + (d.waiting === 1 ? ' request waiting' : ' requests waiting') : 'The prayer wall is open'}),
      h('div', {cls: 'pw-grid'}, [
        h('div', {cls: 'pw-join'}, [qr(d.url), h('p', {cls: 'pw-code', text: d.code}),
          h('p', {cls: 'pw-how', text: 'Scan, or go to ' + d.url.replace(/^https?:\/\//, '').replace(/#.*$/, '') + ' and type the code.'}),
          h('button', {cls: 'btn ghost small', type: 'button', text: 'Show the code on screen', title: 'For people joining on Zoom or Teams', onclick: function(){ act({op: 'invite'}, 'On screen'); }})]),
        h('div', {cls: 'pw-list-wrap'}, [items.length ? h('ol', {cls: 'pw-list'}, items.map(item))
          : h('p', {cls: 'pw-empty', text: 'Nothing yet. Requests appear here as they arrive.'})])]));
    if (d.error) kids.push(h('p', {cls: 'pw-err', role: 'status', text: 'Reconnecting… (' + d.error + ')'}));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Close the wall', onclick: function(){
        if (window.confirm('Close the prayer wall?\n\nThe code stops working and every request in this list is forgotten.')) act({op: 'close'}, 'Prayer wall closed');
      }}),
      h('button', {cls: 'btn', type: 'button', text: 'We’re praying for…', title: 'One card with every request shown so far, without names', onclick: function(){ act({op: 'list'}, 'On screen'); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Done for now', onclick: function(){ dlg.close(); }})]));
  }
  var keep = dlg.querySelector('.pw-list-wrap'), top = keep ? keep.scrollTop : 0;
  dlg.innerHTML = ''; dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, kids));
  var again = dlg.querySelector('.pw-list-wrap'); if (again) again.scrollTop = top;
}
function refresh(){ return load().then(function(d){ var before = cur ? cur.waiting : 0; cur = d; draw(); badge(d, before); }).catch(function(){}); }
/* a request arrived while the dialog is closed: say so once */
function badge(d, before){
  if (d.open && d.waiting > before && !(dlg && dlg.open) && window.KCActions && KCActions.toastAction)
    KCActions.toastAction('🙏 ' + (d.waiting === 1 ? 'A prayer request is waiting' : d.waiting + ' prayer requests are waiting'), 'Read', open);
}
function open(){ dialog(); if (!dlg.open) dlg.showModal(); return refresh(); }
window.KCPrayer = {open: open};
if (Store.ride) Store.ride('pr', refresh);
})();
