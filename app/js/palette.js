/* Kingdom Connect v6.7 - Command palette (Spotlight style). Ctrl+K or Ctrl+Space (Settings > Keyboard shortcuts).
 * 6.8: also its own Spotlight window (spotlight.html), opened by a system-wide shortcut even from the tray.
 *
 * One box finds and does everything: Frames, Content, the Frames' own questions and scriptures, announcements and
 * discussion topics, templates and the Content Library, branding, backgrounds, members and birthdays, settings,
 * a Bible reference, recent items, and commands (Go Live, New Frame, Teleprompter, Export the meeting, theme…).
 *
 * Fast by design: the list is built from the shared state when the palette opens (a few thousand short strings at
 * most), each key press ranks it in one pass (fuzzy: whole word > word start > anywhere > letters in order), and only
 * the top 50 are drawn. Nothing runs while it is closed. Choosing a Frame or an item selects it; only a command such
 * as Go Live changes what is on screen. */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes;
if (!Store || !SC) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
var live = null;
Store.subscribe(function(st){ live = st; });
var STANDALONE = document.body.getAttribute('data-win') === 'spotlight';   // 6.8 the Spotlight window
var W = function(){ return window.BSFWorkspace; };
function studio(){ if (window.BSFSetTab) window.BSFSetTab('studio'); }
function settings(sec){ if (window.BSFSetTab) window.BSFSetTab('settings'); if (window.BSFShowSection) setTimeout(function(){ window.BSFShowSection(sec); }, 0); }
function click(el){ if (el) el.click(); }

/* ---------- shortcuts that open it (configurable) ---------- */
var KEYS_KEY = 'kc-palette-keys', DEF_KEYS = ['Ctrl+K', 'Ctrl+Space'];
function keys(){ try { var k = JSON.parse(lsGet(KEYS_KEY, 'null')); if (Array.isArray(k) && k.length === 2) return k; } catch(e){} return DEF_KEYS.slice(); }
function comboOf(e){
  var k = e.key; if (!k || /^(Control|Shift|Alt|Meta)$/.test(k)) return null;
  if (k === ' ' || k === 'Spacebar') k = 'Space'; else if (k.length === 1) k = k.toUpperCase();
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k;
}

/* ---------- what can be found ---------- */
var KIND = {cmd: 'Command', frame: 'Frame', tpl: 'Template', lib: 'Library', content: 'Content', question: 'Question', verse: 'Scripture',
  text: 'Text', brand: 'Branding', bg: 'Background', member: 'Member', birthday: 'Birthday', setting: 'Settings', bible: 'Bible', recent: 'Recent'};
var SECTIONS = [['general', 'General', 'appearance theme dark light'], ['meeting', 'Meeting & Branding', 'logo brand meeting name organization colour accent'],
  ['overlays', 'Birthdays', 'birthday reminders'], ['scripture', 'Scripture', 'bible esv api key translation'], ['transitions', 'Transitions', 'fade dip cut profile'],
  ['recording', 'Recording', 'record mp4'], ['display', 'Zoom / Display', 'overlay obs browser source links'], ['vcam', 'KingdomConnect Camera', 'camera zoom teams blur background look resolution'],
  ['ipad', 'Phone & iPad Remote', 'remote pin qr phone tablet'], ['keys', 'Keyboard shortcuts', 'keys hotkeys palette'], ['security', 'Security', 'pin privacy'],
  ['data', 'Data / Backup', 'backup restore export import'], ['diag', 'Diagnostics', 'problems errors logs'], ['about', 'About', 'version credits']];
