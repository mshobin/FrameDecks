/* FrameDecks 26.11.12 - Simple by default. Most people who run a meeting are not technical, so the Studio shows the
 * essentials and keeps every other control one click away (Advanced). Nothing is removed; Advanced shows it all.
 * Simple (body.simple, js-free styles in css/theme.css):
 *   - one clear on-screen signal: a green ring round the stage, the LIVE mark on the Frame card; the Deck badges and
 *     the label inside the picture step back;
 *   - a calm top bar: Previous · Go Live · Next, the item arrows, the chips, Hide all (Transition and Auto-advance in
 *     Advanced);
 *   - technical lines (camera numbers, Snap to guides, the overlay note) in Advanced;
 *   - the status panel says it in one sentence (js/stage-status.js); its details open on a click;
 *   - the editor shows the words first; Position and size, Look, Animation and Show on sit behind one Design button;
 *   - the five chips keep their words wherever they fit.
 * The choice is kept for this PC (kc-app-settings.json "studioMode"), and in localStorage so the first paint is right. */
(function(){
'use strict';
var body = document.body, KEY = 'kc-studio-mode';
function lsGet(){ try { return localStorage.getItem(KEY); } catch(e){ return null; } }
function lsSet(v){ try { localStorage.setItem(KEY, v); } catch(e){} }
var mode = lsGet() === 'advanced' ? 'advanced' : 'simple';
function apply(){
  body.classList.toggle('simple', mode === 'simple');
  body.classList.toggle('advanced', mode === 'advanced');
  if (seg) Array.prototype.forEach.call(seg.children, function(b){ b.setAttribute('aria-checked', String(b.dataset.mode === mode)); });
  if (design) design.hidden = mode !== 'simple';
  window.dispatchEvent(new Event('resize'));            // the top bar and the stage refit to the room they now have
}
function set(v, save){
  if (v !== 'simple' && v !== 'advanced') return;
  mode = v; lsSet(v); apply();
  if (save) fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({studioMode: v})}).catch(function(){});
}

/* Simple | Advanced, in the stage's header */
var seg = null, design = null;
var tools = document.getElementById('canvas-tools');
if (tools){
  seg = document.createElement('div');
  seg.className = 'seg sm-seg'; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'How much the Studio shows');
  [['simple', 'Simple', 'The essentials: Go Live, Next, Hide all and your words'], ['advanced', 'Advanced', 'Every control: transitions, Auto-advance, camera numbers, layout and look']].forEach(function(o){
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.mode = o[0]; b.textContent = o[1]; b.title = o[2]; b.setAttribute('role', 'radio');
    b.addEventListener('click', function(){ set(o[0], true); });
    seg.appendChild(b);
  });
  tools.insertBefore(seg, tools.firstChild);
}

/* the editor's settings (Position and size, Look, Animation, Show on) behind one Design button in Simple */
var tbar = document.getElementById('insp-tools');
if (tbar){
  design = document.createElement('button');
  design.type = 'button'; design.className = 'btn small quiet sm-design'; design.id = 'sm-design';
  design.setAttribute('aria-expanded', 'false');
  design.innerHTML = (window.KCIcon ? window.KCIcon('palette', 14) + ' ' : '') + 'Design';
  design.title = 'Position and size, look, animation and where it shows';
  design.addEventListener('click', function(){
    var open = !body.classList.contains('sm-design-open');
    body.classList.toggle('sm-design-open', open);
    design.setAttribute('aria-expanded', String(open));
  });
  tbar.appendChild(design);
}

/* the program's saved choice wins (another person may have switched this PC) */
fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
  var v = d && d.settings && d.settings.studioMode;
  if (v && v !== mode) set(v, false);
}).catch(function(){});
apply();
window.KCSimpleMode = {get: function(){ return mode; }, set: function(v){ set(v, true); }};
})();
