/* FrameDecks 26.11.57 - the Song Library (owner, 15 November: "how people will stop using PowerPoint ... showcasing
 * songs"). One library per church on this PC (src/songbook.py, /api/songs), so a song is typed or imported once and
 * added to any Frame in two clicks.
 * - Search by title, first line, author or CCLI number; New song; Import (lyrics as text, ChordPro, OpenLyrics, more
 *   than one file at once); Paste lyrics; From PowerPoint (the words of the selected Frame's slides).
 * - Each song: title, author, CCLI song number, copyright, key, its words with [Verse 1] / [Chorus] labels, and an
 *   arrangement line (V1 C V2 C B C) that repeats parts without copying their words.
 * - Add to the selected Frame or as a new Frame: a Song Content laid out in the arrangement, with the credit line
 *   (CCLI song number, copyright and the church's CCLI licence) on its first and last part.
 * - While a song is on screen: 1-9 a verse, C the chorus, B the bridge, P the pre-chorus, E the ending (the next one
 *   after the part on screen). A song going on screen is counted once a day for the usage report (Report). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, L = window.KCSongsLib, I = window.KCIcon || function(){ return ''; };
if (!Store || !SC || !L || !Store.served) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function api(body){
  return fetch('api/songs', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work.'); return d; }); });
}
function rid(p){ return (p || 'v') + Math.random().toString(36).slice(2, 9); }
var live = null; Store.subscribe(function(st){ live = st; counted(st); });

/* ---------- the dialog ---------- */
var dlg, list, search, ed = {}, songs = [], licence = '', cur = null, fileIn;
function build(){
  dlg = h('dialog', {cls: 'kc-dlg sg-dlg', id: 'songs-dlg', 'aria-labelledby': 'sg-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', function(e){ e.stopPropagation(); });
  fileIn = h('input', {type: 'file', accept: '.txt,.cho,.chordpro,.chopro,.crd,.pro,.xml,text/plain', multiple: 'multiple', hidden: 'hidden'});
  fileIn.addEventListener('change', function(){ importFiles(Array.prototype.slice.call(fileIn.files)); fileIn.value = ''; });
  search = h('input', {type: 'search', cls: 'sg-search', placeholder: 'Search title, first line, author or CCLI number', 'aria-label': 'Search the Song Library'});
  search.addEventListener('input', function(){ clearTimeout(search.t); search.t = setTimeout(load, 150); });
  list = h('ul', {cls: 'sg-list', 'aria-label': 'Songs'});
  ed.title = h('input', {type: 'text', maxlength: '120', 'aria-label': 'Title'});
  ed.author = h('input', {type: 'text', maxlength: '160', 'aria-label': 'Author'});
  ed.ccli = h('input', {type: 'text', inputmode: 'numeric', maxlength: '12', 'aria-label': 'CCLI song number'});
  ed.copyright = h('input', {type: 'text', maxlength: '200', 'aria-label': 'Copyright'});
  ed.key = h('input', {type: 'text', maxlength: '12', 'aria-label': 'Key', placeholder: 'G'});
  ed.words = h('textarea', {rows: '12', cls: 'sg-words', 'aria-label': 'Words', placeholder: '[Verse 1]\nAmazing grace, how sweet the sound\n\n[Chorus]\nMy chains are gone…'});
  ed.order = h('input', {type: 'text', maxlength: '300', 'aria-label': 'Arrangement', placeholder: 'V1 C V2 C B C'});
  ed.parts = h('div', {cls: 'sg-parts', 'aria-live': 'polite'});
  [ed.words, ed.order].forEach(function(x){ x.addEventListener('input', preview); });
  var lic = h('input', {type: 'text', inputmode: 'numeric', maxlength: '20', cls: 'sg-lic', 'aria-label': 'Your church’s CCLI licence number', placeholder: 'Licence number'});
  lic.addEventListener('change', function(){
    licence = lic.value.replace(/[^0-9 -]/g, '').trim(); lic.value = licence;
    fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ccliLicence: licence})})
      .then(function(){ toast(licence ? 'CCLI licence ' + licence + ' is shown with each song’s credit.' : 'CCLI licence removed.'); }).catch(function(){});
  });
  ed.lic = lic;
  function field(label, input, cls){ return h('label', {cls: 'sg-f' + (cls ? ' ' + cls : '')}, [h('span', {text: label}), input]); }
  ed.del = h('button', {cls: 'btn small quiet danger', type: 'button', text: 'Delete', onclick: remove});
  ed.addHere = h('button', {cls: 'btn primary', type: 'button', html: I('plus', 15) + ' Add to this Frame', onclick: function(){ add(false); }});
  ed.addNew = h('button', {cls: 'btn', type: 'button', html: I('layout-template', 15) + ' Add as a new Frame', onclick: function(){ add(true); }});
  dlg.appendChild(h('div', {cls: 'kc-dlg-in sg-in'}, [
    h('p', {cls: 'kc-dlg-kicker', text: 'Song Library'}),
    h('h2', {id: 'sg-title', text: 'Songs for every service'}),
    h('div', {cls: 'sg-cols'}, [
      h('section', {cls: 'sg-side', 'aria-label': 'Songs'}, [
        search,
        h('div', {cls: 'sg-acts'}, [
          h('button', {cls: 'btn small primary', type: 'button', html: I('plus', 14) + ' New song', onclick: function(){ edit(null); }}),
          h('button', {cls: 'btn small', type: 'button', html: I('folder-open', 14) + ' Import…', title: 'Lyrics as text, ChordPro or OpenLyrics files (more than one at once)', onclick: function(){ fileIn.click(); }}),
          h('button', {cls: 'btn small', type: 'button', html: I('presentation', 14) + ' From PowerPoint', title: 'The words of the selected Frame’s slides become a song you can edit', onclick: fromSlides})]),
        list,
        h('div', {cls: 'sg-foot'}, [field('CCLI licence', lic, 'sg-licf'), h('button', {cls: 'btn small quiet', type: 'button', html: I('list-checks', 14) + ' Usage report', onclick: report})])]),
      h('section', {cls: 'sg-ed', 'aria-label': 'Song'}, [
        h('div', {cls: 'sg-row'}, [field('Title', ed.title, 'sg-wide'), field('Key', ed.key, 'sg-key')]),
        h('div', {cls: 'sg-row'}, [field('Author', ed.author), field('CCLI song number', ed.ccli), field('Copyright', ed.copyright)]),
        field('Words (a [Verse 1], [Chorus] or [Bridge] line starts each part; or leave a blank line between parts)', ed.words),
        field('Arrangement (optional): the parts in the order they are sung, e.g. V1 C V2 C B C', ed.order),
        ed.parts,
        h('div', {cls: 'sg-edacts'}, [h('button', {cls: 'btn', type: 'button', html: I('save', 15) + ' Save', onclick: function(){ save(); }}), ed.del,
          h('span', {cls: 'mi-spacer'}), ed.addNew, ed.addHere])])]),
    h('div', {cls: 'kc-dlg-foot'}, [h('p', {cls: 'hint', text: 'While a song is on screen: 1–9 a verse, C the chorus, B the bridge, P the pre-chorus, E the ending.'}),
      h('span', {cls: 'mi-spacer'}), h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: function(){ dlg.close(); }})])]));
  dlg.appendChild(fileIn);
  document.body.appendChild(dlg);
}
function open(){
  if (!dlg) build();
  load().then(function(){ if (!cur) edit(songs[0] || null); });
  if (window.KCSetTab && document.body.dataset.tab !== 'studio') window.KCSetTab('studio');
  if (!dlg.open) dlg.showModal();
  setTimeout(function(){ search.focus(); }, 30);
}
function load(){
  return fetch('api/songs?q=' + encodeURIComponent(search.value || ''), {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    songs = d.songs || []; licence = d.licence || ''; ed.lic.value = licence; paint();
  }).catch(function(){ toast('Could not read the Song Library.', true); });
}
function paint(){
  list.innerHTML = '';
  if (!songs.length){
    list.appendChild(h('li', {cls: 'sg-empty'}, [h('b', {text: search.value ? 'No song matches.' : 'No songs yet'}),
      h('span', {text: search.value ? 'Try fewer words, or the first line.' : 'Choose New song, paste the words and Save. Or Import lyrics, ChordPro or OpenLyrics files.'})]));
    return;
  }
  songs.forEach(function(s){
    list.appendChild(h('li', {}, [h('button', {type: 'button', cls: 'sg-item' + (cur && cur.id === s.id ? ' on' : ''), onclick: function(){ edit(s); }}, [
      h('b', {text: s.title}), h('span', {text: s.first || ''}),
      h('small', {text: [s.author, s.ccli ? 'CCLI ' + s.ccli : '', s.uses ? 'used ' + s.uses + (s.uses === 1 ? ' time' : ' times') : ''].filter(Boolean).join(' · ')})])]));
  });
}
function edit(s){
  cur = s ? JSON.parse(JSON.stringify(s)) : {id: '', title: '', author: '', ccli: '', copyright: '', key: '', sections: [], order: []};
  ed.title.value = cur.title; ed.author.value = cur.author || ''; ed.ccli.value = cur.ccli || ''; ed.copyright.value = cur.copyright || ''; ed.key.value = cur.key || '';
  ed.words.value = cur.sections.length ? L.toText(cur) : '';
  ed.order.value = (cur.order || []).map(short).join(' ');
  ed.del.hidden = !cur.id;
  preview(); paint();
  if (!s) setTimeout(function(){ ed.title.focus(); }, 30);
}
function short(label){
  var m = String(label).match(/^(verse|chorus|bridge|pre-?chorus|ending|tag|intro|outro)\s*(\d*)$/i);
  if (!m) return String(label).replace(/\s+/g, '');
  var k = m[1].toLowerCase(); return (/^pre/.test(k) ? 'P' : k === 'ending' ? 'E' : k.charAt(0).toUpperCase()) + (m[2] || '');
}
/* the song as typed: details, parts from the words, the arrangement */
function fromEditor(){
  var parsed = L.fromText(ed.words.value);
  return {id: cur ? cur.id : '', title: ed.title.value.trim() || parsed.title, author: ed.author.value.trim() || parsed.author, ccli: (ed.ccli.value || parsed.ccli).replace(/[^0-9]/g, ''),
    copyright: ed.copyright.value.trim() || parsed.copyright, key: ed.key.value.trim() || parsed.key, sections: parsed.sections,
    order: ed.order.value.trim() ? L.parseOrder(ed.order.value) : parsed.order};
}
function preview(){
  var s = fromEditor(), parts = L.arrange(s);
  ed.parts.innerHTML = '';
  if (!parts.length){ ed.parts.appendChild(h('span', {cls: 'hint', text: 'The parts appear here as you type.'})); return; }
  parts.forEach(function(p, i){ ed.parts.appendChild(h('span', {cls: 'sg-part', title: p.text, text: (i + 1) + '. ' + p.label})); });
  var missing = (s.order || []).filter(function(lab){ return !s.sections.some(function(x){ return x.label.toLowerCase().indexOf(lab.toLowerCase()) === 0; }); });
  if (missing.length) ed.parts.appendChild(h('span', {cls: 'sg-miss', text: 'Not in the words: ' + missing.join(', ')}));
}
function save(quiet){
  var s = fromEditor();
  return api({op: 'save', song: s}).then(function(d){
    cur = d.song; if (!quiet) toast('“' + cur.title + '” is saved in the Song Library.');
    ed.del.hidden = false;
    return load().then(function(){ return cur; });
  }).catch(function(e){ toast(e.message, true); return null; });
}
function remove(){
  if (!cur || !cur.id) return;
  var name = cur.title;
  if (!window.confirm('Delete “' + name + '” from the Song Library? Frames that already show it keep their copy.')) return;
  api({op: 'delete', id: cur.id}).then(function(){ toast('“' + name + '” deleted.'); cur = null; return load(); }).then(function(){ edit(songs[0] || null); })
    .catch(function(e){ toast(e.message, true); });
}

