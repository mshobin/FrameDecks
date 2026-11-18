/* FrameDecks 9.13 - the five chips, one definition for every place that shows them: the Command Center
 * (js/command-center.js), the app's top bar (js/chip-bar.js) and the phone remote (js/remote.js). Each chip has the
 * same name, icon and colour everywhere, and each action lives in exactly one chip (tests/test_chips_913.py holds
 * this). `on` lists where an action is offered: cc (Command Center), app (the top bar), phone (the remote). Each
 * place supplies what an action does; this file only says what it is called and where it belongs.
 * Previous, Next, Go Live and Hide all are Control's main actions: they stay in plain view (pinned) on every surface,
 * which is the same action shown permanently, not a second copy. 26.11.7 `alsoIn` shows an action's own tile in one
 * more chip on one surface (the Teleprompter also sits in the Command Center's Engage, where it is used live): it is
 * still one action with one home, listed after that chip's own actions. */
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
  A('prepare', 'share', 'Share Window', 'monitor', 'The window you share', ['cc']),   // 26.11.57 the Studio has its own button above the stage
  A('prepare', 'studio', 'Studio', 'presentation', 'Frames, Decks, Content', ['cc']),
  A('prepare', 'quick', 'Quick Start', 'rocket', 'Ready-made Frames', ['cc', 'app']),
  A('prepare', 'library', 'Content Library', 'library', 'Add ready-made Content', ['cc', 'app']),
  A('prepare', 'songs', 'Song Library', 'music', 'Songs for every service', ['cc', 'app']),   // 26.11.57
  A('prepare', 'import', 'Import…', 'folder-open', 'Lesson, slides, songs, Excel, .frame', ['cc', 'app']),   // 26.11.57 one Import menu
  A('prepare', 'camera', 'Camera check', 'video', 'FrameDecks vCam', ['cc', 'app'], {feature: 'vcam'}),
  // Engage
  A('engage', 'cards', 'Chat Bubbles', 'message-circle', 'Chat on screen', ['cc', 'app', 'phone'], {feature: 'memory'}),
  // 26.11.15 the Teleprompter is used live, so it lives in Engage only (Command Center, top bar and phone alike)
  A('engage', 'prompter', 'Teleprompter', 'type', 'Your script, only you see it', ['cc', 'app', 'phone']),
  A('engage', 'capture', 'Capture copies', 'copy', 'Each Ctrl+C is a card', ['cc', 'app'], {toggle: true, feature: 'memory'}),
  A('engage', 'draw', 'Draw', 'pencil', 'On the picture', ['cc', 'app', 'phone'], {toggle: true}),
  A('engage', 'spot', 'Spotlight', 'circle-dot', 'Double-click a word', ['cc', 'app', 'phone'], {toggle: true}),
  A('engage', 'clear', 'Clear drawings', 'eraser', 'Everywhere at once', ['cc', 'app', 'phone']),
  A('engage', 'hidecards', 'Hide the bubbles', 'eye-off', 'Take chat off screen', ['cc', 'app', 'phone'], {feature: 'memory'}),
  // 26.11.33 a speaker's name across the bottom
  A('engage', 'nametags', 'Name tags', 'user', 'A name and role on screen', ['cc', 'app'], {feature: 'nametags'}),
  // 26.11.43 what members do on their own phones, last in Engage under its own heading (SIDES) on every surface:
  // 26.11.24 one code for everyone (follow along, prayer requests, sermon notes); 26.11.33 a question they answer
  A('engage', 'members', 'Members’ phones', 'smartphone', 'Follow along, prayer requests', ['cc', 'app'], {feature: 'team', side: 'members'}),
  A('engage', 'responses', 'Polls', 'list-checks', 'Ask, then show the answers', ['cc', 'app'], {feature: 'responses', side: 'members'}),
  // 26.11.63 hands up and a queue for the leader, and a quiz on phones with a leaderboard (js/together.js)
  A('engage', 'discussion', 'Discussion', 'users', 'Hands up, who shared, a timer', ['cc', 'app'], {feature: 'team', side: 'members'}),
  A('engage', 'quiz', 'Bible quiz', 'graduation-cap', 'On phones, with a leaderboard', ['cc', 'app'], {feature: 'responses', side: 'members'}),
  // Control (Previous, Next, Go Live and Hide all are pinned in plain view on every surface)
  A('control', 'golive', 'Go Live', 'radio', 'On air or off air', ['cc', 'app', 'phone'], {pinned: true}),
  A('control', 'prevnext', 'Previous and Next', 'chevron-right', 'The Frames in order', ['cc', 'app', 'phone'], {pinned: true}),
  A('control', 'hideall', 'Hide all', 'eye-off', 'Everything off screen', ['cc', 'app', 'phone'], {pinned: true}),
  A('control', 'content', 'The Content one by one', 'list', 'Questions, scriptures, slides', ['cc', 'phone']),
  // 26.11.45 every slide of the PowerPoint on screen at once (js/slide-sorter.js); in the Command Center and on the phone
  // the "Slide 3 of 12" between the Content arrows opens the same grid
  A('control', 'slides', 'Every slide', 'layout-grid', 'Search, jump, run order', ['app']),
  // 26.11.14 say a Bible reference while live and it is offered (or shown, with Auto): Off, Ask or Auto
  A('control', 'listen', 'Listen for scripture', 'book-open', 'Say a verse, it is offered', ['cc', 'app', 'phone'], {toggle: true, feature: 'listen'}),
  A('control', 'hidelayer', 'Hide the selected Content', 'eye-off', 'Just this one', ['app']),
  A('control', 'black', 'Black screen', 'square', 'A black picture', ['cc', 'app', 'phone'], {toggle: true}),
  A('control', 'freeze', 'Freeze the picture', 'pause', 'Hold what people see', ['cc', 'app', 'phone'], {toggle: true}),
  A('control', 'emergency', 'Emergency screen', 'circle-alert', 'Your message, full screen', ['cc', 'app', 'phone'], {toggle: true}),
  A('control', 'meetingapp', 'Meeting app', 'mic', 'Mute, Camera, Share, Leave', ['cc', 'phone']),   // the phone: Mute and Camera only
  // Notes
  A('notes', 'notes', 'Notes', 'sticky-note', 'Private notes for this meeting', ['cc', 'app', 'phone']),
  // More
  A('more', 'sync', 'Sync', 'cloud', 'This PC and your team', ['cc', 'app'], {feature: 'team'}),
  A('more', 'output', 'How people see it', 'cast', 'Zoom, Teams, projector', ['cc', 'app']),
  A('more', 'phone', 'Phone remote', 'smartphone', 'PIN and QR code', ['cc', 'app'], {feature: 'remote'}),
  A('more', 'coleader', 'Co-leader', 'user', 'Hand over, then take back', ['cc', 'app'], {feature: 'remote'}),   // 26.11.63
  A('more', 'brand', 'Meeting & Branding', 'palette', 'Names, logo, look', ['cc', 'app']),
  A('more', 'keys', 'Shortcuts', 'keyboard', 'Keys for every action', ['cc', 'app']),
  // 26.11.31 switch features on or off (js/features.js): set up before the meeting, so it lives in More
  A('more', 'features', 'Features', 'list-checks', 'Switch features on or off', ['cc', 'app']),
  A('more', 'all', 'All settings', 'settings', 'Search every setting', ['cc']),   // 26.11.57 the app has its Settings tab
  A('more', 'help', 'Help & tour', 'info', 'The welcome tour', ['cc', 'app']),
  A('more', 'pcstatus', 'On the PC', 'monitor', 'What the PC is doing', ['phone']),
  A('more', 'disconnect', 'Disconnect this device', 'x', 'Needs the PIN again', ['phone'])];

