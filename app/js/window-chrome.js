/* Kingdom Connect v6.8 - the window ribbon: ONE implementation of the window buttons and dragging, used by every window
 * (main window, Teleprompter window, Teleprompter overlay, Spotlight).
 *
 * In the installed app the windows have no Windows title bar (desktop_win.Chrome). The page's own top bar is the
 * ribbon: drag its empty space to move the window (Windows runs the move, so Snap works), double-click it to maximize,
 * and the buttons at its right minimize, maximize / restore and close. In a browser nothing here shows.
 *
 *   <header data-win-drag> ... <div data-win-controls></div></header>     (body data-win="main|teleprompter|overlay")
 *   data-win-drag="move": press and move there to move the window, but a double-click does not maximize
 * Every window also gets thin resize handles on its edges and corners.
 *
 * KCWindow.call(op, data) talks to the program (POST api/app/win); KCWindow.minimize() follows Settings ("Ask",
 * "Hide to tray", "Stay in taskbar"). */
(function(){
'use strict';
var WIN = document.body.getAttribute('data-win') || 'main';
var served = location.protocol === 'http:' || location.protocol === 'https:';
var NO_DRAG = 'button, a, input, select, textarea, label, summary, [role="tab"], [role="button"], [contenteditable], .no-drag, [data-no-drag], kbd';
var ICONS = {
  min: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5.5h8"/></svg>',
  max: '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" rx=".6"/></svg>',
  restore: '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.2" y="3" width="5.8" height="5.8" rx=".6"/><path d="M3 3V1.8c0-.3.3-.6.6-.6h4.6c.3 0 .6.3.6.6v4.6c0 .3-.3.6-.6.6H7"/></svg>',
  close: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg>'
};
var state = {desktop: false, chrome: false, maximized: false, settings: null};

function call(op, data){
  if (!served) return Promise.resolve({});
  var body = Object.assign({win: WIN, op: op}, data || {});
  return fetch('api/app/win', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; })
    .then(function(d){ if (d && 'maximized' in d) setMax(d.maximized); return d || {}; });
}
function setMax(on){
  state.maximized = !!on;
  document.documentElement.classList.toggle('win-maximized', state.maximized);
  Array.prototype.forEach.call(document.querySelectorAll('.wc-max'), function(b){
    b.innerHTML = on ? ICONS.restore : ICONS.max;
    b.title = on ? 'Restore' : 'Maximize'; b.setAttribute('aria-label', b.title);
  });
}
function btn(cls, icon, title, run){
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'wc-btn ' + cls; b.innerHTML = icon; b.title = title; b.setAttribute('aria-label', title);
  b.addEventListener('click', function(e){ e.stopPropagation(); run(); });
  b.addEventListener('dblclick', function(e){ e.stopPropagation(); });
  return b;
}
function mount(host){
  if (host.dataset.wcMounted) return; host.dataset.wcMounted = '1';
  host.classList.add('win-controls'); host.setAttribute('role', 'group'); host.setAttribute('aria-label', 'Window');
  host.appendChild(btn('wc-min', ICONS.min, 'Minimize', minimize));
  host.appendChild(btn('wc-max', ICONS.max, 'Maximize', function(){ call('toggle-max'); }));
  host.appendChild(btn('wc-close', ICONS.close, 'Close', function(){ call('close'); }));
  setMax(state.maximized);
}

/* ---------- minimize: ask once, or follow the remembered choice (main window only) ---------- */
function setting(k, v){
  var o = {}; o[k] = v;
  return fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)})
    .then(function(r){ return r.json(); }).then(function(s){ state.settings = s; }).catch(function(){});
}
function minimize(){
  if (WIN !== 'main') return call('minimize');
  var how = state.settings && state.settings.minimizeTo || 'ask';
  if (how === 'tray') return call('hide');
  if (how === 'taskbar') return call('minimize');
  askMinimize();
}
function askMinimize(){
  if (document.querySelector('.wc-ask')) return;
  var back = document.createElement('div'); back.className = 'wc-ask'; back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-labelledby', 'wc-ask-t');
  back.innerHTML = '<div class="wc-ask-card"><h2 id="wc-ask-t">Hide application to system tray?</h2>' +
    '<p>In the tray (the icons near the clock) FRAMEDECKS keeps running: your camera, overlays, phone remote and ' +
    'shortcuts keep working, and it leaves the taskbar.</p>' +
    '<label class="check"><input type="checkbox" class="wc-remember"> Remember my choice</label>' +
    '<div class="wc-ask-acts"><button type="button" class="btn primary wc-tray">Hide To Tray</button>' +
    '<button type="button" class="btn wc-bar">Stay In Taskbar</button></div>' +
    '<p class="hint">You can change this later in Settings → General → Window and tray.</p></div>';
  document.body.appendChild(back);
  function done(choice){
    var remember = back.querySelector('.wc-remember').checked;
    back.remove();
    if (remember) setting('minimizeTo', choice);
    call(choice === 'tray' ? 'hide' : 'minimize');
  }
  back.querySelector('.wc-tray').addEventListener('click', function(){ done('tray'); });
  back.querySelector('.wc-bar').addEventListener('click', function(){ done('taskbar'); });
  back.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ e.stopPropagation(); back.remove(); } });
  back.addEventListener('mousedown', function(e){ if (e.target === back) back.remove(); });
  back.querySelector('.wc-tray').focus();
}

