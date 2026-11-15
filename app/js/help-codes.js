/* FrameDecks 26.11.4 - the error codes: one short code per thing that can go wrong, the same on the PC, the phone and
 * the website. Each says what happened, why, and the one fix to try; framedecks.com/help?code=FD-NET-02 opens it.
 * This file is the only list: hosted/scripts/write-content.mjs copies the JSON between the markers to the website
 * (content/help-codes.json), and tests/test_help_2611_4.py checks every code is used and every code has its fix.
 * Keep the JSON plain (double quotes, no comments) between the markers. */
(function(){
'use strict';
var CODES = /* codes:start */[
  {"code": "FD-REM-01", "area": "Phone remote", "title": "The phone remote is off",
   "why": "When it is off, nothing on the network can reach this PC.",
   "fix": "On the PC: Settings → Phone & iPad Remote → turn on the switch."},
  {"code": "FD-REM-02", "area": "Phone remote", "title": "That PIN isn’t right",
   "why": "The phone sent a PIN that doesn’t match the one on the PC.",
   "fix": "Type the 6-digit PIN shown on the PC in Settings → Phone & iPad Remote."},
  {"code": "FD-REM-03", "area": "Phone remote", "title": "Too many wrong PINs",
   "why": "After several wrong PINs the PC waits a little before it accepts another, to keep guessers out.",
   "fix": "Wait for the countdown, then type the PIN shown on the PC."},
  {"code": "FD-REM-04", "area": "Phone remote", "title": "The phone stopped responding",
   "why": "The phone was connected, then went quiet: its screen locked, it changed Wi-Fi, or the page closed.",
   "fix": "Unlock the phone and reopen FrameDecks Remote. Check it is still on the same Wi-Fi as the PC."},
  {"code": "FD-NET-01", "area": "Network", "title": "This PC isn’t on a network",
   "why": "The PC has no Wi-Fi or cable connection, so phones can’t find it.",
   "fix": "Connect the PC to the same Wi-Fi as your phone or iPad."},
  {"code": "FD-NET-02", "area": "Network", "title": "Windows treats this network as Public",
   "why": "On Public networks Windows blocks other devices from reaching this PC.",
   "fix": "If this is your own home or church Wi-Fi, set it to Private: Open network settings → your Wi-Fi → Private."},
  {"code": "FD-NET-03", "area": "Network", "title": "Windows Firewall may be blocking the remote",
   "why": "The optional permission for FrameDecks isn’t added, and some PCs block new programs.",
   "fix": "Choose Allow through Windows Firewall. Windows asks first; it only allows this program, on private networks."},
  {"code": "FD-NET-04", "area": "Network", "title": "The PC isn’t answering on its own address",
   "why": "The phone remote is on, but its network connection didn’t open.",
   "fix": "Choose Restart the remote. If it still fails, restart FrameDecks."},
  {"code": "FD-NET-05", "area": "Network", "title": "The phone can’t reach this PC",
   "why": "The PC is ready, so something between them is blocking it: a guest Wi-Fi, the router, or security software.",
   "fix": "Put both on the same Wi-Fi (not a guest network). Security software (Norton, McAfee…) may need to allow FrameDecks. Or use the website’s Live page over the internet."},
  {"code": "FD-NET-06", "area": "Network", "title": "This PC has more than one network address",
   "why": "A VPN or a second adapter gives the PC another address; the phone may be on the other one.",
   "fix": "Try the other address listed under Connect, or turn the VPN off during the meeting."},
  {"code": "FD-CLD-01", "area": "Workspace", "title": "The code doesn’t look right",
   "why": "Codes have 8 letters and numbers, as shown on the PC.",
   "fix": "Copy the code exactly as the PC shows it. Spaces don’t matter."},
  {"code": "FD-CLD-02", "area": "Workspace", "title": "This code has ended",
   "why": "Codes run out after a few minutes and work once.",
   "fix": "On the PC or the device that showed it, choose Add a device again for a new code."},
  {"code": "FD-CLD-03", "area": "Workspace", "title": "The PC hasn’t picked up the link yet",
   "why": "The link is saved, but the PC needs to be on and online to finish it.",
   "fix": "Open FrameDecks on the PC and check it has internet. It finishes by itself within a few seconds."},
  {"code": "FD-CLD-04", "area": "Workspace", "title": "Workspace syncing isn’t set up yet",
   "why": "The workspace owner hasn’t finished setting up syncing.",
   "fix": "Ask the workspace owner to finish setting up Sync, then try again."},
  {"code": "FD-CLD-05", "area": "Workspace", "title": "Can’t reach FrameDecks",
   "why": "This device has no internet, or a network filter blocks framedecks.com.",
   "fix": "Check the internet connection, then try again."},
  {"code": "FD-CLD-06", "area": "Workspace", "title": "Joining with a code isn’t switched on",
   "why": "Anonymous sign-ins are off for this site, so a new device can’t join by scanning a code.",
   "fix": "Ask the workspace owner to turn on Allow anonymous sign-ins in Supabase, or use an email code instead."},
  {"code": "FD-CLD-07", "area": "Workspace", "title": "Opening by scanning isn’t set up",
   "why": "The server function that opens the workspace on a phone from an Add a device code isn’t deployed on this site yet.",
   "fix": "Use an email code for now, and ask the workspace owner to deploy device-sign-in (docs: passwordless setup)."}
]/* codes:end */;
/* 26.11.4 the "?" links: a place in the program -> its page in the guide (framedecks.com/docs, the same words as
   docs/guide/) or the Help Center. tests/test_help_2611_4.py checks every page and heading exists. */
var LINKS = {
  'remote': ['Phone & iPad Remote', 'docs/remote-control#set-up-the-remote'],
  'remote-fix': ['If the phone can’t connect', 'docs/remote-control#if-the-phone-cant-connect'],
  'vcam': ['FrameDecks vCam in Zoom, Teams and Meet', 'docs/faq#online-and-hybrid-services'],
  'memory': ['Capture Chats', 'docs/presentations#capture-chats-copied-chats-as-bubbles-on-the-camera'],
  'voice': ['Teleprompter and Follow my voice', 'docs/presentations#teleprompter'],
  'sync': ['Sync', 'help#account'],
  'keys': ['Keyboard shortcuts', 'docs/presentations#keyboard-shortcuts']
};
var by = {};
CODES.forEach(function(c){ by[c.code] = c; });
var SITE = 'https://framedecks.com/help', HOME = 'https://framedecks.com/';
function open(url){
  fetch('api/app/open-external', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: url})})
    .then(function(r){ return r.json(); }).then(function(d){ if (!d.opened) window.open(url, '_blank', 'noopener'); })
    .catch(function(){ window.open(url, '_blank', 'noopener'); });
}
/* any element with data-help="memory" opens that page: one handler for the whole window */
document.addEventListener('click', function(e){
  var el = e.target.closest && e.target.closest('[data-help]');
  if (!el || !LINKS[el.getAttribute('data-help')]) return;
  e.preventDefault();
  open(HOME + LINKS[el.getAttribute('data-help')][1]);
});
window.KCHelpCodes = {
  list: CODES,
  get: function(code){ return by[code] || null; },
  /* The Help Center page for a code (or a topic), opened in the browser */
  url: function(code){ return SITE + (code ? '?code=' + encodeURIComponent(code) : ''); },
  topic: function(id){ return SITE + '?topic=' + encodeURIComponent(id); },
  links: LINKS,
  open: open,
  /* the small round "?" that opens the Help page for a place: KCHelpCodes.button('memory') */
  button: function(area){
    var b = document.createElement('button'), t = 'Help: ' + LINKS[area][0];
    b.type = 'button'; b.className = 'help-q'; b.textContent = '?'; b.title = t; b.setAttribute('aria-label', t); b.setAttribute('data-help', area);
    return b;
  }
};
})();