function commands(){
  var PT = window.BSFPresenterTools, TP = window.BSFTeleprompter, MI = window.BSFMeetingImport, sel = W() && W().selected();
  var c = [
    ['golive', 'Go Live', 'take selected frame on screen', function(){ if (W()) W().take(); }, 'T'],
    ['next', 'Next Frame', 'forward advance', function(){ if (W()) W().step(1); }, ']'],
    ['prev', 'Previous Frame', 'back', function(){ if (W()) W().step(-1); }, '['],
    ['newframe', 'New Frame', 'add create blank', function(){ studio(); if (W()) W().newFrame(); }],
    ['dup', 'Duplicate the selected Frame', 'copy clone', function(){ studio(); if (W()) W().duplicate(); }, 'Ctrl+D'],
    ['quick', 'Quick Start…', 'new meeting ready-made frames', function(){ studio(); if (W()) W().quickStart(); }],
    ['library', 'Browse the Content Library', 'templates ready-made', function(){ studio(); if (W()) W().library(); }],
    ['hideall', 'Hide all Content', 'clear escape', function(){ click($('hide-all') || document.querySelector('[data-cb="hideAll"]')); }, 'Esc'],
    ['blackout', 'Black screen on / off', 'blackout', function(){ if (PT) PT.blackout(); }, 'K'],
    ['freeze', 'Freeze the picture on / off', 'hold', function(){ if (PT) PT.freeze(); }, 'F'],
    ['annotate', 'Annotate on / off', 'draw pen ink', function(){ if (PT) PT.annotate(); }, 'D'],
    ['prompter', 'Teleprompter on / off', 'script notes prompter dock', function(){ studio(); if (TP) TP.toggle(); }, 'R'],
    ['prompterwin', 'Teleprompter window', 'second screen speaker view', function(){ if (PT && PT.speaker) PT.speaker(); }],
    ['overlay', 'Teleprompter overlay (over Zoom / Teams)', 'meeting leader transparent see-through glass on top prompter', function(){ if (PT && PT.overlay) PT.overlay(); }, 'Shift+R'],
    ['share', 'Share Window (Presentation window)', 'present window zoom share screen', function(){ studio(); click($('s2-present')); }],
    ['export', 'Export this meeting (Excel)', 'save workbook xlsx download', function(){ if (MI) MI.exportMeeting(); }],
    ['import', 'Import a meeting from Excel…', 'workbook xlsx open', function(){ if (MI) MI.pick(); }],
    ['template', 'Download the Excel template', 'workbook xlsx', function(){ if (MI) MI.template(); }],
    ['branding', 'Open Branding', 'logo meeting name colour', function(){ settings('meeting'); }],
    ['knock', 'Remove the logo background', 'transparent png', function(){ if (window.BSFBrandSettings) window.BSFBrandSettings.removeBackground(); }],
    ['camera', 'Camera background (blur, image)', 'kingdomconnect blur background', function(){ settings('vcam'); }],
    ['shortcuts', 'Keyboard shortcuts', 'keys palette', function(){ settings('keys'); }]];
  if (window.BSFTheme){
    var t = window.BSFTheme.get();
    c.push(['theme', t === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme', 'appearance theme dark light mode', function(){ window.BSFTheme.set(t === 'light' ? 'dark' : 'light'); }]);
    c.push(['themesys', 'Theme: match Windows', 'appearance system', function(){ window.BSFTheme.set('system'); }]);
  }
  if (W() && W().contentKinds && sel && sel.scene){
    W().contentKinds().forEach(function(k){ c.push(['add-' + k.id, 'Add Content: ' + k.name, 'new insert ' + k.id, function(){ studio(); W().addContent(k.id); }]); });
  }
  /* commands Spotlight can run while the main window stays in the tray */
  var BG = {golive: 1, next: 1, prev: 1, hideall: 1, blackout: 1, freeze: 1, prompterwin: 1, overlay: 1, share: 0};
  return c.map(function(x){ return {key: 'cmd:' + x[0], kind: 'cmd', title: x[1], sub: x[4] ? 'Shortcut ' + x[4] : 'Command', words: x[2], run: x[3], bg: !!BG[x[0]]}; });
}
function trimmed(s, n){ s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function index(){
  var out = commands(), st = live; if (!st) return out;
  SC.order(st).concat(st.scenes.filter(function(s){ return s.tpl; })).forEach(function(sc){
    var isLive = st.live.scene === sc.id;
    out.push({key: 'frame:' + sc.id, kind: sc.tpl ? 'tpl' : 'frame', title: sc.name, sub: (isLive ? 'Live · ' : '') + (sc.group || (sc.tpl ? 'Template' : 'Frame')) + ' · ' +
      (sc.layers.map(function(l){ return l.name; }).join(', ') || 'empty'), words: sc.group || '',
      run: function(){ studio(); if (sc.tpl && W()) W().fromTemplate(sc.id); else if (W()) W().select(sc.id, null, true); }});
    sc.layers.forEach(function(l){
      var c = l.c || {};
      if (Array.isArray(c.items) && (l.kind === 'question' || l.kind === 'scripture')){
        c.items.forEach(function(it, i){
          var verse = l.kind === 'scripture';
          out.push({key: 'item:' + it.id, kind: verse ? 'verse' : 'question', title: verse ? (it.ref || 'Scripture ' + (i + 1)) + (it.version ? ' · ' + it.version : '') : trimmed(it.text, 120) || '(empty question)',
            sub: (verse ? trimmed(it.text, 90) + ' · ' : (it.label ? it.label + ' · ' : '')) + sc.name, words: (verse ? it.text : '') + ' ' + (it.label || ''),
            run: function(){ studio(); if (W()) W().showItem(sc.id, l.id, it.id); }});
        });
      }
      var txt = SC.isText(l.kind) && l.kind !== 'brand' ? SC.brandText(st, c.text || '') : '';
      out.push({key: 'layer:' + l.id, kind: l.kind === 'brand' ? 'brand' : l.kind === 'background' || l.kind === 'rect' && /background/i.test(l.name) ? 'bg' : txt ? 'text' : 'content',
        title: l.name + (c.title && c.title !== l.name ? ' · ' + c.title : ''), sub: (txt ? trimmed(txt, 80) + ' · ' : SC.info[l.kind].name + ' · ') + sc.name,
        words: SC.info[l.kind].name + ' ' + (c.file || '') + ' ' + txt,
        run: function(){ studio(); if (W()) W().select(sc.id, l.id, true); }});
    });
  });
  (SC.library || []).forEach(function(e){
    out.push({key: 'lib:' + e.id, kind: 'lib', title: e.name, sub: 'Content Library · ' + ((SC.libraryCats || []).filter(function(c){ return c[0] === e.cat; }).map(function(c){ return c[1]; })[0] || 'Add to your Frames'), words: (e.layers || []).map(function(d){ return d[0]; }).join(' '),
      run: function(){ studio(); if (W()) W().addFromLibrary(e.id, e.name); }});
  });
  var b = st.brand || {};
  if (b.logo || b.meeting || b.org) out.push({key: 'brand:assets', kind: 'brand', title: [b.meeting, b.org].filter(Boolean).join(' · ') || 'Your logo', sub: 'Brand assets · logo, names, colour',
    words: 'logo brand assets ' + (b.logo ? 'logo' : ''), run: function(){ settings('meeting'); }});
  SECTIONS.forEach(function(x){ out.push({key: 'set:' + x[0], kind: 'setting', title: x[1], sub: 'Settings', words: x[2], run: function(){ settings(x[0]); }}); });
  var api = window.BSFMembersAPI, rows = api && api.directory ? api.directory() : [];
  rows.forEach(function(m){
    out.push({key: 'mem:' + m.id, kind: m.b && m.b.days <= 31 ? 'birthday' : 'member', title: m.name,
      sub: m.b && m.b.days <= 31 ? (m.b.days === 0 ? 'Birthday today' : m.b.days === 1 ? 'Birthday tomorrow' : 'Birthday in ' + m.b.days + ' days') : (m.role || m.email || 'Member'),
      words: (m.email || '') + ' ' + (m.role || '') + (m.b && m.b.days <= 31 ? ' birthday' : ''), run: function(){ if (api.open) api.open(m.id); }});
  });
  return out;
}

/* ---------- fuzzy ranking ---------- */
function norm(s){ return String(s || '').toLowerCase(); }
function score(q, title, words){
  var t = norm(title), i = t.indexOf(q);
  if (i === 0) return 1000 - t.length * 0.5;                      // starts with it
  if (i > 0) return (/[\s\-·:/(]/.test(t.charAt(i - 1)) ? 800 : 600) - i - t.length * 0.2;   // word start, or inside
  var w = norm(words); if (w && w.indexOf(q) >= 0) return 400 - t.length * 0.2;
  // letters in order (e.g. "nf" → "New Frame"); a gap costs, a word start pays
  var p = 0, s = 300, last = -1;
  for (var k = 0; k < q.length; k++){
    if (q.charAt(k) === ' ') continue;
    var j = t.indexOf(q.charAt(k), p); if (j < 0) return -1;
    if (j === 0 || /[\s\-·:/(]/.test(t.charAt(j - 1))) s += 12;
    if (last >= 0) s -= Math.min(20, j - last - 1);
    last = j; p = j + 1;
  }
  return s - t.length * 0.3;
}
var KIND_BONUS = {cmd: 30, frame: 40, content: 10, text: 10, question: 5, verse: 5, tpl: 0, lib: -5, brand: 5, bg: 5, setting: 0, member: -5, birthday: 0};
function rank(all, q){
  var words = norm(q).trim().split(/\s+/).filter(Boolean), res = [];
  if (!words.length) return [];
  for (var i = 0; i < all.length; i++){
    var it = all[i], total = 0, ok = true;
    for (var w = 0; w < words.length; w++){ var s = score(words[w], it.title, it.sub + ' ' + it.words + ' ' + KIND[it.kind]); if (s < 0){ ok = false; break; } total += s; }
    if (ok) res.push({it: it, s: total + (KIND_BONUS[it.kind] || 0) + (recentRank[it.key] ? 60 - recentRank[it.key] * 5 : 0)});
  }
  res.sort(function(a, b){ return b.s - a.s; });
  return res.slice(0, 50).map(function(r){ return r.it; });
}

/* ---------- recent ---------- */
var RECENT_KEY = 'kc-palette-recent', recentRank = {};
function recents(){ try { var r = JSON.parse(lsGet(RECENT_KEY, '[]')); return Array.isArray(r) ? r : []; } catch(e){ return []; } }
var FREQ_KEY = 'kc-palette-freq';
function freq(){ try { var f = JSON.parse(lsGet(FREQ_KEY, '{}')); return f && typeof f === 'object' ? f : {}; } catch(e){ return {}; } }
function remember(it){
  var r = recents().filter(function(k){ return k !== it.key; }); r.unshift(it.key); lsSet(RECENT_KEY, JSON.stringify(r.slice(0, 12)));
  var f = freq(); f[it.key] = (f[it.key] || 0) + 1;                   // 6.8 frequently used (kept to the top 60)
  var keys = Object.keys(f).sort(function(a, b){ return f[b] - f[a]; }).slice(0, 60), g = {}; keys.forEach(function(k){ g[k] = f[k]; });
  lsSet(FREQ_KEY, JSON.stringify(g));
}

/* ---------- the palette ---------- */
var back = null, input, list, items = [], all = [], active = 0, opener = null, t = 0;
function build(){
  input = h('input', {type: 'text', cls: 'pal-in', placeholder: 'Search Frames, Content, verses, commands, settings…', 'aria-label': 'Search and commands', autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list'});
  list = h('ul', {cls: 'pal-list', id: 'pal-list', role: 'listbox', 'aria-label': 'Results'});
  var foot = h('div', {cls: 'pal-foot'}, [h('span', {}, [h('kbd', {text: '↑'}), h('kbd', {text: '↓'}), ' move']), h('span', {}, [h('kbd', {text: 'Enter'}), ' open']),
    h('span', {}, [h('kbd', {text: 'Esc'}), ' close']), h('span', {cls: 'pal-keys-hint', text: keys().join(' or ')})]);
  var box = h('div', {cls: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette'}, [
    h('div', {cls: 'pal-top'}, [h('span', {cls: 'pal-ic', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'}), input]), list, foot]);
  back = h('div', {cls: 'pal-back', hidden: 'hidden'}, [box]);
  back.addEventListener('mousedown', function(e){ if (e.target === back) close(); });
  input.addEventListener('input', function(){ cancelAnimationFrame(t); t = requestAnimationFrame(update); });
  input.addEventListener('keydown', function(e){
    e.stopPropagation();                                                // the Studio's single-key shortcuts never fire here
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if (items.length){ active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; mark(); } }
    else if (e.key === 'PageDown' || e.key === 'PageUp'){ e.preventDefault(); if (items.length){ active = Math.max(0, Math.min(items.length - 1, active + (e.key === 'PageDown' ? 8 : -8))); mark(); } }
    else if (e.key === 'Enter'){ e.preventDefault(); if (items[active]) choose(items[active]); }
    else if (e.key === 'Escape'){ e.preventDefault(); close(); }
    else if (e.key === 'Tab'){ e.preventDefault(); }
  });
  document.body.appendChild(back);
}
function row(it, n){
  var li = h('li', {role: 'option', id: 'pal-' + n, cls: 'pal-row pal-' + it.kind, 'aria-selected': String(n === active)}, [
    h('span', {cls: 'pal-kind', text: KIND[it.kind]}),
    h('span', {cls: 'pal-text'}, [h('b', {text: it.title}), it.sub ? h('small', {text: it.sub}) : null])]);
  li.addEventListener('mousedown', function(e){ e.preventDefault(); choose(it); });
  li.addEventListener('mousemove', function(){ if (active !== n){ active = n; mark(); } });
  return li;
}
function draw(groups){
  list.innerHTML = ''; var n = 0;
  groups.forEach(function(g){
    if (!g.items.length) return;
    if (g.label) list.appendChild(h('li', {cls: 'pal-group', role: 'presentation', text: g.label}));
    g.items.forEach(function(it){ list.appendChild(row(it, n++)); });
  });
  if (!n) list.appendChild(h('li', {cls: 'pal-none', role: 'presentation', text: input.value.trim() ? 'Nothing found. Try fewer letters.' : 'Type to search.'}));
  mark();
}
function mark(){
  Array.prototype.forEach.call(list.querySelectorAll('.pal-row'), function(li, n){ li.setAttribute('aria-selected', String(n === active)); if (n === active) li.scrollIntoView({block: 'nearest'}); });
  if (items[active]) input.setAttribute('aria-activedescendant', 'pal-' + active); else input.removeAttribute('aria-activedescendant');
}
function update(){
  var q = input.value;
  if (!q.trim()){                                                     // empty: recent items, then useful commands
    var byKey = {}; all.forEach(function(it){ byKey[it.key] = it; });
    var rec = recents().map(function(k){ return byKey[k]; }).filter(Boolean).slice(0, 6);
    var f = freq(), often = Object.keys(f).filter(function(k){ return f[k] > 1; }).sort(function(a, b){ return f[b] - f[a]; })
      .map(function(k){ return byKey[k]; }).filter(function(x){ return x && rec.indexOf(x) < 0; }).slice(0, 5);
    var sug = (STANDALONE ? ['cmd:overlay', 'cmd:golive', 'cmd:next', 'cmd:prompterwin', 'cmd:blackout', 'cmd:hideall'] : ['cmd:golive', 'cmd:newframe', 'cmd:prompter', 'cmd:overlay', 'cmd:export', 'cmd:branding'])
      .map(function(k){ return byKey[k]; }).filter(function(x){ return x && rec.indexOf(x) < 0 && often.indexOf(x) < 0; });
    items = rec.concat(often, sug); active = 0;
    draw([{label: rec.length ? 'Recent' : '', items: rec}, {label: 'Frequently used', items: often}, {label: 'Suggested', items: sug}]);
    return;
  }
  var found = rank(all, q), ref = window.BSFScripture && window.BSFScripture.parse && window.BSFScripture.parse(q);
  if (ref) found.unshift({key: 'bible:' + ref, kind: 'bible', title: ref, sub: 'Fetch into the Scripture Content (ESV)', run: function(){ bible(ref); }});
  items = found; active = 0;
  draw([{label: '', items: found}]);
}
function bible(ref){ studio(); if (W()) W().fetchVerse(ref); }
function choose(it){
  if (it.kind !== 'bible') remember(it);
  if (STANDALONE){                                                    // Spotlight: the main window does it
    post('palette-run', {key: it.key, bg: !!it.bg}); input.value = ''; return;
  }
  close(true);
  setTimeout(function(){ try { it.run(); } catch(e){ toast('That could not be done: ' + (e.message || e), true); } }, 0);
}
function open(q){
  if (!back) build();
  if (!back.hidden){ input.select(); return; }
  if (document.querySelector('dialog[open], .app-modal-back')) return;
  opener = document.activeElement;
  recentRank = {}; recents().forEach(function(k, i){ recentRank[k] = i + 1; });
  all = STANDALONE ? cached() : index();
  back.hidden = false; document.body.classList.add('pal-open');
  input.value = q || ''; update();
  input.focus(); input.select();
  if (STANDALONE) refreshIndex();
}
function close(chosen){
  if (STANDALONE){ post('win', {win: 'spotlight', op: 'hide'}); return; }
  if (!back || back.hidden) return;
  back.hidden = true; document.body.classList.remove('pal-open'); all = []; items = []; list.innerHTML = '';
  if (!chosen && opener && opener.focus && document.contains(opener)) opener.focus({preventScroll: true});
}

document.addEventListener('keydown', function(e){
  if (STANDALONE || window.BSFShortcutsCapturing || capturing) return;
  var c = comboOf(e); if (!c) return;
  if (keys().indexOf(c) >= 0){ e.preventDefault(); e.stopPropagation(); if (back && !back.hidden) close(); else open(); }
}, true);
/* ---------- Settings > Keyboard shortcuts: the keys that open the palette ---------- */
var capturing = false;
function mountKeys(root){
  function render(msg){
    root.innerHTML = '';
    var k = keys();
    root.appendChild(h('p', {cls: 'hint', text: 'Opens the command palette from anywhere in Kingdom Connect, even while typing. Use Ctrl, Alt or both with a key.'}));
    var table = h('div', {cls: 'kb-table'});
    [0, 1].forEach(function(n){
      var btn = h('button', {cls: 'btn small', type: 'button', text: 'Change'});
      btn.addEventListener('click', function(){
        capturing = true; btn.textContent = 'Press keys…'; btn.classList.add('capturing');
        function onKey(e){
          e.preventDefault(); e.stopPropagation();
          if (e.key === 'Escape'){ done(); return render(); }
          var c = comboOf(e); if (!c) return;
          if (!/^(Ctrl|Alt)\+/.test(c)){ done(); return render('Use Ctrl or Alt with the key, so it never interferes with typing.'); }
          var kk = keys(); kk[n] = c; lsSet(KEYS_KEY, JSON.stringify(kk)); done(); render('Saved: ' + c);
        }
        function done(){ capturing = false; document.removeEventListener('keydown', onKey, true); }
        document.addEventListener('keydown', onKey, true);
      });
      table.appendChild(h('div', {cls: 'kb-row'}, [h('span', {cls: 'cat-dot live'}), h('span', {cls: 'kb-name', text: n ? 'Command palette (second key)' : 'Command palette'}),
        h('span', {cls: 'kb-keys'}, k[n].split('+').map(function(p){ return h('kbd', {cls: 'key', text: p}); })), btn, h('span')]));
    });
    root.appendChild(table);
    root.appendChild(h('div', {cls: 'actions'}, [h('button', {cls: 'btn quiet small', type: 'button', text: 'Reset to Ctrl+K and Ctrl+Space', onclick: function(){ lsSet(KEYS_KEY, JSON.stringify(DEF_KEYS)); render('Reset'); }})]));
    if (msg) root.appendChild(h('p', {cls: 'hint', role: 'status', text: msg}));
  }
  render();
}
var pk = $('pal-keys'); if (pk) mountKeys(pk);

/* ---------- 6.8 Spotlight (spotlight.html, its own window, opened by a system-wide shortcut) ----------
 * The main window keeps running in the tray, so it builds the list (exportIndex) and runs the choice (runKey). */
function post(action, body){
  return fetch('api/app/' + action, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json(); }).catch(function(){ return {}; });
}
var CACHE_KEY = 'kc-spotlight-index';
function cached(){ try { var c = JSON.parse(lsGet(CACHE_KEY, '[]')); return Array.isArray(c) ? c : []; } catch(e){ return []; } }
function refreshIndex(){
  post('palette-index').then(function(d){
    if (!d || !Array.isArray(d.items) || !d.items.length) return;
    all = d.items; lsSet(CACHE_KEY, JSON.stringify(all.filter(function(it){ return it.kind !== 'member' && it.kind !== 'birthday'; }).slice(0, 3000)));
    if (back && !back.hidden) update();
  });
}
function exportIndex(){
  return index().map(function(it){ return {key: it.key, kind: it.kind, title: it.title, sub: it.sub, words: it.words || '', bg: !!it.bg}; });
}
function runKey(key){
  key = String(key || '');
  if (key.indexOf('bible:') === 0) return bible(key.slice(6));
  var it = index().filter(function(x){ return x.key === key; })[0];
  if (!it){ toast('That item is no longer there.', true); return false; }
  try { it.run(); } catch(e){ toast('That could not be done: ' + (e.message || e), true); }
  return true;
}
if (STANDALONE){
  open();
  window.addEventListener('blur', function(){ setTimeout(function(){ if (!document.hasFocus()) close(); }, 120); });
  window.BSFSpotlight = {opened: function(){ input.value = ''; recentRank = {}; recents().forEach(function(k, i){ recentRank[k] = i + 1; });
    all = cached(); update(); input.focus(); refreshIndex();
    var box = back.querySelector('.pal'); box.classList.remove('spot-in'); void box.offsetWidth; box.classList.add('spot-in'); }};
}

window.BSFPalette = {open: open, close: close, rank: rank, score: score, exportIndex: exportIndex, runKey: runKey};
})();