/* ---------- the ribbon: drag to move, double-click to maximize ---------- */
/* The move starts once the mouse has moved a few pixels with the button down (as on a title bar), so a click or a
   double-click on the ribbon stays a click: Windows' move would otherwise take the second click of a double-click. */
var press = null;
document.addEventListener('mousedown', function(e){
  if (!state.chrome || e.button !== 0) return;
  var area = e.target.closest && e.target.closest('[data-win-drag]');
  if (!area || e.target.closest(NO_DRAG)) return;
  if (area.getAttribute('data-win-drag') !== 'move') e.preventDefault();   // a 'move' area (the overlay's script) keeps focus
  press = {x: e.screenX, y: e.screenY};
});
document.addEventListener('mousemove', function(e){
  if (!press) return;
  if (!(e.buttons & 1)){ press = null; return; }
  if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) < 4) return;
  press = null; call('drag');
});
document.addEventListener('mouseup', function(){ press = null; });
document.addEventListener('dblclick', function(e){
  if (!state.chrome || WIN === 'spotlight') return;
  var area = e.target.closest && e.target.closest('[data-win-drag]');
  if (!area || area.getAttribute('data-win-drag') === 'move' || e.target.closest(NO_DRAG)) return;   // 'move': drag only
  call('toggle-max');
});

/* Resize from every edge and corner: thin handles inside the window, so resizing works the same in every window,
   see-through or not (Windows then runs the resize, with its usual minimum sizes and Snap). */
var EDGES = ['top', 'bottom', 'left', 'right', 'topleft', 'topright', 'bottomleft', 'bottomright'];
function edges(){
  if (WIN === 'spotlight' || document.querySelector('.wc-edge')) return;
  EDGES.forEach(function(edge){
    var d = document.createElement('div'); d.className = 'wc-edge wc-' + edge; d.setAttribute('aria-hidden', 'true');
    d.addEventListener('mousedown', function(e){ if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); call('resize', {edge: edge}); });
    document.body.appendChild(d);
  });
}

function start(){
  if (!served) return;
  Promise.all([
    fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }),
    call('state')
  ]).then(function(res){
    var info = res[0] || {}, st = res[1] || {};
    state.desktop = !!info.desktop; state.settings = info.settings || {}; state.info = info;
    state.chrome = !!(state.desktop && st.chrome);
    document.documentElement.classList.toggle('win-chrome', state.chrome);
    if (!state.chrome) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-win-controls]'), mount);
    edges();
  });
  window.addEventListener('resize', function(){ if (state.chrome){ clearTimeout(start.t); start.t = setTimeout(function(){ call('state'); }, 250); } });
}

window.KCWindow = {call: call, minimize: minimize, mount: mount, win: WIN, active: function(){ return state.chrome; },
  settings: function(){ return state.settings || {}; }, info: function(){ return state.info || {}; }};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
