/* FrameDecks 26.11.24 - Members' phones (Studio > Engage, or the palette). One code and one QR for everyone in the
 * meeting: on framedecks.com/follow their phone shows what is on the meeting screen as it changes, takes prayer requests
 * (when that is on) and, after the meeting, the sermon notes you share (from the meeting summary).
 * Prayer requests come only to you: nothing is shown until you choose it (src/prayer_wall.py); only what is already on
 * the meeting screen is shared (src/member_room.py). The list follows the PC by riding the window's one waiting
 * request ('pr'). Replaces 26.11.23's prayer wall dialog. */
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
function load(){ return fetch('api/members', {cache: 'no-store'}).then(function(r){ return r.json(); }); }
function ago(t){ var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m + ' min ago'; }

var dlg = null, cur = null, busy = false;
function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg pw-dlg', id: 'pw-dlg', 'aria-labelledby': 'pw-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
  document.body.appendChild(dlg);
  return dlg;
}
/* url 'api/members' (the room) or 'api/prayer' (one request); both answer with the new state */
function act(url, body, msg){
  if (busy) return Promise.resolve(); busy = true;
  return post(url, body).then(function(d){ if (url === 'api/prayer') cur.prayer = d; else cur = d; draw(); if (msg) toast(msg); })
    .catch(function(e){ toast(e.message, true); }).then(function(){ busy = false; });
}
function qr(url){
  var box = h('div', {cls: 'pw-qr', role: 'img', 'aria-label': 'QR code for members’ phones'});
  if (window.qrcode){ var q = window.qrcode(0, 'M'); q.addData(url); q.make(); box.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
  return box;
}
function item(it){
  var named = !!it.name, P = 'api/prayer';
  var acts = it.status === 'done' ? [h('button', {cls: 'btn ghost small', type: 'button', text: 'Back to the list', onclick: function(){ act(P, {op: 'again', id: it.id}); }})]
    : [h('button', {cls: 'btn small', type: 'button', text: it.status === 'shown' ? 'Show again' : 'Show', title: 'On screen without a name', onclick: function(){ act(P, {op: 'show', id: it.id}, 'On screen'); }}),
       named ? h('button', {cls: 'btn ghost small', type: 'button', text: 'Show with “' + it.name + '”', onclick: function(){ act(P, {op: 'show', id: it.id, name: true}, 'On screen'); }}) : null,
       h('button', {cls: 'btn ghost small', type: 'button', text: 'Done', onclick: function(){ act(P, {op: 'done', id: it.id}); }})];
  return h('li', {cls: 'pw-item pw-' + it.status}, [
    h('p', {cls: 'pw-body', text: it.body}),
    h('p', {cls: 'pw-meta', text: (named ? it.name : 'No name') + ' · ' + ago(it.at) + (it.status === 'shown' ? ' · shown' : it.status === 'done' ? ' · done' : '')}),
    h('div', {cls: 'pw-acts'}, acts)]);
}
function prayerSwitch(on){
  var box = h('input', {type: 'checkbox', id: 'pw-prayer'}); box.checked = on;
  box.addEventListener('change', function(){
    if (!box.checked && cur.prayer.items.length && !window.confirm('Stop taking prayer requests?\n\nEvery request in this list is forgotten.')){ box.checked = true; return; }
    act('api/members', {op: 'prayer', on: box.checked}, box.checked ? 'Taking prayer requests' : 'Prayer requests are off');
  });
  return h('label', {cls: 'check pw-switch'}, [box, ' Take prayer requests']);
}
function draw(){
  if (!dlg || !dlg.open || !cur) return;
  var room = cur.room, pr = cur.prayer, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Members’ phones'})];
  if (!room.open){
    var withPrayer = h('input', {type: 'checkbox', id: 'pw-with-prayer', checked: 'checked'});
    kids.push(h('h2', {id: 'pw-title', text: 'Bring everyone’s phone into the meeting'}),
      h('p', {cls: 'kc-dlg-sub', text: 'One code for everyone, with no account: their phone shows what is on the meeting screen as it changes, can send you a prayer request, and later gets the sermon notes you share. Only what is already on the meeting screen is shared; requests come only to you.'}),
      h('label', {cls: 'check'}, [withPrayer, ' Take prayer requests too']));
    if (room.error) kids.push(h('p', {cls: 'pw-err', role: 'alert', text: room.error}));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ dlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Open for members’ phones', onclick: function(){ act('api/members', {op: 'open', prayer: withPrayer.checked}, 'Members can join now'); }})]));
  } else {
    var items = (pr.items || []).slice().sort(function(a, b){ var o = {'new': 0, shown: 1, done: 2}; return (o[a.status] - o[b.status]) || (a.at - b.at); });
    var right = [h('div', {cls: 'pw-right-head'}, [prayerSwitch(!!pr.open), pr.waiting ? h('span', {cls: 'pw-waiting', text: pr.waiting + ' waiting'}) : null])];
    if (pr.open) right.push(items.length ? h('ol', {cls: 'pw-list'}, items.map(item)) : h('p', {cls: 'pw-empty', text: 'No prayer requests yet. They appear here as they arrive.'}));
    else right.push(h('p', {cls: 'pw-empty', text: 'Phones follow the meeting screen. Switch on prayer requests whenever you want them.'}));
    var join = [qr(room.url), h('p', {cls: 'pw-code', text: room.code}),
      h('p', {cls: 'pw-how', text: 'Scan, or go to ' + room.url.replace(/^https?:\/\//, '').replace(/#.*$/, '') + ' and type the code.'}),
      h('button', {cls: 'btn ghost small', type: 'button', text: 'Show the code on screen', title: 'For people joining on Zoom or Teams', onclick: function(){ act('api/members', {op: 'invite'}, 'On screen'); }})];
    if (room.notesShared) join.push(h('p', {cls: 'pw-shared'}, ['Sermon notes shared ', h('button', {cls: 'linkish', type: 'button', text: 'Take back', onclick: function(){ act('api/members', {op: 'unshare-notes'}, 'Notes taken back'); }})]));
    kids.push(h('h2', {id: 'pw-title', text: pr.waiting ? pr.waiting + (pr.waiting === 1 ? ' prayer request waiting' : ' prayer requests waiting') : 'Members can join'}),
      h('div', {cls: 'pw-grid'}, [h('div', {cls: 'pw-join'}, join), h('div', {cls: 'pw-list-wrap'}, right)]));
    var err = room.error || pr.error; if (err) kids.push(h('p', {cls: 'pw-err', role: 'status', text: 'Reconnecting… (' + err + ')'}));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Close for members', onclick: function(){
        if (window.confirm('Close members’ phones?\n\nThe code stops working, phones stop following, shared notes are taken back and every prayer request in this list is forgotten.')) act('api/members', {op: 'close'}, 'Closed for members');
      }}),
      pr.open ? h('button', {cls: 'btn', type: 'button', text: 'We’re praying for…', title: 'One card with every request shown so far, without names', onclick: function(){ act('api/prayer', {op: 'list'}, 'On screen'); }}) : null,
      h('button', {cls: 'btn primary', type: 'button', text: 'Done for now', onclick: function(){ dlg.close(); }})]));
  }
  var keep = dlg.querySelector('.pw-list-wrap'), top = keep ? keep.scrollTop : 0;
  dlg.innerHTML = ''; dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, kids));
  var again = dlg.querySelector('.pw-list-wrap'); if (again) again.scrollTop = top;
}
function refresh(){ return load().then(function(d){ var before = cur ? cur.prayer.waiting : 0; cur = d; draw(); badge(d, before); }).catch(function(){}); }
/* a request arrived while the dialog is closed: say so once */
function badge(d, before){
  if (d.prayer.open && d.prayer.waiting > before && !(dlg && dlg.open) && window.KCActions && KCActions.toastAction)
    KCActions.toastAction('🙏 ' + (d.prayer.waiting === 1 ? 'A prayer request is waiting' : d.prayer.waiting + ' prayer requests are waiting'), 'Read', open);
}
function open(){ dialog(); if (!dlg.open) dlg.showModal(); return refresh(); }
window.KCMembers = {open: open, state: function(){ return cur; }, refresh: refresh};
window.KCPrayer = window.KCMembers;          // 26.11.23's name
if (Store.ride) Store.ride('pr', refresh);
})();
