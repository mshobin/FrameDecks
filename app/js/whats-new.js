/* FrameDecks 26.11.4 - "What's new": after an update, one small card with the three changes worth knowing, each with
 * a "Show me" that opens the place and lights it once. It shows once per version, only to someone who has used an
 * earlier version (a new install has the Welcome tour instead), and never while live. Close it and it stays closed.
 * Each release adds its three items here (tests/test_help_2611_4.py checks this version has them). */
(function(){
'use strict';
var NEWS = {
  '26.11.46': [
    {title: 'Animations play', text: 'A PowerPoint with animations is played by PowerPoint itself, behind your windows: fly-ins, fades, transitions and videos play on the picture as in PowerPoint.', show: {spot: '#lc-control'}},
    {title: 'Next plays each click', text: 'Next plays the slide\u2019s next animation, then the next slide. The grid and the Teleprompter show animation 1 of 3.'}
  ],
  '26.11.45': [
    {title: 'Every slide at once', text: 'Press Slide 3 / 12 in the top bar: every slide of your PowerPoint, search through its words and notes, and click one to put it on screen. It is also in Control → Every slide.', show: {spot: '#lc-control'}},
    {title: 'Run order, zoom and hold', text: 'Hide or move slides for this meeting without changing the file, zoom into part of a slide, put yourself beside it, or hold with a kind message. A passage named on a slide is offered as the scripture card.', show: {settings: 'listening'}},
    {title: 'Slides in the Teleprompter', text: 'The slide on screen, the next one and its speaker notes sit beside your script, with how long the slide has been up.'}
  ],
  '26.11.44': [
    {title: 'A QR code to scan', text: 'Show the code on screen now puts a QR code beside the code, on the camera and the Share Window, so people point their phone at the screen.', show: {spot: '#lc-members'}},
    {title: 'QR code on your badge', text: 'Settings \u2192 Meeting & Branding: a small QR code beside or below your logo while members\u2019 phones is open, for anyone who arrives late.', show: {settings: 'meeting'}}
  ],
  '26.11.43': [
    {title: 'On members\u2019 phones', text: 'Members\u2019 phones and Polls sit together under their own heading in Engage, in the Command Center and the top bar, so the members\u2019 side is easy to tell apart.', show: {spot: '#lc-engage'}},
    {title: 'The code stays on screen', text: 'Show the code on screen now puts it on the camera and the Share Window until you take it off.', show: {spot: '#lc-members'}}
  ],
  '26.11.42': [
    {title: 'Draw and Spotlight in the Command Center', text: 'Draw and Spotlight in the top bar open the Command Center on Engage. Its panels keep their size while you use them.', show: {spot: '#lc-engage'}},
    {title: 'Go Live stays on', text: 'A press goes live; only holding for a second goes off air, in the Command Center too. With nothing on air, Next goes live with your selected Frame.', show: {spot: '#cb-take'}}
  ],
  '26.11.41': [
    {title: 'Say it your way', text: 'Voice commands understand \u201clet\u2019s see the verse\u201d, \u201clet\u2019s go to day 2\u201d and \u201cthe next day\u201d. Give a Frame other names in its Also called box.', show: {settings: 'listening'}},
    {title: 'Sync in the Frames panel', text: 'Sync beside Quick Start shows what would change, Frame by Frame, before anything does. A Frame made in both places is kept once.', show: {spot: '#frames-sync'}}
  ],
  '26.11.40': [
    {title: 'Next meeting on framedecks.com', text: 'The website\u2019s left panel shows the next meeting, how ready it is, the church PC and any changes waiting for Sync Now.', show: {settings: 'account'}}
  ],
  '26.11.39': [
    {title: 'Sync Now on the website', text: 'Frame changes on framedecks.com wait until you press Sync Now under the timeline. Only what changed is sent, never twice.', show: {settings: 'account'}},
    {title: 'Delete several Frames at once', text: 'On the website, click Frame numbers to select them in the list or on the timeline, then delete them together.', show: {settings: 'account'}}
  ],
  '26.11.38': [
    {title: 'Open your workspace with an email code', text: 'On framedecks.com type your email, then the 6-digit code it brings. Choose Someone else\u2019s on a work computer and it closes with the tab.', show: {settings: 'account'}},
    {title: 'Told where it was opened', text: 'An email tells you each time your workspace is opened with your code. Devices can sign out every other computer.', show: {settings: 'account'}}
  ],
  '26.11.37': [
    {title: 'Open in this PC’s browser', text: 'Settings → Sync opens your workspace on framedecks.com in this PC’s browser, already as you.', show: {settings: 'account'}},
    {title: 'Your phone is the key', text: 'On framedecks.com choose Open with your phone: scan, allow, and your workspace opens.', show: {settings: 'account'}}
  ],
  '26.11.36': [
    {title: 'A first sync you see first', text: 'Connecting a PC shows, meeting by meeting, what syncing will do. What already exists is skipped and meetings are never mixed.', show: {settings: 'account'}},
    {title: 'Undo this connection', text: 'For 7 days after connecting, Settings → Sync → More puts the workspace and this PC back as they were.', show: {settings: 'account'}}
  ],
  '26.11.35': [
    {title: 'Go Live stays Go Live', text: 'After Next and Next it still reads Go Live. Hold it for a second to go off air.', show: {spot: '#cb-take'}},
    {title: 'Hide all is instant', text: 'Everything leaves the screen at once, with no Undo bar.', show: {spot: '#ctlbar'}}
  ],
  '26.11.34': [
    {title: 'Choose the microphone', text: 'Settings → Listening → Microphone: scripture, voice commands and Follow my voice all listen with it. A Bluetooth headset’s call microphone is marked.', show: {settings: 'listening', spot: '#mic-box'}},
    {title: 'Listening goes on', text: 'If the chosen microphone drops out in a meeting, FrameDecks goes on with the Windows default microphone and tells you once.', show: {settings: 'listening', spot: '#mic-box'}}
  ],
  '26.11.33': [
    {title: 'Songs, verse by verse', text: 'Add a Song Deck and paste a hymn: it splits into verses at the blank lines, and Next steps through them before the next Frame.', show: {settings: 'features', spot: '#ft-songs'}},
    {title: 'Name tags and polls', text: 'Engage → Name tags puts a name and role across the bottom of the picture. Engage → Polls asks members’ phones Yes / No, a poll or a rating.', show: {settings: 'features', spot: '#ft-nametags'}},
    {title: 'Timing plan', text: 'Give each Frame its planned minutes: a quiet pill beside Go Live says whether you are on time, only to you.', show: {settings: 'features', spot: '#ft-timing'}}
  ],
  '26.11.32': [
    {title: 'Settings, in six groups', text: 'Start here, Meeting look, Content, How people see it, People & devices and This PC. Nothing changed: each setting lives where you would look for it.', show: {settings: 'features'}},
    {title: 'Listening, in one place', text: 'Listen for scripture, Voice commands and Follow my voice: everything that can hear you, on one page.', show: {settings: 'listening'}}
  ],
  '26.11.31': [
    {title: 'Choose the features you use', text: 'Settings → Start here → Features: switch off what you don’t use. It leaves the chips, the Command Center and the phone remote, and its work stops. Simple, Bible study or Full to start.', show: {settings: 'features', spot: '#features-box'}},
    {title: 'Features in the Command Center', text: 'More → Features: the same switches in a list. They change only while nothing is on air.', show: {settings: 'features', spot: '#features-box'}}
  ],
  '26.11.30': [
    {title: 'If your plan file is ever damaged, you are told', text: 'FrameDecks keeps the damaged file and opens your newest backup. Now the Studio says so once, so you can check any Frames added since.', show: {settings: 'diag'}},
    {title: 'What to do in a hurry', text: 'The Ready check ends with the keys that black the screen and hide everything, and where the Emergency screen is.', show: {spot: '#cb-take'}}
  ],
  '26.11.29': [
    {title: 'Off air, by holding Go Live', text: 'With the Frame on air selected, Go Live reads Off air. Hold it for a second to take everything off screen, with Undo. A quick press never does.', show: {spot: '#cb-take'}}
  ],
  '26.11.28': [
    {title: 'Ready check', text: 'Under Go Live: the camera, your light and framing, the microphone, your meeting app, scriptures and media, all at once. Each line has its one fix.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Next week, in one click', text: 'Next week (beside the meeting name): the same Frames a week later, with the scripture and questions left empty to fill in.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Seasons, Christmas too', text: 'Settings → Meeting & Branding → Season: Advent, Christmas, Easter or Harvest colours on every card, with a gentle snowfall at Christmas.', show: {settings: 'meeting', spot: '#mb-season'}}
  ],
  '26.11.27': [
    {title: 'Say a Frame’s name', text: 'Hold Right Ctrl and say “go to Welcome”, or the name of a Deck in the live Frame. Let go and it happens, with Undo.', show: {settings: 'scripture', spot: '#vc-settings'}},
    {title: 'A verse asks first', text: 'Hold Right Ctrl and say “show John three sixteen”: it comes up as “You asked for”, with Show. Press it, or say “show it”.', show: {settings: 'scripture', spot: '#vc-settings'}}
  ],
  '26.11.26': [
    {title: 'Add a device opens your workspace', text: 'Settings → Sync → Add a device: scan the code with your phone and it opens your workspace as you. Nothing to type, nobody to approve.', show: {settings: 'account', spot: '#sync-add'}},
    {title: 'Connect this PC from the website', text: 'On framedecks.com, Home → Connect this PC. FrameDecks asks once here: choose Connect. No code to type.', show: {settings: 'account', spot: '#sync-add'}}
  ],
  '26.11.25': [
    {title: 'The corner card', text: 'With the Studio behind Zoom or Teams, a card in the corner shows a verse heard or a prayer request waiting, with Show right there. Only you see it.', show: {settings: 'general', spot: '#feel-settings'}}
  ],
  '26.11.24': [
    {title: 'Members’ phones', text: 'Engage → Members’ phones: one QR for everyone. Their phone follows the meeting screen and can send you a prayer request.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Sermon notes', text: 'When a meeting ends, its summary has Sermon notes: your script, the scriptures and the questions, to print, email or share with members’ phones.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'A verse said by a member', text: 'Settings → Scripture → Members: when someone on Zoom or Teams says a verse, you are asked whether to show it.', show: {settings: 'scripture', spot: '#vl-settings'}}
  ],
  '26.11.23': [
    {title: 'A summary of every meeting', text: 'When a meeting ends: each Frame and how long it was on, the questions and scriptures, to print, save as PDF or email.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Prayer requests from phones', text: 'Engage → Prayer requests: people scan a code and send a request. You read each one first and choose what is shown.', show: {settings: 'general', spot: '#feel-settings'}}
  ],
  '26.11.22': [
    {title: 'Undo for 5 seconds', text: 'Next, Previous, Hide all, Black screen and Emergency off show Undo for 5 seconds, in the Studio and the Command Center.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Smart Next', text: 'Next can show the live Frame’s questions, then its scriptures, then the next Frame. Switch it on in Settings → General.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Recovered after a crash', text: 'If FrameDecks closes unexpectedly while live, the live Frame comes back on its own and the Studio says so.', show: {settings: 'general', spot: '#feel-settings'}},
    {title: 'Find any setting', text: 'Settings search now finds a setting inside its page and lights it up; each page can be reset on its own.', show: {settings: 'general', spot: '#sn-find'}}
  ],
  '26.11.21': [
    {title: 'Your own key for voice commands', text: 'Hold Right Ctrl, Left Ctrl, F8 or a key you choose. A quick shortcut such as Ctrl+C never turns the microphone on.', show: {settings: 'scripture', spot: '#vc-settings'}}
  ],
  '26.11.20': [
    {title: 'Voice commands: hold to talk', text: 'While live, hold Right Ctrl, say “next frame” or “hide all”, and let go. Switch it on in Settings → Scripture.', show: {settings: 'scripture', spot: '#vc-settings'}},
    {title: 'Every press answers at once', text: 'Next Frame and the chips no longer wait behind the windows’ other requests.'}
  ],
  '26.11.19': [
    {title: 'No box behind the Command Center', text: 'The Command Center keeps its shape on every PC, presses answer sooner while live, and all of Control fits on screen.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.18': [
    {title: 'The Command Center opens smoothly again', text: 'The chips flow out of the search bar as before, with the curved joins, and Control shows in full.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.17': [
    {title: 'The Command Center pours open', text: 'Its chips flow out of the search bar like a waterfall again, with the curved joins, and drop in one after another.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'Never cut short', text: 'Control always shows in full, down to the last button, also right after the Command Center opens.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.16': [
    {title: 'Emergency and the clock, wherever you are', text: 'Emergency screen and the meeting clock are in Control on the Command Center and your phone. Mute and Camera are on the phone too.', show: {spot: '#lc-control'}},
    {title: 'Verses from your plan, instantly', text: 'Say a verse that is in your plan and the planned passage is offered, shown at once, even offline. Earlier keeps the last three verses heard.', show: {settings: 'scripture', spot: '#vl-settings'}},
    {title: 'The Teleprompter is in Engage', text: 'On the Command Center, the top bar and the phone, the Teleprompter now lives in Engage only.', show: {spot: '#lc-engage'}}
  ],
  '26.11.15': [
    {title: 'Listen for scripture, sharper', text: 'A new verse is caught even mid-sentence, and the same verse again a little later. It also works while the Studio is behind Zoom.', show: {settings: 'scripture', spot: '#vl-settings'}},
    {title: 'Off, Ask or Auto, wherever you are', text: 'Switch Listen for scripture and Show or Dismiss a verse from the Command Center\u2019s Control, the top bar or your phone.', show: {spot: '#lc-control'}},
    {title: 'The same chips everywhere', text: 'Freeze is in the Command Center (Alt+F), and Hide the cards is on the phone remote.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.14': [
    {title: 'Draw and Spotlight without sharing', text: 'In the Command Center, Draw and Spotlight open a small pad with the live picture. What you draw shows on your camera picture in Zoom or Teams.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'Say the verse, show the verse', text: 'Turn on Listen for scripture: say a reference like Romans 8:38 while live and FrameDecks offers to show it.', show: {settings: 'scripture', spot: '#vl-settings'}},
    {title: 'How long have we got?', text: 'The Frames list shows the meeting clock, and the live Frame\u2019s time against its Planned time, in gold once it runs over.', show: {spot: '#scene-list'}}
  ],
  '26.11.13': [
    {title: 'A bigger live picture', text: 'The picture takes the Studio’s room. Beside it: is all well, what comes next, and one button, Go Live then Next.', show: {spot: '#ls-go'}},
    {title: 'Drag it your way', text: 'Drag the border under the picture to resize it; double-click it to fit. Drag it far up for a compact layout with the editor beside a small picture.', show: {spot: '#stage-row'}},
    {title: 'Simple or Advanced, in the editor’s bar', text: 'The switch now sits at the right of the editor’s bar and stays there when the editor is folded.', show: {spot: '.sm-seg'}}
  ],
  '26.11.12': [
    {title: 'Simple by default', text: 'The Studio now shows just what you need to run a meeting, with a bigger live picture. Choose Advanced above the picture for every control.', show: {spot: '.sm-seg'}},
    {title: 'Add a device by scanning', text: 'Settings \u2192 Sync \u2192 Add a device shows a QR code. Scan it with your phone\u2019s camera and it joins your team, with no email or password.', show: {settings: 'account', spot: '#sync-add'}},
    {title: 'Camera, window or both', text: 'Choose how people see your meeting. With Share a window, FrameDecks works without the virtual camera.', show: {settings: 'output', spot: '.out-pick'}}
  ],
  '26.11.11': [
    {title: 'A clean Command Center in meetings', text: 'No grey box behind the Command Center any more, also when you open it over Zoom or Teams or keep it pinned.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.10': [
    {title: 'Question, Both or Scripture', text: 'In the Command Center\u2019s Control, a Frame with a question and a scripture has a Shows switch: the question, both, or the scripture.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'A smoother camera', text: 'With background blur on, FrameDecks vCam now shares its work across two cores, so it keeps up better on slower PCs.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.9': [
    {title: 'The camera keeps up', text: 'If background blur slows FrameDecks vCam down in a meeting, FrameDecks lightens the work by itself and goes back to your setting when the PC has room. The blur is also faster on every PC.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'A natural blur, always', text: 'Every blur setting now softens the background like a camera lens focused on you, with no halo around you.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.8': [
    {title: 'Your logo without its box', text: 'Branding \u2192 Look has a Background slider: from the full plate down to None, where only your logo and name show.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'Lighter in meetings', text: 'While Zoom or Teams uses FrameDecks vCam, the Teleprompter drops its blur and the Studio\u2019s previews rest whenever the Studio is behind your meeting.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.7': [
    {title: 'Lighter during meetings', text: 'While Zoom or Teams uses FrameDecks vCam, the Studio\u2019s picture rests whenever the Studio is behind your meeting, and the blur gets lighter when the PC is very busy.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'Before you go live', text: 'The Command Center\u2019s Control chip (Alt+Space, Alt+3) now says what is in the way, like the Windows Camera app holding your webcam, with one button to fix it.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'Teleprompter in Engage', text: 'The Teleprompter is also in the Command Center\u2019s Engage chip, where you reach for it live.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.6': [
    {title: 'Nothing around the Command Center', text: 'Alt+Space now shows only the bar, its chips and the panel you open. The grey box some PCs drew around it is gone.', show: {settings: 'keys', spot: '#keys-global'}}
  ],
  '26.11.5': [
    {title: 'Controls that float', text: 'The Command Center (Alt+Space) now shows its buttons straight on the glass, with no box around each one. Colour stays only where it means something: on air, the next step, hide all.', show: {settings: 'keys', spot: '#keys-global'}},
    {title: 'The phone remote, the same way', text: 'Its buttons and tools sit straight on the page and light up softly when you press them.', show: {settings: 'ipad', spot: '#remote-box'}}
  ],
  '26.11.4': [
    {title: 'Check my connection', text: 'Phone won’t connect? Settings → Phone & iPad Remote now checks every step and fixes the first problem in one click.', show: {settings: 'ipad', spot: '#cx-run'}},
    {title: 'Help where you need it', text: 'A small ? next to the remote, the camera, Capture Memory and Sync opens the right page of the guide. Problems now show a short code like FD-NET-02.', show: {settings: 'ipad', spot: '#remote-box'}},
    {title: 'Every key on one page', text: 'Press ? in the Command Center (Alt+Space) to see all its keys. They are also in Settings → Keyboard shortcuts.', show: {settings: 'keys', spot: '#keys-global'}}
  ]
};
var SEEN = 'kc-whats-new';
function get(){ try { return localStorage.getItem(SEEN); } catch(e){ return null; } }
function seen(v){ try { localStorage.setItem(SEEN, v); } catch(e){} }
function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
var card = null;
function close(v){ if (card){ card.remove(); card = null; } seen(v); }
function showMe(item){
  if (item.show.settings && window.KCSetTab){ KCSetTab('settings'); if (window.KCShowSection) KCShowSection(item.show.settings); }
  setTimeout(function(){
    var el = item.show.spot && document.querySelector(item.show.spot);
    if (!el) return;
    el.scrollIntoView({block: 'center'});
    el.classList.add('kc-show-me');
    setTimeout(function(){ el.classList.remove('kc-show-me'); }, 2600);
  }, 350);
}
function open(v){
  var items = NEWS[v];
  if (!items || card) return;
  card = h('aside', 'wn');
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'What’s new in FrameDecks ' + v);
  var head = h('div', 'wn-head');
  head.appendChild(h('b', '', 'What’s new in ' + v));
  var x = h('button', 'wn-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.title = 'Close';
  x.addEventListener('click', function(){ close(v); });
  head.appendChild(x); card.appendChild(head);
  var list = h('ol', 'wn-list');
  items.forEach(function(it){
    var li = h('li'), go = h('button', 'btn small', 'Show me');
    go.type = 'button';
    go.addEventListener('click', function(){ showMe(it); });
    li.appendChild(h('b', '', it.title)); li.appendChild(h('p', '', it.text)); li.appendChild(go);
    list.appendChild(li);
  });
  card.appendChild(list);
  document.body.appendChild(card);
}
document.addEventListener('kc-app-info', function(e){
  var d = e.detail || {}, v = d.version, last = get();
  if (!v || last === v) return;
  var ob = (d.settings && d.settings.onboarding) || {};
  if (!(ob.done || ob.skipped)){ seen(v); return; }           // a new install: the Welcome tour, not "what's new"
  var st = window.KCStore && KCStore.get(), live = st && st.live && st.live.scene;
  if (live) return;                                         // never over a live meeting: next start instead
  open(v);
});
window.KCWhatsNew = {news: NEWS, open: open};
})();