/* ---------- into a Frame ---------- */
function layerOf(song){
  var items = L.arrange(song).map(function(p){ return {id: rid('v'), label: p.label, text: p.text}; });
  return SC.cleanLayer({id: 'L' + Math.random().toString(36).slice(2, 9), kind: 'song', name: song.title, visible: true, opacity: 1,
    c: {song: song.title, items: items, at: 0, credit: L.credit(song, licence), songId: song.id}});
}
function add(asNew){
  save(true).then(function(song){
    if (!song) return;
    var sel = window.KCSelFrame ? window.KCSelFrame() : '', made = null, lid = '';
    if (!asNew && !sel){ toast('Select a Frame first, or choose Add as a new Frame.', true); return; }
    window.KCCommit(function(n){
      var l = layerOf(song); lid = l.id;
      if (asNew || !sel){
        var base = sel ? SC.find(n, sel) : null;
        made = SC.create(n, 'blank', {after: sel || null, group: base && !base.tpl ? base.group : '', name: SC.uniqueName(n, song.title)});
        if (made){ made.layers.unshift(l); var th = window.KCThemes && window.KCThemes.layerFor('song'); if (th) made.layers.push(th); }   // 26.11.57 the songs' theme
      } else {
        var sc = SC.find(n, sel); if (!sc) return;
        sc.layers.unshift(l);
        if (n.live.scene === sc.id){ n.live.on[l.id] = true; SC.songApply(l, 0); }
      }
    }).then(function(){
      dlg.close();
      var sid = made ? made.id : sel;
      if (window.KCWorkspace) window.KCWorkspace.select(sid, lid);
      toast('“' + song.title + '” is in ' + (made ? 'a new Frame' : 'this Frame') + ': Next walks its parts.');
    });
  });
}

