/* FrameDecks v6.7 - Command palette (Spotlight style). Ctrl+K or Ctrl+Space (Settings > Keyboard shortcuts).
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
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
var live = null;
Store.subscribe(function(st){ live = st; });
var STANDALONE = document.body.getAttribute('data-win') === 'spotlight';   // 6.8 the Spotlight window
var W = function(){ return window.KCWorkspace; };
function studio(){ if (window.KCSetTab) window.KCSetTab('studio'); }
function settings(sec){ if (window.KCSetTab) window.KCSetTab('settings'); if (window.KCShowSection) setTimeout(function(){ window.KCShowSection(sec); }, 0); }
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
var KIND = {cmd: 'Command', meeting: 'Meeting', card: 'Memory', frame: 'Frame', tpl: 'Template', lib: 'Library', content: 'Content', question: 'Question', verse: 'Scripture',
  text: 'Text', brand: 'Branding', bg: 'Background', member: 'Member', birthday: 'Birthday', setting: 'Settings', bible: 'Bible', recent: 'Recent'};
var SECTIONS = [   // 26.11.32 in the order of Settings' six groups
  ['features', 'Features', 'features switch on off simple bible study full lighter'], ['general', 'Running the meeting', 'smart next corner card sounds summary sermon notes general'],
  ['meeting', 'Meeting & Branding', 'logo brand meeting name organization colour accent appearance theme dark light season christmas'], ['transitions', 'Transitions', 'fade dip cut profile'],
  ['scripture', 'Scripture', 'bible esv api key translation'], ['overlays', 'Birthdays', 'birthday reminders'], ['memory', 'Memory Cards', 'memory cards chat bubbles capture beside below seconds'],
  ['output', 'How people see it', 'zoom teams share window projector tv obs camera'], ['vcam', 'FrameDecks vCam and Recording', 'framedecks vcam framerelay camera zoom teams blur background look resolution record recording mp4'],
  ['display', 'Projector, TV and OBS', 'zoom display overlay obs browser source links'], ['listening', 'Listening', 'listen microphone spoken voice commands right ctrl key follow my voice'],
  ['ipad', 'Phone & iPad Remote', 'remote pin qr phone tablet'], ['account', 'Sync', 'sync workspace website cloud link connect framedecks.com add a device invite someone allow team devices qr'], ['security', 'Security', 'pin privacy'],
  ['pc', 'Window & performance', 'window tray minimize command center size graphics performance ribbon'], ['keys', 'Keyboard shortcuts', 'keys hotkeys palette'],
  ['data', 'Data / Backup', 'backup restore export import'], ['diag', 'Diagnostics', 'problems errors logs'], ['about', 'About', 'version credits']];
function commands(){
  var PT = window.KCPresenterTools, TP = window.KCTeleprompter, sel = W() && W().selected();
  var c = [
    ['golive', 'Go Live', 'take selected frame on screen', function(){ if (W()) W().take(); }, 'T'],
    ['studio', 'Open the Studio', 'studio frames main window plan', function(){ studio(); }],   /* 9.6 Spotlight */
    ['next', 'Next Frame', 'forward advance', function(){ if (W()) W().step(1); }, ']'],
    ['prev', 'Previous Frame', 'back', function(){ if (W()) W().step(-1); }, '['],
    ['newframe', 'New Frame', 'add create blank', function(){ studio(); if (W()) W().newFrame(); }],
    ['dup', 'Duplicate the selected Frame', 'copy clone', function(){ studio(); if (W()) W().duplicate(); }, 'Ctrl+D'],
    ['quick', 'Quick Start…', 'new meeting ready-made frames', function(){ studio(); if (W()) W().quickStart(); }],
    ['library', 'Browse the Content Library', 'templates ready-made', function(){ studio(); if (W()) W().library(); }],
    ['hideall', 'Hide all Content', 'clear escape', function(){ click($('hide-all') || document.querySelector('[data-cb="hideAll"]')); }, 'Esc'],
    ['blackout', 'Black screen on / off', 'blackout', function(){ if (PT) PT.blackout(); }, 'K'],
    ['freeze', 'Freeze the picture on / off', 'hold', function(){ if (PT) PT.freeze(); }, 'F'],
    // 26.11.14 Listen for scripture: Ask when off, Off when on (Auto: Command Center, phone, Settings → Listening)
    ['listen', 'Listen for scripture on / off', 'scripture verse bible reference spoken voice microphone listen hear auto', function(){
      var V = window.KCVerseListen, st = V && V.state(); if (V) V.mode(st && st.enabled ? 'off' : 'ask').then(function(d){ if (d) toast(d.enabled ? 'Listening for scripture while a Frame is live' : 'Listen for scripture is off'); }); }],
    ['annotate', 'Annotate on / off', 'draw pen ink', function(){ if (PT) PT.annotate(); }, 'D'],
    ['sharedraw', 'Draw on the Share Window', 'draw pen ink annotate live tools share window zoom teams meeting', function(){ post('annotate', {op: 'mode', mode: 'draw'}); }],   /* 9.7 */
    ['sharespot', 'Spotlight on the Share Window', 'spotlight pointer point laser annotate live tools share window zoom teams meeting', function(){ post('annotate', {op: 'mode', mode: 'spot'}); }],
    ['prompter', 'Teleprompter on / off', 'script notes prompter speaker overlay zoom teams on top', function(){ if (TP) TP.toggle(); }, 'R'],
    ['nametags', 'Name tags (a speaker’s name and role)', 'name tag lower third speaker reader host role caption', function(){ if (window.KCNameTags) KCNameTags.open(); }],
    ['slides', 'Every slide of the PowerPoint on screen', 'slides powerpoint ppt overview grid all slides jump search run order hide zoom sorter', function(){ if (window.KCSlides) KCSlides.open({studio: !!window.KCSlideTools}); }],
    ['responses', 'Polls and responses (members’ phones)', 'poll vote yes no rating question response survey phones', function(){ if (window.KCResponses) KCResponses.open(); }],
    ['capture', 'Capture copies on / off (Memory Cards)', 'memory card chat overlay copy clipboard capture zoom teams chatgpt claude copilot slack discord', function(){ if (window.KCMemory) window.KCMemory.toggleCapture(); }],
    ['share', 'Share Window (Presentation window)', 'present window zoom share screen', function(){ studio(); click($('s2-present')); }],
    ['frameimport', 'Import Frame File (.frame)', 'import frame file offline service pc website plan', function(){ settings('data'); if (window.KCFrameFile && window.KCFrameFile.pick) window.KCFrameFile.pick(); }],
    ['members', 'Members’ phones (follow along, prayer requests, sermon notes)', 'members phones follow along prayer requests wall pray qr sermon notes', function(){ if (window.KCMembers) KCMembers.open(); }],
    ['sermonnotes', 'Sermon notes (the last meeting, for members)', 'sermon notes minutes members print pdf share', function(){ if (window.KCSummary) KCSummary.notes(); }],
    ['summary', 'Meeting summary (the last meeting, to print or email)', 'summary minutes report attendance meeting past print email', function(){ if (window.KCSummary) KCSummary.open('latest'); }],
    ['helpguide', 'Step-by-step guide (framedecks.com/help)', 'help guide how to start learn tutorial', function(){ window.open('https://framedecks.com/help#guide', '_blank', 'noopener'); }],
    ['resync', 'Sync now', 'sync now resync linked pcs workspace cloud latest changes', function(){ if (window.KCResync) window.KCResync(); else settings('account'); }],
    ['frameexport', 'Export Frame File (.frame)', 'export frame file offline save plan', function(){ settings('data'); if (window.KCFrameFile && window.KCFrameFile.exportFile) window.KCFrameFile.exportFile(); }],
    ['excel', 'Meeting from Excel (Settings → Data / Backup)', 'import export template workbook xlsx', function(){ settings('data'); }],   /* 6.11: Excel lives in Settings */
    ['branding', 'Open Branding', 'logo meeting name colour', function(){ settings('meeting'); }],
    ['knock', 'Remove the logo background', 'transparent png', function(){ if (window.KCBrandSettings) window.KCBrandSettings.removeBackground(); }],
    ['camera', 'Camera background (blur, image)', 'framedecks blur background', function(){ settings('vcam'); }],
    ['shortcuts', 'Keyboard shortcuts', 'keys palette', function(){ settings('keys'); }],
    ['welcome', 'Welcome tour (Frames, Decks, Content)', 'welcome onboarding intro tour frames decks content', function(){ if (window.KCOnboarding) window.KCOnboarding.open(); }],
    ['guide', 'Setup guide (guided tour)', 'help start tour onboarding first steps', function(){ if (window.KCGuide) window.KCGuide.open(); }]];
  if (window.KCTheme){
    var t = window.KCTheme.get();
    c.push(['theme', t === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme', 'appearance theme dark light mode', function(){ window.KCTheme.set(t === 'light' ? 'dark' : 'light'); }]);
    c.push(['themesys', 'Theme: match Windows', 'appearance system', function(){ window.KCTheme.set('system'); }]);
    c.push(['themews', 'Look: same as my workspace', 'appearance workspace look', function(){ window.KCTheme.look('workspace'); }]);
    (window.KCTheme.looks || []).forEach(function(l){ c.push(['look-' + l.id, 'Look: ' + l.name, 'appearance theme colour color look', function(){ window.KCTheme.look(l.id); }]); });
  }
  if (W() && W().contentKinds && sel && sel.scene){
    W().contentKinds().forEach(function(k){ c.push(['add-' + k.id, 'Add Content: ' + k.name, 'new insert ' + k.id, function(){ studio(); W().addContent(k.id); }]); });
  }
  /* commands Spotlight can run while the main window stays in the tray */
  var BG = {golive: 1, next: 1, prev: 1, hideall: 1, blackout: 1, freeze: 1, prompter: 1, share: 0};
  /* 26.11.31 a command whose feature is switched off is not offered (js/features.js); the feature itself is (below) */
  var F = window.KCFeatures;
  c = c.filter(function(x){ return !F || F.allOn(CMD_FEATURE[x[0]]); });
  return c.map(function(x){ return {key: 'cmd:' + x[0], kind: 'cmd', title: x[1], sub: x[4] ? 'Shortcut ' + x[4] : 'Command', words: x[2], run: x[3], bg: !!BG[x[0]]}; });
}
var CMD_FEATURE = {listen: 'listen', capture: 'memory', members: 'team', resync: 'team', sermonnotes: 'summary', summary: 'summary', nametags: 'nametags', responses: 'responses',
  camera: 'vcam', sharedraw: '', sharespot: ''};
/* 26.11.31 the features themselves: "Memory Cards is off · Turn on?" finds it from anywhere, and teaches where they live */
function featureItems(){
  var F = window.KCFeatures; if (!F || !F.state().features) return [];
  return F.list.map(function(f){
    var on = F.on(f.id), lk = F.locked();
    return {key: 'feat:' + f.id, kind: 'setting', title: on ? 'Feature: ' + f.label : f.label + ' is off · Turn on?',
      sub: lk ? 'Off air to change · Settings → Start here → Features' : (on ? 'On · Enter switches it off' : 'Enter switches it on') + ' · Settings → Start here → Features',
      words: 'feature switch turn on off ' + f.what,
      local: function(){
        if (F.locked()){ toast('Off air to change features.', true); return; }
        F.set(f.id, !on).then(function(){ toast(f.label + (on ? ' is off' : ' is on')); }).catch(function(e){ toast(e.message, true); });
      }};
  });
}
function trimmed(s, n){ s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function index(){
  var out = commands(), st = live; if (!st) return out;
  /* 9.9 the meetings of this workspace: choosing one shows it on this PC (one meeting at a time, as in the Studio) */
  var mlist = SC.meetings ? SC.meetings(st) : [], mcur = mlist.length && SC.currentMeeting(st);
  mlist.forEach(function(m){
    var n = st.scenes.filter(function(sc){ return !sc.tpl && (mlist.length < 2 || SC.meetingOf(st, sc).id === m.id); }).length;
    out.push({key: 'meet:' + m.id, kind: 'meeting', title: m.name, sub: (mcur && mcur.id === m.id ? 'Showing on this PC · ' : '') + n + (n === 1 ? ' Frame' : ' Frames') + (m.date ? ' · ' + m.date : ''),
      words: 'meeting ' + (m.notes || ''), run: function(){ studio(); Store.update(function(x){ SC.switchMeeting(x, m.id); }); }});
  });
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
  out = out.concat(featureItems());
  var api = window.KCMembersAPI, rows = api && api.directory ? api.directory() : [];
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
var KIND_BONUS = {meeting: 35, card: 20, cmd: 30, frame: 40, content: 10, text: 10, question: 5, verse: 5, tpl: 0, lib: -5, brand: 5, bg: 5, setting: 0, member: -5, birthday: 0};
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
    else if (e.key === 'Escape'){ e.preventDefault(); if (!(hooks.escape && hooks.escape())) close(); }
    else if (e.key === 'Tab'){ e.preventDefault(); if (hooks.tab) hooks.tab(e.shiftKey); }
    else if (e.key === 'Backspace' && !input.value && hooks.backspace){ if (hooks.backspace()) e.preventDefault(); }
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
  if (!n) list.appendChild(h('li', {cls: 'pal-none', role: 'option', 'aria-disabled': 'true', text: input.value.trim() ? 'Nothing found. Try fewer letters.' : 'Type to search.'}));
  mark();
}
function mark(){
  Array.prototype.forEach.call(list.querySelectorAll('.pal-row'), function(li, n){ li.setAttribute('aria-selected', String(n === active)); if (n === active) li.scrollIntoView({block: 'nearest'}); });
  if (items[active]) input.setAttribute('aria-activedescendant', 'pal-' + active); else input.removeAttribute('aria-activedescendant');
}
/* 9.9 Command Center scopes: a module (Meetings, Memory Cards, Present, Camera, More) or a prefix narrows the search.
 * > commands · # meetings and Frames · @ people. A scope is {id, label, items(all) -> the items it searches}. */
var scope = null, hooks = {};
var PREFIX = {'>': function(all){ return all.filter(function(it){ return it.kind === 'cmd'; }); },
  '#': function(all){ return all.filter(function(it){ return it.kind === 'meeting' || it.kind === 'frame'; }); },
  '@': function(all){ return all.filter(function(it){ return it.kind === 'member' || it.kind === 'birthday'; }); }};
function pool(q){
  var c = q.charAt(0), base = scope ? scope.items(all) : all;
  if (PREFIX[c]) return {list: PREFIX[c](base), q: q.slice(1), prefix: c};
  return {list: base, q: q, prefix: ''};
}
function update(){
  var q = input.value;
  if (scope || PREFIX[q.trim().charAt(0)]){                          // 9.9 a module or a prefix: its items, ranked as you type
    var pl = pool(q.trim()), sq = pl.q.trim(), res = sq ? rank(pl.list, sq) : pl.list.slice(0, 50);
    items = res; active = 0;
    draw([{label: sq ? '' : (scope ? scope.label : ''), items: res}]);
    if (!res.length) list.firstChild.textContent = scope && scope.empty ? scope.empty : 'Nothing here yet.';
    return;
  }
  if (!q.trim()){                                                     // empty: recent items, then useful commands
    var byKey = {}; all.forEach(function(it){ byKey[it.key] = it; });
    var rec = recents().map(function(k){ return byKey[k]; }).filter(Boolean).slice(0, 6);
    var f = freq(), often = Object.keys(f).filter(function(k){ return f[k] > 1; }).sort(function(a, b){ return f[b] - f[a]; })
      .map(function(k){ return byKey[k]; }).filter(function(x){ return x && rec.indexOf(x) < 0; }).slice(0, 5);
    var sug = (STANDALONE ? ['cmd:prompter', 'cmd:golive', 'cmd:next', 'cmd:blackout', 'cmd:hideall'] : ['cmd:golive', 'cmd:newframe', 'cmd:prompter', 'cmd:export', 'cmd:branding'])
      .map(function(k){ return byKey[k]; }).filter(function(x){ return x && rec.indexOf(x) < 0 && often.indexOf(x) < 0; });
    items = rec.concat(often, sug); active = 0;
    draw([{label: rec.length ? 'Recent' : '', items: rec}, {label: 'Frequently used', items: often}, {label: 'Suggested', items: sug}]);
    return;
  }
  var found = rank(all, q), ref = window.KCScripture && window.KCScripture.parse && window.KCScripture.parse(q);
  if (ref) found.unshift({key: 'bible:' + ref, kind: 'bible', title: ref, sub: 'Fetch into the Scripture Content (ESV)', run: function(){ bible(ref); }});
  items = found; active = 0;
  draw([{label: '', items: found}]);
}
function bible(ref){ studio(); if (W()) W().fetchVerse(ref); }
function choose(it){
  if (it.local){ try { it.local(); } catch(e){} return; }             // 9.9 done in the Command Center itself (Memory Cards, camera)
  if (it.kind !== 'bible') remember(it);
  if (STANDALONE && (it.key === 'cmd:sharedraw' || it.key === 'cmd:sharespot' || it.key === 'cmd:annotate')){   // 9.7 the Share Window opens for it
    post('annotate', {op: 'mode', mode: it.key === 'cmd:sharespot' ? 'spot' : 'draw'}); input.value = ''; return;
  }
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
  if (STANDALONE || window.KCShortcutsCapturing || capturing) return;
  var c = comboOf(e); if (!c) return;
  if (keys().indexOf(c) >= 0){ e.preventDefault(); e.stopPropagation(); if (back && !back.hidden) close(); else open(); }
}, true);
/* ---------- Settings > Keyboard shortcuts: the keys that open the palette ---------- */
var capturing = false;
function mountKeys(root){
  function render(msg){
    root.innerHTML = '';
    var k = keys();
    root.appendChild(h('p', {cls: 'hint', text: 'Opens the command palette from anywhere in FrameDecks, even while typing. Use Ctrl, Alt or both with a key.'}));
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
  window.KCSpotlight = {opened: function(){ input.value = ''; recentRank = {}; recents().forEach(function(k, i){ recentRank[k] = i + 1; });
    all = cached(); update(); input.focus(); refreshIndex();
    var box = back.querySelector('.pal'); box.classList.remove('spot-in'); void box.offsetWidth; box.classList.add('spot-in'); }};
}

/* 9.9 for the Command Center (js/command-center.js) */
function setScope(s){ scope = s || null; if (back && !back.hidden) update(); }
function recentItems(n){
  var byKey = {}; all.forEach(function(it){ byKey[it.key] = it; });
  var f = freq(), keys = recents().concat(Object.keys(f).sort(function(a, b){ return f[b] - f[a]; })), seen = {}, out = [];
  keys.forEach(function(k){ if (!seen[k] && byKey[k] && out.length < n){ seen[k] = 1; out.push(byKey[k]); } });
  return out;
}
window.KCPalette = {open: open, close: close, rank: rank, score: score, exportIndex: exportIndex, runKey: runKey,
  scope: setScope, scoped: function(){ return scope; }, hooks: hooks, choose: function(it){ choose(it); }, all: function(){ return all; },
  recentItems: recentItems, refresh: function(){ if (back && !back.hidden) update(); }, input: function(){ return input; }};
})();
