/* BSF Command Center - installed-app features: first-run import, close dialog, data folder & backups, external links.
 * Everything here talks to the local program; nothing is sent anywhere else. */
(function(){
'use strict';
var Store = window.BSFStore;
if (!Store.served) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
function post(action, body){
  return fetch('api/app/' + action, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); });
}
function getInfo(){ return fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }); }
var info = null;

/* ---------- A simple modal (used for import and closing) ---------- */
function modal(title, bodyNodes, buttons){
  var back = h('div', {cls: 'app-modal-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': title});
  var card = h('div', {cls: 'app-modal'}, [h('h2', {text: title})].concat(bodyNodes));
  var row = h('div', {cls: 'app-modal-actions'});
  buttons.forEach(function(b){ row.appendChild(h('button', {cls: 'btn ' + (b.cls || ''), type: 'button', text: b.text, onclick: function(){ if (b.onclick(close) !== false) close(); }})); });
  card.appendChild(row); back.appendChild(card); document.body.appendChild(back);
  var first = row.querySelector('.btn'); if (first) first.focus();
  function close(){ back.remove(); }
  back.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ e.stopPropagation(); close(); } });
  return close;
}
function when(t){ return t ? new Date(t * 1000).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'}) : ''; }

/* ---------- Import from an earlier version ---------- */
function describe(c){
  var bits = [];
  if (c.members != null) bits.push(c.members + ' member' + (c.members === 1 ? '' : 's'));
  if (c.questions != null) bits.push(c.questions + ' saved question' + (c.questions === 1 ? '' : 's'));
  if (c.modified) bits.push('last used ' + when(c.modified));
  return bits.join(' · ');
}
function doImport(folder, closeFn){
  return post('import', {folder: folder}).then(function(d){
    if (closeFn) closeFn();
    toast('Imported: ' + d.imported.join(', '));
    setTimeout(function(){ location.reload(); }, 900);   // reload so members and settings appear everywhere
  }).catch(function(e){ toast(e.message, true); });
}
function pickFolder(){
  return post('choose-folder').then(function(d){ return d.folder; }).catch(function(){
    var p = prompt('Type or paste the folder path of your earlier BSF Command Center\n(for example C:\\Users\\You\\Downloads\\BSF-Command-Center):');
    return p && p.trim();
  });
}
function importDialog(candidates, firstRun){
  var list = h('div', {cls: 'app-cands'});
  if (candidates.length){
    candidates.forEach(function(c){
      list.appendChild(h('div', {cls: 'app-cand'}, [
        h('div', {}, [h('b', {cls: 'mono', text: c.folder}), h('div', {cls: 'hint', text: describe(c)})]),
        h('button', {cls: 'btn primary small', type: 'button', text: 'Import', onclick: function(){ doImport(c.folder, closeFn); }})
      ]));
    });
  } else list.appendChild(h('p', {cls: 'hint', text: 'No earlier BSF Command Center folder was found on your Desktop, Downloads or Documents. Choose it yourself, or start fresh.'}));
  var closeFn = modal(firstRun ? 'Welcome! Bring in your existing data?' : 'Import from an earlier version', [
    h('p', {text: 'This copies your saved verses and questions, members, settings and phone-remote PIN from the folder where you used Kingdom Connect before. The original folder is not changed.'}),
    list
  ], [
    {text: 'Choose a folder…', onclick: function(){ pickFolder().then(function(f){ if (f) doImport(f, closeFn); }); return false; }},
    {text: firstRun ? 'Start fresh' : 'Cancel', cls: 'quiet', onclick: function(){ if (firstRun) post('skip-import'); }}
  ]);
}

/* ---------- Data / Backup: where data lives, backups, import ---------- */
function renderDataCard(){
  var sec = $('sec-data'); if (!sec || !info) return;
  var card = $('app-data-card');
  if (!card){ card = h('section', {cls: 'box', id: 'app-data-card'}); sec.insertBefore(card, sec.querySelector('.box')); }
  card.innerHTML = '';
  card.appendChild(h('div', {cls: 'box-head'}, [h('h2', {text: 'Where your data is kept'})]));
  card.appendChild(h('p', {cls: 'plain'}, ['Folder: ', h('span', {cls: 'mono', text: info.dataFolder})]));
  var acts = h('div', {cls: 'actions'});
  if (info.windows) acts.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Open data folder', onclick: function(){ post('open-folder', {which: 'data'}); }}));
  acts.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Back up now', onclick: function(){
    post('backup-now').then(function(d){ toast('Backup saved (' + d.backup + ')'); refresh(); }).catch(function(e){ toast(e.message, true); }); }}));
  if (info.windows) acts.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Open backups folder', onclick: function(){ post('open-folder', {which: 'backups'}); }}));
  if (info.separateData) acts.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Import from an earlier version…', onclick: function(){
    post('candidates').then(function(d){ importDialog(d.candidates, false); }); }}));
  card.appendChild(acts);
  card.appendChild(h('p', {cls: 'hint', text: 'A backup of your verses, questions and members is made automatically once a day. The newest ' + 10 + ' backups are kept.'}));
  if (info.backups.length){
    var t = h('table', {cls: 'plain'}, [h('tr', {}, [h('th', {text: 'Backup'}), h('th', {text: 'Contains'})])]);
    info.backups.forEach(function(b){ t.appendChild(h('tr', {}, [h('td', {cls: 'mono', text: b.name}), h('td', {text: b.files.join(', ')})])); });
    card.appendChild(t);
    card.appendChild(h('p', {cls: 'hint', text: 'To restore one: open the backups folder, then use “Load a backup file” below or Members → Import Excel, or copy the files into the data folder while Kingdom Connect is closed.'}));
  }
}
/* About line in General */
function renderAbout(){
  var sec = $('sec-general'); if (!sec || !info) return;
  var p = $('app-about');
  if (!p){ p = h('p', {cls: 'hint', id: 'app-about'}); sec.appendChild(p); }
  p.textContent = 'Kingdom Connect version ' + info.version + (info.installedApp ? ' (installed app)' : '') + '.';
}
/* Settings > General > Performance (installed app): draw this window without the graphics card */
function renderPerf(){
  var sec = $('sec-general'); if (!sec || !info || !info.desktop) return;
  var box = $('app-perf');
  if (!box){
    var cb = h('input', {type: 'checkbox', id: 'app-lowgpu'});
    cb.addEventListener('change', function(){
      post('settings', {lowGpu: cb.checked}).then(function(){ toast('Saved. Restart Kingdom Connect to apply it.'); refresh(); });
    });
    box = h('section', {cls: 'box', id: 'app-perf', 'aria-labelledby': 'app-perf-title'}, [
      h('div', {cls: 'box-head'}, [h('h2', {id: 'app-perf-title', text: 'Performance'})]),
      h('label', {cls: 'check'}, [cb, ' Light on graphics card (recommended)']),
      h('label', {cls: 'check'}, [(function(){ var c = h('input', {type: 'checkbox', id: 'app-native-present'});
        c.addEventListener('change', function(){ post('settings', {nativePresent: c.checked}).then(function(){ toast(c.checked ? 'Lightweight Presentation window on (next time you open it)' : 'Presentation window will use the web view (next time you open it)'); refresh(); }); });
        return c; })(), ' Lightweight Presentation window (recommended; untick if it ever misbehaves)']),
      h('p', {cls: 'hint', text: 'Draws this window without the graphics card, so Windows, Zoom and app switching stay smooth. Turn it off only if this window ever looks wrong. Takes effect after restarting the app.'}),
      h('p', {cls: 'hint', id: 'app-lowgpu-state'})]);
    sec.appendChild(box);
  }
  var want = info.settings.lowGpu !== false;
  $('app-lowgpu').checked = want;
  $('app-native-present').checked = info.settings.nativePresent !== false;
  $('app-lowgpu-state').textContent = 'Now: ' + (info.lowGpuActive ? 'on' : 'off') + (want !== !!info.lowGpuActive ? ' (restart the app to apply your change)' : '');
}
function refresh(){ return getInfo().then(function(d){ info = d; window.BSFAppInfo = d; renderDataCard(); renderAbout(); renderPerf(); document.dispatchEvent(new CustomEvent('bsf-app-info', {detail: d})); return d; }); }

