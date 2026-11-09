/* FrameDecks 26.11.4 - the keys that work everywhere (the Command Center and the system-wide shortcut), in one list:
 * the Command Center's Keys sheet (? or More → Shortcuts), Settings → Keyboard shortcuts and the website's Help search
 * all show this list. The Studio's own keys can be changed and live in js/shortcuts.js. Keep it true:
 * tests/test_help_2611_4.py checks each key against the code that answers it. */
(function(){
'use strict';
var KEYS = [
  {keys: 'Alt+Space', what: 'Open the Command Center', where: 'Anywhere'},
  {keys: 'Right Ctrl (hold)', what: 'Voice commands: hold, say “next frame” or “go to Welcome”, let go (while live). Left Ctrl, F8 or your own key in Settings → Scripture', where: 'Anywhere'},
  {keys: '?', what: 'This list of keys', where: 'Command Center'},
  {keys: 'Alt+1 … Alt+5', what: 'Open a chip: Prepare, Engage, Control, Notes, More', where: 'Command Center'},
  {keys: 'Alt+→ / Alt+←', what: 'Next / previous Frame', where: 'Command Center'},
  {keys: 'Alt+↓ / Alt+↑', what: 'Next / previous Content (question, verse)', where: 'Command Center'},
  {keys: 'Alt+H', what: 'Hide all', where: 'Command Center'},
  {keys: 'Alt+B', what: 'Black screen', where: 'Command Center'},
  {keys: 'Alt+F', what: 'Freeze the picture', where: 'Command Center'},
  {keys: 'Alt+P', what: 'Play or pause the video', where: 'Command Center'},
  {keys: 'Alt+L', what: 'Spotlight', where: 'Command Center'},
  {keys: 'Alt+D', what: 'Draw on the picture', where: 'Command Center'},
  {keys: 'Alt+M', what: 'Mute in your meeting app', where: 'Command Center'},
  {keys: 'Alt+V', what: 'Camera on or off in your meeting app', where: 'Command Center'},
  {keys: 'Alt+S', what: 'Share your screen in your meeting app', where: 'Command Center'},
  {keys: 'Alt+= / Alt+-', what: 'Volume up / down', where: 'Command Center'},
  {keys: 'Ctrl+C', what: 'With Capture on, a copied message becomes a Memory Card', where: 'Anywhere'},
  {keys: 'Ctrl+K or Ctrl+Space', what: 'The command palette: search every action', where: 'Studio'}
];
window.KCKeys = {
  list: KEYS,
  /* a <kbd> for each key in "Alt+→ / Alt+←" (the slashes and words stay as text) */
  caps: function(text){
    var frag = document.createDocumentFragment();
    String(text).split(/(\s\/\s|\sor\s|\s…\s)/).forEach(function(part){
      if (/^\s(\/|or|…)\s$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
      part.split('+').forEach(function(k, i){
        if (i) frag.appendChild(document.createTextNode('+'));
        var b = document.createElement('kbd'); b.textContent = k; frag.appendChild(b);
      });
    });
    return frag;
  },
  /* the list as a table: one row per key */
  table: function(filter){
    var t = document.createElement('div'); t.className = 'kk';
    KEYS.filter(filter || function(){ return true; }).forEach(function(k){
      var row = document.createElement('div'); row.className = 'kk-row';
      var a = document.createElement('span'); a.className = 'kk-keys'; a.appendChild(window.KCKeys.caps(k.keys));
      var b = document.createElement('span'); b.className = 'kk-what'; b.textContent = k.what;
      var c = document.createElement('span'); c.className = 'kk-where'; c.textContent = k.where;
      row.appendChild(a); row.appendChild(b); row.appendChild(c); t.appendChild(row);
    });
    return t;
  }
};
})();
