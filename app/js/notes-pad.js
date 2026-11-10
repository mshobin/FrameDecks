/* FrameDecks 9.13 - the Notes pad, one piece for every place the Notes chip opens: the Command Center (sticky note
 * under the chip), the app's top bar and the phone remote. The leader's private notes for the meeting shown, kept on
 * the PC only (src/meeting_notes.py): each note is stamped with the time and the Frame on screen.
 *   On the PC: write, edit, delete; Copy all, Save as a file, Email to me (api/notes).
 *   On the phone (api/remote/notes): adding is on unless the PC turns it off; reading is off unless the PC turns it
 *   on (Settings > People & devices > Phone & iPad Remote). Read notes are never kept on the phone: fetched only while the
 *   Notes tab is open, hidden after a minute without use and whenever the phone goes to sleep. Never on the website.
 * KCNotesPad.create({phone, getLive, SC, tell, onEscape}) returns {el, focus, paint, hide}. */
(function(){
'use strict';
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 15) : ''; }
function setText(el, t){ if (el && el.textContent !== t) el.textContent = t; }
var READ_FOR = 60000;                                   // the phone hides read notes after a minute without use

function create(o){
  var phone = !!o.phone, API = phone ? 'api/remote/notes' : 'api/notes', SC = o.SC;
  var tell = o.tell || function(){}, data = null, meetingId = '', editing = null, saving = false, perm = {canRead: !phone, canAdd: true}, idleT = 0;
  function get(url){ return fetch(url, {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); }
  function post(url, body){
    return fetch(url, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
      .then(function(r){ return r.json().catch(function(){ return {}; }); }).catch(function(){ return {error: 'Not connected to the PC.'}; });
  }
  var field = h('textarea', {cls: 'np-in', rows: '2', maxlength: '4000', 'aria-label': 'Write a note', placeholder: 'Write a note…'});
  var list = h('ol', {cls: 'np-list', 'aria-label': 'Notes for this meeting'});
  var where = h('span', {cls: 'np-where'}), count = h('span', {cls: 'np-count'});
  var save = h('button', {cls: 'np-save', type: 'button', onclick: function(){ commit(); }}, ['Save note']);
  var reveal = h('button', {cls: 'np-reveal', type: 'button', hidden: 'hidden', onclick: function(){ load(true); }}, ['Show my notes']);
  var locked = h('p', {cls: 'np-locked', hidden: 'hidden'});
  function act(icon, label, fn){ return h('button', {cls: 'np-act', type: 'button', title: label, 'aria-label': label, onclick: fn}, [h('span', {'aria-hidden': 'true', html: I(icon, 15)}), h('em', {text: label})]); }
  var acts = phone ? null : h('div', {cls: 'np-acts'}, [act('copy', 'Copy all', copyAll), act('file-text', 'Save as a file', saveFile), act('mail', 'Email to me', email)]);
  var write = h('div', {cls: 'np-write'}, [field, save]);
  var el = h('div', {cls: 'np' + (phone ? ' np-phone' : '')}, [h('div', {cls: 'np-top'}, [where, count]), write, locked, reveal, list, acts]);

  function live(){ return o.getLive ? o.getLive() : null; }
  function meeting(){
    var st = live(), m = st && SC.meetings(st).length ? SC.currentMeeting(st) : null;
    return {id: m && m.id ? String(m.id) : 'no-meeting', name: (m && m.name) || (st && st.meeting && st.meeting.title) || 'This meeting'};
  }
  function frameNow(){
    var st = live(), ls = st && SC.liveScene(st); if (!ls) return '';
    return 'Frame ' + (SC.order(st).indexOf(ls) + 1) + ' · ' + ls.name;
  }
  function when(t){ try { return new Date(t * 1000).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch(e){ return ''; } }
  function idle(){                                     // the phone: read notes leave the screen after a minute without use
    if (!phone) return;
    clearTimeout(idleT);
    if (data && data.notes) idleT = setTimeout(hide, READ_FOR);
  }
  function hide(){ if (!phone) return; clearTimeout(idleT); if (data) data.notes = null; draw(); }
  function load(show){
    var m = meeting(); meetingId = m.id;
    return get(API + '?meeting=' + encodeURIComponent(m.id) + (phone && !show ? '&peek=1' : '')).then(function(d){
      if (!d || meetingId !== m.id) return;
      if (phone) perm = {canRead: !!d.canRead, canAdd: d.canAdd !== false};
      data = d; draw(); idle();
    });
  }
  function draw(){
    var m = meeting(), notes = data && data.notes;
    setText(where, m.name + (phone ? ' · saved on the PC' : ' · on this PC only'));
    var n = notes ? notes.length : (data && data.count) || 0;
    setText(count, n ? n + (n === 1 ? ' note' : ' notes') : '');
    write.hidden = phone && !perm.canAdd;
    var msg = '';
    if (phone && !perm.canAdd && !perm.canRead) msg = 'Notes from the phone are off on the PC (Settings → People & devices → Phone & iPad Remote).';
    else if (phone && !perm.canRead) msg = 'Your notes go to the PC, stamped with the time and the Frame. Reading them here is off: turn it on at the PC (Settings → People & devices → Phone & iPad Remote).';
    locked.hidden = !msg; setText(locked, msg);
    reveal.hidden = !(phone && perm.canRead && !notes);
    list.hidden = !notes;
    list.innerHTML = '';
    if (notes && !notes.length) list.appendChild(h('li', {cls: 'np-empty', text: 'No notes yet for this meeting. They stay on the PC: never synced, never shown on screen.'}));
    var newest = fresh && notes && notes.length ? notes.reduce(function(a, b){ return (b.at || 0) >= (a.at || 0) ? b : a; }).id : null;
    fresh = false;
    (notes || []).forEach(function(nt){
      var kids = [h('div', {cls: 'np-x'}, [h('small', {text: when(nt.at) + (nt.frame ? ' · ' + nt.frame : '')}), h('p', {text: nt.text})])];
      if (!phone){
        kids.push(h('button', {cls: 'np-b', type: 'button', title: 'Edit this note', 'aria-label': 'Edit this note', html: I('pencil', 14), onclick: function(){ edit(nt); }}));
        kids.push(h('button', {cls: 'np-b', type: 'button', title: 'Delete this note', 'aria-label': 'Delete this note', html: I('trash-2', 14), onclick: function(){ remove(nt); }}));
      }
      list.appendChild(h('li', {cls: 'np-note' + (editing === nt.id ? ' editing' : '') + (nt.id === newest ? ' kc-new' : '')}, kids));   // 26.11.1 a new note is written in
    });
    list.scrollTop = list.scrollHeight;
    if (acts) acts.hidden = false;
    hint();
  }
  function hint(){                                     // what the next note will be stamped with
    setText(save, editing ? 'Save change' : 'Save note');
    var p = editing ? 'Change the note (Esc cancels)' : 'Write a note… Enter saves it with the time' + (frameNow() ? ' and “' + frameNow() + '”' : '');
    if (field.placeholder !== p) field.placeholder = p;
  }
  function send(body){
    return post(API, Object.assign({meeting: meeting().id}, body)).then(function(d){
      if (d && d.error){ tell(d.error, true); return null; }
      if (phone && d && d.count != null){             // the phone: the count; the list again only if it was showing
        perm = {canRead: !!d.canRead, canAdd: d.canAdd !== false};
        var shown = !!(data && data.notes);
        data = Object.assign({}, data || {}, {count: d.count, notes: null});
        if (shown && perm.canRead) load(true); else draw();
      } else if (!phone && d && d.notes){ data = d; draw(); }
      return d;
    });
  }
  var fresh = false;                                   // 26.11.1 the note just added is drawn in once (notes-pad.css)
  function commit(){
    var text = field.value.trim(); if (saving) return;
    if (!text && !editing){ field.focus(); return; }
    saving = true;
    var p = editing ? send({action: 'edit', id: editing, text: text}) : send({action: 'add', text: text, name: meeting().name, frame: frameNow()});
    var adding = !editing;
    p.then(function(d){ saving = false; if (d && !d.error){ field.value = ''; editing = null; fresh = adding; draw(); tell(phone ? '✓ Saved on the PC' : '✓ Saved on this PC'); } field.focus(); });
  }
  function edit(nt){ editing = nt.id; field.value = nt.text; draw(); field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
  function remove(nt){ send({action: 'delete', id: nt.id}).then(function(d){ if (d && !d.error){ if (editing === nt.id){ editing = null; field.value = ''; } tell('✓ Note deleted'); draw(); } }); }
  function asText(){
    var notes = (data && data.notes) || [];
    return 'Notes: ' + meeting().name + '\n\n' + notes.map(function(nt){ return when(nt.at) + (nt.frame ? ' · ' + nt.frame : '') + '\n' + nt.text; }).join('\n\n') + '\n';
  }
  function none(){ if ((data && data.notes || []).length) return false; tell('No notes yet.', true); return true; }
  function copyAll(){
    if (none()) return;
    var t = asText();
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ tell('✓ Copied'); }, function(){
      var a = h('textarea', {}); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); tell('✓ Copied'); } catch(e){ tell('Could not copy', true); } a.remove(); });
  }
  function saveFile(){
    if (none()) return;
    fetch('api/notes?format=md&meeting=' + encodeURIComponent(meeting().id), {cache: 'no-store'}).then(function(r){ return r.text(); }).then(function(md){
      var a = h('a', {href: URL.createObjectURL(new Blob([md], {type: 'text/markdown'})), download: 'Notes - ' + meeting().name.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.md'});
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      tell('✓ Saved: choose where in the window that opens');
    });
  }
  function email(){
    if (none()) return;
    var body = asText(); if (body.length > 1800) body = body.slice(0, 1800) + '\n… (the rest: Save as a file)';
    post('api/app/open-external', {url: 'mailto:?subject=' + encodeURIComponent('Notes: ' + meeting().name) + '&body=' + encodeURIComponent(body)});
    tell('✓ Opening your email app');
  }
  field.addEventListener('keydown', function(e){
    if (e.altKey || e.ctrlKey || e.metaKey) return;      // Alt shortcuts (the Frames) still work here
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); commit(); }
    else if (e.key === 'Escape'){ e.preventDefault(); if (editing){ editing = null; field.value = ''; draw(); } else if (o.onEscape) o.onEscape(); }
  });
  ['pointerdown', 'keydown', 'scroll'].forEach(function(ev){ el.addEventListener(ev, idle, {passive: true}); });
  if (phone) document.addEventListener('visibilitychange', function(){ if (document.hidden) hide(); });   // the phone sleeps: notes leave the screen
  return {el: el, focus: function(){ field.focus({preventScroll: true}); }, hide: hide,
    paint: function(){ var m = meeting(); if (!data || m.id !== meetingId) load(); else hint(); }, reload: function(){ return load(); }};
}
window.KCNotesPad = {create: create};
})();
