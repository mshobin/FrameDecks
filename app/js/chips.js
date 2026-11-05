/* FrameDecks 9.13 - the five chips, one definition for every place that shows them: the Command Center
 * (js/command-center.js), the app's top bar (js/chip-bar.js) and the phone remote (js/remote.js). Each chip has the
 * same name, icon and colour everywhere, and each action lives in exactly one chip (tests/test_chips_913.py holds
 * this). `on` lists where an action is offered: cc (Command Center), app (the top bar), phone (the remote). Each
 * place supplies what an action does; this file only says what it is called and where it belongs.
 * Previous, Next, Go Live and Hide all are Control's main actions: they stay in plain view (pinned) on every surface,
 * which is the same action shown permanently, not a second copy. */
(function(root){
'use strict';
var CHIPS = [
  {id: 'prepare', label: 'Prepare', icon: 'layers', hue: 'gold', lede: 'Plan the meeting and get the screens ready.'},
  {id: 'engage', label: 'Engage', icon: 'sparkles', hue: 'violet', lede: 'Bring the room in: chat, drawings and the spotlight.'},
  {id: 'control', label: 'Control', icon: 'radio', hue: 'blue', lede: 'What is on screen, and your meeting app.'},
  {id: 'notes', label: 'Notes', icon: 'sticky-note', hue: 'teal', lede: 'Only on this PC: each note keeps the time and the Frame on screen.'},
  {id: 'more', label: 'More', icon: 'layout-grid', hue: 'slate', lede: 'Settings for this PC and your workspace, and help.'}];

function A(chip, id, label, icon, sub, on, extra){
  var a = {chip: chip, id: id, label: label, icon: icon, sub: sub, on: on};
  for (var k in (extra || {})) a[k] = extra[k];
  return a;
}
var ACTIONS = [
  // Prepare
  A('prepare', 'meetings', 'Meetings', 'calendar-days', 'Switch and plan', ['cc', 'app', 'phone']),
  A('prepare', 'prompter', 'Teleprompter', 'type', 'Your script, only you see it', ['cc', 'app', 'phone']),
  A('prepare', 'share', 'Share Window', 'monitor', 'The window you share', ['cc', 'app']),
  A('prepare', 'studio', 'Studio', 'presentation', 'Frames, Decks, Content', ['cc']),
  A('prepare', 'quick', 'Quick Start', 'rocket', 'Ready-made Frames', ['cc', 'app']),
  A('prepare', 'library', 'Content Library', 'library', 'Add ready-made Content', ['cc', 'app']),
  A('prepare', 'import', 'Import .frame', 'folder-open', 'A plan from the website', ['cc', 'app']),
  A('prepare', 'camera', 'Camera check', 'video', 'FrameDecks vCam', ['cc', 'app']),
  // Engage
  A('engage', 'cards', 'Memory Cards', 'message-circle', 'Chat on screen', ['cc', 'app', 'phone']),
  A('engage', 'capture', 'Capture copies', 'copy', 'Each Ctrl+C is a card', ['cc', 'app'], {toggle: true}),
  A('engage', 'draw', 'Draw', 'pencil', 'On the picture', ['cc', 'app', 'phone'], {toggle: true}),
  A('engage', 'spot', 'Spotlight', 'circle-dot', 'Double-click a word', ['cc', 'app', 'phone'], {toggle: true}),
  A('engage', 'clear', 'Clear drawings', 'eraser', 'Everywhere at once', ['cc', 'app', 'phone']),
  A('engage', 'hidecards', 'Hide the cards', 'eye-off', 'Take chat off screen', ['cc', 'app']),
  // Control (Previous, Next, Go Live and Hide all are pinned in plain view on every surface)
  A('control', 'golive', 'Go Live', 'radio', 'On air or off air', ['cc', 'app', 'phone'], {pinned: true}),
  A('control', 'prevnext', 'Previous and Next', 'chevron-right', 'The Frames in order', ['cc', 'app', 'phone'], {pinned: true}),
  A('control', 'hideall', 'Hide all', 'eye-off', 'Everything off screen', ['cc', 'app', 'phone'], {pinned: true}),
  A('control', 'content', 'The Content one by one', 'list', 'Questions, scriptures, slides', ['cc', 'phone']),
  A('control', 'hidelayer', 'Hide the selected Content', 'eye-off', 'Just this one', ['app']),
  A('control', 'black', 'Black screen', 'square', 'A black picture', ['cc', 'app', 'phone'], {toggle: true}),
  A('control', 'freeze', 'Freeze the picture', 'pause', 'Hold what people see', ['app', 'phone'], {toggle: true}),
  A('control', 'emergency', 'Emergency screen', 'circle-alert', 'Your message, full screen', ['app'], {toggle: true}),
  A('control', 'meetingapp', 'Meeting app', 'mic', 'Mute, Camera, Share, Leave', ['cc']),
  // Notes
  A('notes', 'notes', 'Notes', 'sticky-note', 'Private notes for this meeting', ['cc', 'app', 'phone']),
  // More
  A('more', 'sync', 'Workspace Sync', 'cloud', 'This PC and your workspace', ['cc', 'app']),
  A('more', 'output', 'How people see it', 'cast', 'Zoom, Teams, projector', ['cc', 'app']),
  A('more', 'phone', 'Phone remote', 'smartphone', 'PIN and QR code', ['cc', 'app']),
  A('more', 'brand', 'Meeting & Branding', 'palette', 'Names, logo, look', ['cc', 'app']),
  A('more', 'keys', 'Shortcuts', 'keyboard', 'Keys for every action', ['cc', 'app']),
  A('more', 'all', 'All settings', 'settings', 'Search every setting', ['cc', 'app']),
  A('more', 'help', 'Help & tour', 'info', 'The welcome tour', ['cc', 'app']),
  A('more', 'pcstatus', 'On the PC', 'monitor', 'What the PC is doing', ['phone']),
  A('more', 'disconnect', 'Disconnect this device', 'x', 'Needs the PIN again', ['phone'])];

var byId = {};
ACTIONS.forEach(function(a){ byId[a.id] = a; });
function chip(id){ for (var i = 0; i < CHIPS.length; i++) if (CHIPS[i].id === id) return CHIPS[i]; return null; }
/* the actions of a chip offered in one place (cc / app / phone), in order; pinned ones are left out unless asked */
function actions(chipId, where, withPinned){
  return ACTIONS.filter(function(a){ return a.chip === chipId && (!where || a.on.indexOf(where) >= 0) && (withPinned || !a.pinned); });
}
root.KCChips = {list: CHIPS, all: ACTIONS, chip: chip, action: function(id){ return byId[id] || null; }, actions: actions,
  chipOf: function(id){ return byId[id] ? byId[id].chip : null; }};
})(typeof window !== 'undefined' ? window : this);