/* ---------- import ---------- */
function importFiles(files){
  if (!files.length) return;
  Promise.all(files.slice(0, 200).map(function(f){
    return new Promise(function(ok){ var r = new FileReader(); r.onload = function(){ ok(L.fromFile(f.name, String(r.result || ''))); }; r.onerror = function(){ ok(null); }; r.readAsText(f); });
  })).then(function(read){
    var good = read.filter(function(s){ return s && s.title && s.sections.length; });
    if (!good.length){ toast('No songs found in ' + (files.length === 1 ? 'that file' : 'those files') + '.', true); return; }
    return api({op: 'import', songs: good}).then(function(d){
      toast(d.added + (d.added === 1 ? ' song added' : ' songs added') + ' to the Song Library.');
      return load().then(function(){ var first = songs.filter(function(s){ return s.id === d.ids[0]; })[0]; if (first) edit(first); });
    });
  }).catch(function(e){ toast(e.message || 'The import did not work.', true); });
}
/* the selected Frame's slides (a PowerPoint) as a song to check and save */
function fromSlides(){
  var sc = live && window.KCSelFrame ? SC.find(live, window.KCSelFrame()) : null;
  var deck = sc && sc.layers.filter(function(l){ return l.kind === 'pdf' && l.c && l.c.file; })[0];
  if (!deck){ toast('Select a Frame with PowerPoint slides first (Import… → PowerPoint slides).', true); return; }
  fetch('api/slides?file=' + encodeURIComponent(deck.c.file), {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var s = L.fromSlides(d && d.slides, deck.name || deck.c.file);
    if (!s.sections.length){ toast('These slides have no words to read (pictures only).', true); return; }
    edit(null); ed.title.value = s.title; ed.words.value = L.toText(s); preview();
    toast(s.sections.length + ' parts read from the slides. Check the words, then Save.');
  }).catch(function(){ toast('Could not read those slides.', true); });
}