var byId = {};
ACTIONS.forEach(function(a){ byId[a.id] = a; });
function chip(id){ for (var i = 0; i < CHIPS.length; i++) if (CHIPS[i].id === id) return CHIPS[i]; return null; }
/* the actions of a chip offered in one place (cc / app / phone), in order; pinned ones are left out unless asked */
/* 26.11.31 an action whose feature is switched off is not offered anywhere (js/features.js) */
function featureOn(a){ var F = root.KCFeatures; return !a.feature || !F || F.on(a.feature); }
/* everyFeature: also the actions whose feature is off (a surface that hides them itself with data-feature) */
function actions(chipId, where, withPinned, everyFeature){
  var own = ACTIONS.filter(function(a){ return a.chip === chipId && (!where || a.on.indexOf(where) >= 0) && (withPinned || !a.pinned); });
  var also = where ? ACTIONS.filter(function(a){ return a.alsoIn && (a.alsoIn[chipId] || []).indexOf(where) >= 0; }) : [];
  return everyFeature ? own.concat(also) : own.concat(also).filter(featureOn);
}
/* 26.11.43 the heading over a chip's actions that happen on members' own phones, so it is clear they are for members */
var SIDES = {members: {label: 'On members’ phones', icon: 'smartphone', feature: 'team'}};
root.KCChips = {list: CHIPS, all: ACTIONS, sides: SIDES, chip: chip, action: function(id){ return byId[id] || null; }, actions: actions, offered: featureOn,
  chipOf: function(id){ return byId[id] ? byId[id].chip : null; }};
})(typeof window !== 'undefined' ? window : this);