/* ---------- Closing the app window (called by the desktop app) ---------- */
window.BSFAppClosing = function(){
  if (document.querySelector('.app-modal-back')) return true;
  var st = Store.get(), live = ['question', 'verse', 'birthday'].filter(function(k){
    var o = st[k]; return o && o.visible && String(k === 'birthday' ? o.greeting : o.text).trim();
  });
  var body = [h('p', {text: 'Keep it running in the background so your overlays keep working in OBS and Camo and your phone stays connected. It stays in the tray near the clock; click the icon to open this window again.'})];
  if (live.length) body.unshift(h('div', {cls: 'alert warn'}, [h('b', {text: 'On screen now: '}), live.join(', ') + '. Quitting removes it from your Zoom video.']));
  modal('Close Kingdom Connect?', body, [
    {text: 'Keep running in the background', cls: 'primary', onclick: function(){ post('hide'); }},
    {text: 'Quit', cls: live.length ? 'danger' : '', onclick: function(){ post('quit'); }},
    {text: 'Cancel', cls: 'quiet', onclick: function(){}}
  ]);
  return true;
};

/* ---------- Links in the app window open in your normal browser / email app ---------- */
function external(url){ post('open-external', {url: url}).catch(function(){}); }
document.addEventListener('click', function(e){
  if (!info || !info.desktop) return;
  var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
  var href = a.getAttribute('href') || '';
  if (/^(mailto:|tel:)/i.test(href) || (/^https?:/i.test(a.href) && (a.target === '_blank' || new URL(a.href).origin !== location.origin))){
    e.preventDefault(); external(a.href);
  }
}, true);
var nativeOpen = window.open;
window.open = function(url){
  if (info && info.desktop && url){ external(new URL(url, location.href).href); return null; }
  return nativeOpen.apply(window, arguments);
};