/* ---------- usage report (CCLI) ---------- */
function report(){
  var month = new Date().toISOString().slice(0, 7);
  fetch('api/songs/report?month=' + month, {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var rows = d.songs || [];
    var lines = ['Song,CCLI song number,Author,Copyright,Days used'].concat(rows.map(function(r){ return [r.title, r.ccli, r.author, r.copyright, r.times].map(csv).join(','); }));
    var box = h('dialog', {cls: 'kc-dlg sg-rep', 'aria-labelledby': 'sg-rep-t'});
    var body = rows.length ? h('table', {cls: 'sg-table'}, [h('thead', {}, [h('tr', {}, ['Song', 'CCLI', 'Days used'].map(function(t){ return h('th', {text: t}); }))]),
      h('tbody', {}, rows.map(function(r){ return h('tr', {}, [h('td', {text: r.title}), h('td', {text: r.ccli || '—'}), h('td', {text: String(r.times)})]); }))])
      : h('p', {cls: 'hint', text: 'No song went on screen this month yet.'});
    box.appendChild(h('div', {cls: 'kc-dlg-in'}, [h('p', {cls: 'kc-dlg-kicker', text: 'Usage report'}), h('h2', {id: 'sg-rep-t', text: 'Songs shown in ' + new Date(month + '-01T12:00').toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}),
      h('p', {cls: 'kc-dlg-sub', text: 'Each song counts once per day it went on screen. Copy the list into your CCLI reporting.'}), body,
      h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn', type: 'button', html: I('copy', 15) + ' Copy as a table', disabled: rows.length ? null : 'disabled', onclick: function(){
        (navigator.clipboard ? navigator.clipboard.writeText(lines.join('\n')) : Promise.reject()).then(function(){ toast('Copied. Paste it into a spreadsheet.'); }).catch(function(){ toast('Could not copy.', true); }); }}),
        h('span', {cls: 'mi-spacer'}), h('button', {cls: 'btn primary', type: 'button', text: 'Done', onclick: function(){ box.close(); box.remove(); }})])]));
    document.body.appendChild(box); box.showModal();
  }).catch(function(){ toast('Could not read the usage report.', true); });
}
function csv(v){ v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

/* ---------- a song on screen: counted once a day; jump keys ---------- */
var seen = {};
function counted(st){
  var sc = SC.liveScene(st); if (!sc) return;
  sc.layers.forEach(function(l){
    if (l.kind !== 'song' || !l.c || !l.c.songId || !st.live.on[l.id]) return;
    var key = st.live.seq + ':' + l.c.songId; if (seen[key]) return; seen[key] = 1;
    api({op: 'used', id: l.c.songId}).catch(function(){});
  });
}
document.addEventListener('keydown', function(e){
  if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || document.querySelector('dialog[open]')) return;
  var k = String(e.key || '').toLowerCase(); if (!/^[1-9cbpe]$/.test(k)) return;
  var st = Store.get(), l = st && SC.liveSong(st); if (!l) return;
  var to = L.jumpTo(l.c.items, l.c.at || 0, k); if (to < 0) return;
  e.preventDefault(); e.stopImmediatePropagation();
  Store.update(function(n){ var x = SC.liveSong(n); if (x) SC.songApply(x, to); }).then(function(){
    var it = l.c.items[to]; toast((it.label || 'Part ' + (to + 1)) + ' is on screen');
  });
}, true);

/* ---------- where it opens from ---------- */
if (window.KCImport) window.KCImport.add({icon: 'music', text: 'Songs (lyrics, ChordPro, OpenLyrics)…', hint: 'into the Song Library', run: function(){ open(); setTimeout(function(){ fileIn.click(); }, 60); }});
if (window.KCAddContent) window.KCAddContent.extra('Worship', {icon: 'library', text: 'Song from the Song Library…', hint: 'search, then add', run: function(){ open(); }});
window.KCSongs = {open: open, layerOf: layerOf};
})();
