/* BSF Command Center - keyboard shortcuts (defaults keep the original keys; changes are stored in this browser only) */
/* Problems are recorded quietly for Settings > Diagnostics instead of interrupting the meeting screen */
window.BSFErrors = window.BSFErrors || [];
(function(){
  function push(msg){ var d = new Date(); window.BSFErrors.push({time: d.toTimeString().slice(0, 8), message: String(msg).slice(0, 200)}); if (window.BSFErrors.length > 50) window.BSFErrors.shift(); }
  window.addEventListener('error', function(e){ push(e.message || 'Script error'); });
  window.addEventListener('unhandledrejection', function(e){ push((e.reason && e.reason.message) || 'Request failed'); });
})();
(function(){
'use strict';
var KEY = 'bsf-cc-shortcuts-v1';
var ACTIONS = [
  {id: 'nextQ',   name: 'Next question',        cat: 'question', def: 'ArrowRight'},
  {id: 'prevQ',   name: 'Previous question',    cat: 'question', def: 'ArrowLeft'},
  {id: 'toggleQ', name: 'Show / hide question', cat: 'question', def: 'q'},
  {id: 'nextV',   name: 'Next verse',           cat: 'verse',    def: 'Shift+ArrowRight'},
  {id: 'prevV',   name: 'Previous verse',       cat: 'verse',    def: 'Shift+ArrowLeft'},
  {id: 'toggleV', name: 'Show / hide verse',    cat: 'verse',    def: 'v'},
  {id: 'toggleB', name: 'Show / hide birthday', cat: 'birthday', def: 'b'},
  {id: 'hideAll', name: 'Hide all overlays',    cat: 'danger',   def: 'Escape'},
  {id: 'takeLive', name: 'Take live (the Inspector’s item)', cat: 'live', def: 't'}
];
var RESERVED = {'Tab': 1, 'Enter': 1, ' ': 1, 'Shift': 1, 'Control': 1, 'Alt': 1, 'Meta': 1, 'CapsLock': 1, '/': 1};
var map = load();
var listeners = [];

function load(){
  var m = {}; ACTIONS.forEach(function(a){ m[a.id] = a.def; });
  try { var s = JSON.parse(localStorage.getItem(KEY) || '{}'); for (var k in s) if (m[k] !== undefined && typeof s[k] === 'string') m[k] = s[k]; } catch(e){}
  return m;
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(map)); } catch(e){} listeners.forEach(function(f){ f(); }); }
function comboOf(e){
  var k = e.key; if (!k || RESERVED[k]) return null;
  if (k.length === 1) k = k.toLowerCase();
  return (e.shiftKey ? 'Shift+' : '') + k;
}
var NICE = {ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', PageDown: 'PgDn', PageUp: 'PgUp'};
function pretty(combo){
  if (!combo) return '—';
  return combo.split('+').map(function(p){ return NICE[p] || (p.length === 1 ? p.toUpperCase() : p); }).join(' + ');
}
function match(e){
  var c = comboOf(e); if (!c) return null;
  for (var k in map) if (map[k] === c) return k;
  if (e.shiftKey && e.key.length === 1){ // letters work with or without Shift (as before)
    var plain = e.key.toLowerCase();
    for (var j in map) if (map[j] === plain) return j;
  }
  return null;
}

window.BSFShortcuts = {
  actions: ACTIONS, match: match, pretty: pretty,
  label: function(id){ return pretty(map[id]); },
  short: function(id){ return pretty(map[id]).replace('Shift + ', '⇧'); },
  onChange: function(f){ listeners.push(f); },
  /* Settings > Keyboard shortcuts editor */
  mountEditor: function(root){
    function h(tag, attrs, kids){
      var el = document.createElement(tag);
      for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (v != null && v !== false) el.setAttribute(k, v); }
      (kids || []).forEach(function(c){ if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      return el;
    }
    function render(msg){
      root.innerHTML = '';
      var table = h('div', {'class': 'kb-table'});
      ACTIONS.forEach(function(a){
        var changed = map[a.id] !== a.def;
        var keyEl = h('span', {'class': 'kb-keys'}, map[a.id].split('+').map(function(p){ return h('kbd', {'class': 'key', text: NICE[p] || (p.length === 1 ? p.toUpperCase() : p)}); }));
        var btn = h('button', {'class': 'btn small', type: 'button', text: 'Change'});
        btn.addEventListener('click', function(){
          btn.textContent = 'Press a key…'; btn.classList.add('capturing');
          window.BSFShortcutsCapturing = true;
          function onKey(e){
            e.preventDefault(); e.stopPropagation();
            document.removeEventListener('keydown', onKey, true);
            window.BSFShortcutsCapturing = false;
            var c = comboOf(e);
            if (!c){ render('That key can’t be used. Tab, Enter, Space and / are kept for typing and navigation.'); return; }
            var clash = null; for (var k in map) if (k !== a.id && map[k] === c) clash = k;
            if (clash){
              var other = ACTIONS.filter(function(x){ return x.id === clash; })[0];
              render(pretty(c) + ' is already used for “' + other.name + '”. Choose another key, or change that one first.'); return;
            }
            map[a.id] = c; save(); render('“' + a.name + '” is now ' + pretty(c) + '.');
          }
          document.addEventListener('keydown', onKey, true);
        });
        table.appendChild(h('div', {'class': 'kb-row'}, [
          h('span', {'class': 'cat-dot ' + a.cat, 'aria-hidden': 'true'}),
          h('span', {'class': 'kb-name', text: a.name}),
          keyEl,
          changed ? h('span', {'class': 'kb-changed', text: 'changed (default ' + pretty(a.def) + ')'}) : h('span'),
          btn
        ]));
      });
      root.appendChild(table);
      root.appendChild(h('div', {'class': 'actions', style: 'margin-top:12px'}, [
        h('button', {'class': 'btn small', type: 'button', text: 'Restore default keys', onclick: function(){
          ACTIONS.forEach(function(a){ map[a.id] = a.def; }); save(); render('Default keys restored.'); }})
      ]));
      root.appendChild(h('p', {'class': 'hint', text: msg || 'Shortcuts work on the Meeting and Content tabs whenever you are not typing in a box. Holding a key down triggers it only once. Changes are saved in this browser.'}));
    }
    render();
  }
};
})();