/* ---------- v6.4 native app window ----------
 * In the app window (WebView2, or the Edge/Chrome app window used when WebView2 is missing) Kingdom Connect behaves
 * like a desktop app, not a web page: no browser reload / print / view-source / find / zoom keys, no browser
 * right-click menu outside text boxes, and files dropped outside a drop zone don't replace the page.
 * The title bar follows the app's dark or light theme. In an ordinary browser tab nothing here applies. */
var appShell = false;
try { if (/[?&]shell=app\b/.test(location.search)) sessionStorage.setItem('kc-shell', 'app'); appShell = sessionStorage.getItem('kc-shell') === 'app'; } catch(e){}
function isNative(){ return appShell || !!(info && info.shell === 'webview' && info.desktop); }
function editable(t){ return t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'); }
document.addEventListener('keydown', function(e){
  if (!isNative()) return;
  var k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
  var block = k === 'f5' || k === 'browserback' || k === 'browserforward' || k === 'f7' ||
    (mod && ['r', 'p', 'u', 's', 'j', 'h', 'n', 't', 'w', 'g', 'o', '+', '=', '-', '0'].indexOf(k) >= 0 && !e.altKey) ||
    (e.altKey && (k === 'arrowleft' || k === 'arrowright') && !editable(e.target)) || (mod && e.shiftKey && (k === 'i' || k === 'c' || k === 'delete'));
  if (block && !e.defaultPrevented) e.preventDefault();
}, false);
window.addEventListener('wheel', function(e){ if (isNative() && (e.ctrlKey || e.metaKey)) e.preventDefault(); }, {passive: false});
document.addEventListener('contextmenu', function(e){ if (isNative() && !editable(e.target)) e.preventDefault(); });
window.addEventListener('dragover', function(e){ if (isNative()) e.preventDefault(); });
window.addEventListener('drop', function(e){ if (isNative()) e.preventDefault(); });
function themeNow(){
  var t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
var sentTheme = '';
function syncTitleBar(){
  if (!(info && info.shell === 'webview')) return;
  var t = themeNow(); if (t === sentTheme) return; sentTheme = t;
  post('window', {theme: t}).catch(function(){ sentTheme = ''; });
}
new MutationObserver(syncTitleBar).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
if (window.matchMedia) try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', syncTitleBar); } catch(e){}
document.documentElement.classList.toggle('kc-native', appShell);
document.addEventListener('bsf-app-info', function(){ document.documentElement.classList.toggle('kc-native', isNative()); syncTitleBar(); });

refresh().then(function(d){
  if (d.migration.needed) importDialog(d.migration.candidates, true);
});
setInterval(function(){ var s = $('sec-data'); if (s && !s.hidden) refresh(); }, 15000);
window.BSFAppRefresh = refresh;
})();
