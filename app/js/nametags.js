/* FrameDecks 26.11.33 - speaker name tags: "John Mathew · Reading" across the bottom of the picture in two clicks.
 * A name tag is a Lower Third (the same card on FrameDecks vCam and the overlay pages) kept in the Frame on air,
 * marked c.tag; showing one fills it in and puts it on screen, Hide takes it off. It belongs to the Frame on air, so
 * the next Frame starts clean. Names come from the member list (with their role), from what you type, and from the
 * last eight you showed (kept on this PC, shared by the Studio and the Command Center). Engage → Name tags. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC) return;
var KEY = 'kc-nametags', AUTO_KEY = 'kc-nametags-auto';
function $(id){ return document.getElementById(id); }
function h(tag, a, kids){
  var el = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function say(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
function recents(){ try { var r = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(r) ? r.filter(function(x){ return x && x.name; }).slice(0, 8) : []; } catch(e){ return []; } }
function remember(name, role){
  var r = recents().filter(function(x){ return x.name.toLowerCase() !== name.toLowerCase(); });
  r.unshift({name: name, role: role || ''});
  try { localStorage.setItem(KEY, JSON.stringify(r.slice(0, 8))); } catch(e){}
}
function autoSec(){ try { var v = Number(localStorage.getItem(AUTO_KEY)); return [0, 8, 15].indexOf(v) >= 0 ? v : 0; } catch(e){ return 0; } }
function tagLayer(sc){ return sc && sc.layers.filter(function(l){ return l.kind === 'lowerthird' && l.c && l.c.tag; })[0]; }
function onAir(){ var st = Store.get(); return st && st.live && st.live.scene ? SC.find(st, st.live.scene) : null; }
function showing(){ var st = Store.get(), sc = onAir(), l = tagLayer(sc); return l && st.live.on[l.id] ? {name: l.c.title, role: l.c.text} : null; }

var hideT = 0;
function show(name, role){
  name = String(name || '').trim().slice(0, 80); role = String(role || '').trim().slice(0, 120);
  if (!name) return Promise.resolve(false);
  if (!onAir()){ say('Go Live first: the name tag shows on the Frame on air.', true); return Promise.resolve(false); }
  remember(name, role);
  clearTimeout(hideT);
  return Store.update(function(n){
    var sc = SC.find(n, n.live.scene); if (!sc) return;
    var l = tagLayer(sc);
    if (!l){
      l = SC.cleanLayer({kind: 'lowerthird', name: 'Name tag', visible: false, c: {tag: true, pos: 'lower-left', anim: 'rise', label: true}});
      l.c.tag = true;
      sc.layers.unshift(l);
    }
    l.c.title = name; l.c.text = role;
    n.live.on[l.id] = true;
  }).then(function(){
    var s = autoSec();
    if (s) hideT = setTimeout(hide, s * 1000);
    say('Name tag: ' + name + (role ? ' · ' + role : ''));
    return true;
  });
}
function hide(){
  clearTimeout(hideT);
  var sc = onAir(), l = tagLayer(sc);
  if (!l) return Promise.resolve(false);
  return Store.update(function(n){ delete n.live.on[l.id]; }).then(function(){ return true; });
}

/* ---------- the Studio's dialog ---------- */
var dlg = null;
function members(){ var api = window.KCMembersAPI; return api && api.directory ? api.directory().filter(function(m){ return m.name; }) : []; }
/* never over the Welcome (a new install): its own pages come first */
function welcome(){ return !!(window.KCOnboarding && KCOnboarding.isOpen && KCOnboarding.isOpen()); }
function open(){
  if (welcome()) return;
  if (!dlg){
    dlg = h('dialog', {cls: 'kc-dlg nt-dlg', id: 'nt-dlg', 'aria-labelledby': 'nt-title'});
    dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }
  draw();
  if (!dlg.open) dlg.showModal();
  var f = $('nt-name'); if (f) f.focus();
}
function draw(){
  var list = members(), now = showing(), auto = autoSec();
  var name = h('input', {type: 'text', id: 'nt-name', list: 'nt-people', maxlength: 80, placeholder: 'Type a name or choose a member', autocomplete: 'off'});
  var role = h('input', {type: 'text', id: 'nt-role', maxlength: 120, placeholder: 'Reading, Worship, Host… (optional)', autocomplete: 'off'});
  var people = h('datalist', {id: 'nt-people'}, list.map(function(m){ return h('option', {value: m.name, label: m.role || ''}); }));
  name.addEventListener('input', function(){
    var m = list.filter(function(x){ return x.name.toLowerCase() === name.value.trim().toLowerCase(); })[0];
    if (m && m.role && !role.value) role.value = m.role;
  });
  function go(){ show(name.value, role.value).then(function(ok){ if (ok) draw(); }); }
  name.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); go(); } });
  role.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); go(); } });
  var autoSeg = h('div', {cls: 'seg', role: 'radiogroup', 'aria-label': 'How long it stays'}, [[0, 'Until hidden'], [8, '8 seconds'], [15, '15 seconds']].map(function(o){
    return h('button', {type: 'button', role: 'radio', 'aria-checked': String(auto === o[0]), onclick: function(){ try { localStorage.setItem(AUTO_KEY, String(o[0])); } catch(e){} draw(); }}, [o[1]]);
  }));
  var rec = recents();
  var inner = h('div', {cls: 'kc-dlg-in'}, [
    h('p', {cls: 'kc-dlg-kicker', text: 'Engage'}), h('h2', {id: 'nt-title', text: 'Name tags'}),
    h('p', {cls: 'kc-dlg-sub', text: now ? 'On screen: ' + now.name + (now.role ? ' · ' + now.role : '') : 'A name and role across the bottom of the picture, on the Frame on air.'}),
    h('div', {cls: 'row'}, [h('label', {cls: 'lbl', 'for': 'nt-name', text: 'Name'}), name, people]),
    h('div', {cls: 'row'}, [h('label', {cls: 'lbl', 'for': 'nt-role', text: 'Role'}), role]),
    h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Stays'}), autoSeg]),
    rec.length ? h('div', {cls: 'nt-recent', role: 'group', 'aria-label': 'Recent name tags'}, [h('span', {cls: 'hint', text: 'Recent'})].concat(rec.map(function(r){
      return h('button', {cls: 'btn small ghost', type: 'button', title: 'Show ' + r.name, onclick: function(){ show(r.name, r.role).then(function(ok){ if (ok) draw(); }); }}, [r.name + (r.role ? ' · ' + r.role : '')]);
    }))) : null,
    h('div', {cls: 'kc-dlg-foot'}, [
      now ? h('button', {cls: 'btn ghost', type: 'button', id: 'nt-hide', text: 'Hide name tag', onclick: function(){ hide().then(draw); }}) : null,
      h('button', {cls: 'btn ghost', type: 'button', text: 'Close', onclick: function(){ dlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', id: 'nt-show', text: 'Show on screen', onclick: go})])]);
  dlg.innerHTML = ''; dlg.appendChild(inner);
}

window.KCNameTags = {show: show, hide: hide, recents: recents, showing: showing, open: open};
})();
