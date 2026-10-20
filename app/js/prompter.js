/* Kingdom Connect v6.8 - Teleprompter overlay (prompter.html): Meeting Leader mode.
 *
 * The script fills the window (95 % of its width). A small glass toolbar floats at the bottom and hides itself after a
 * few seconds; moving the mouse brings it back. Transparency modes let Zoom / Teams participants, shared screens and
 * chat show through:
 *   Solid 0 %  ·  Presenter 20 %  ·  Meeting 40 %  ·  Conference 65 %  ·  Ghost 85 %
 * Frost adds the Windows blur behind the overlay; Stay on top keeps it above Zoom, Teams, PowerPoint and browsers. All
 * three are remembered (Settings in the program). Keys: Space play / pause, 1-5 modes, M mirror, P pin, Esc close.
 *
 * It follows the Frame on screen (the first Frame before the meeting goes live, to rehearse); double-click the text to
 * edit the script. Uses the same Teleprompter as the main window (js/teleprompter.js). */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes, P = window.BSFPrompter, W = window.BSFWindow;
if (!Store || !SC || !P) return;
var body = document.body;
var MODES = [['solid', 'Solid', '0 %'], ['presenter', 'Presenter', '20 %'], ['meeting', 'Meeting', '40 %'], ['conference', 'Conference', '65 %'], ['ghost', 'Ghost', '85 %']];
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
var look = {mode: lsGet('kc-ov-mode', 'meeting'), frost: lsGet('kc-ov-frost', '1') === '1', onTop: true, fade: false};

function el(tag, cls, text, attrs){
  var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text;
  for (var k in (attrs || {})) e.setAttribute(k, attrs[k]);
  return e;
}
function tbtn(label, title, cls, run){
  var b = el('button', 'tp-btn ' + cls, label, {type: 'button', title: title, 'aria-label': title});
  b.addEventListener('click', run); return b;
}
var modeBtn = tbtn('', 'Transparency (1–5)', 'ov-mode-btn', function(){ modes.hidden = !modes.hidden; prompter.showControls(); });
var frostBtn = tbtn('❄', 'Frosted glass: blur what is behind the overlay', 'ov-frost', function(){ setLook({frost: !look.frost}); });
var pinBtn = tbtn('📌', 'Stay on top of Zoom, Teams, PowerPoint and browsers (P)', 'ov-pin', function(){ setOnTop(!look.onTop); });
var exitBtn = tbtn('✕ Exit', 'Close the Teleprompter overlay (Esc)', 'ov-exit', exit);
var modes = el('div', 'ov-modes', null, {role: 'group', 'aria-label': 'Transparency'}); modes.hidden = true;
MODES.forEach(function(m, i){
  var b = el('button', '', null, {type: 'button', 'data-mode': m[0], title: m[1] + ' (' + (i + 1) + ')'});
  b.appendChild(document.createTextNode(m[1])); b.appendChild(el('small', '', m[2]));
  b.addEventListener('click', function(){ setLook({mode: m[0]}); modes.hidden = true; });
  modes.appendChild(b);
});

var prompter = P.create(document.getElementById('ov-main'), {key: 'overlay', toolbar: 'float', editable: true,
  edit: function(sid, text){ return Store.update(function(n){ var sc = SC.find(n, sid); if (!sc) return; sc.notes = String(text || '').slice(0, 20000); SC.stamp(sc); }); },
  extra: [el('span', 'tp-sep', null, {'aria-hidden': 'true'}), modeBtn, frostBtn, pinBtn, exitBtn]});
prompter.el.appendChild(modes);
/* the ribbon shows and hides with the toolbar */
new MutationObserver(function(){ body.classList.toggle('ui-on', prompter.el.classList.contains('tp-ui-on')); if (!prompter.el.classList.contains('tp-ui-on')) modes.hidden = true; })
  .observe(prompter.el, {attributes: true, attributeFilter: ['class']});
body.classList.add('ui-on');

function paint(){
  var m = MODES.filter(function(x){ return x[0] === look.mode; })[0] || MODES[2];
  body.setAttribute('data-mode', m[0]);
  body.classList.toggle('frost', !!look.frost); body.classList.toggle('fade', !!look.fade);
  modeBtn.textContent = m[1] + ' ' + m[2];
  document.getElementById('ov-mode-label').textContent = m[1] + ' · ' + m[2] + (look.frost && !look.fade ? ' · frosted' : '');
  frostBtn.setAttribute('aria-pressed', String(!!look.frost)); pinBtn.setAttribute('aria-pressed', String(!!look.onTop));
  Array.prototype.forEach.call(modes.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.mode === m[0])); });
  var desktop = W && W.active();
  frostBtn.hidden = !desktop || look.fade; pinBtn.hidden = !desktop;
}
function setLook(ch){
  if (ch.mode) { look.mode = ch.mode; lsSet('kc-ov-mode', ch.mode); }
  if ('frost' in ch){ look.frost = !!ch.frost; lsSet('kc-ov-frost', look.frost ? '1' : '0'); }
  paint();
  if (W) W.call('look', {overlayMode: look.mode, overlayFrost: look.frost});
}
function setOnTop(on){
  look.onTop = !!on; paint();
  if (W) W.call('on-top', {value: look.onTop});
}
function exit(){
  if (W && W.active()) W.call('close'); else window.close();
}

/* settings from the program: mode, frost, stay on top, compatibility fade */
setTimeout(function(){
  var s = W ? W.settings() : {};
  if (s && s.overlayMode){ look.mode = s.overlayMode; look.frost = s.overlayFrost !== false; look.onTop = s.overlayOnTop !== false;
    look.fade = !!(s.overlayFade || (W.info().lowGpuActive)); }   // "Light on graphics card": the window fades as a whole
  paint();
}, 400);
paint();

document.addEventListener('keydown', function(e){
  var t = e.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName) || (window.BSFEditable && window.BSFEditable.active())) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var k = e.key, n = +k;
  if (n >= 1 && n <= 5){ setLook({mode: MODES[n - 1][0]}); prompter.showControls(); e.preventDefault(); }
  else if (k === 'p' || k === 'P'){ if (W && W.active()) setOnTop(!look.onTop); prompter.showControls(); }
  else if (k === 'Escape'){ if (!modes.hidden){ modes.hidden = true; return; } exit(); }
});

/* the Frame on screen, else the first Frame (rehearse before going live) */
Store.subscribe(function(st){ prompter.update(st, SC.liveScene(st) || SC.order(st)[0] || null); });
Store.start();
setTimeout(function(){ prompter.focus(); }, 300);
window.BSFOverlay = {look: function(){ return Object.assign({}, look); }, setLook: setLook};
})();
