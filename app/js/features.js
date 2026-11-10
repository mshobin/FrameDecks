/* FrameDecks 26.11.31 - features you switch on or off. One list for every surface: Settings → Start here → Features,
 * the Command Center's More → Features, the Welcome's three ready-made sets, the chips (js/chips.js leaves out an
 * action whose feature is off), the command palette and the phone remote. The program keeps the switches
 * (src/features.py, kc-app-settings.json) and stops a feature's background work when it is off; they change only
 * while nothing is on air. The core (Studio, Frames, Decks, Go Live / Off air, Hide all, Black screen, Emergency,
 * scripture and question cards) is never a switch.
 * An element marked data-feature="memory" (several ids: all must be on) is hidden while that feature is off. */
(function(root){
'use strict';
var GROUPS = [
  {id: 'screen', label: 'On screen'},
  {id: 'listening', label: 'Listening'},
  {id: 'people', label: 'People'},
  {id: 'after', label: 'After the meeting'},
  {id: 'helpers', label: 'Helpers'}];
// the same ids, groups and names as src/features.py (tests/test_features_2611_31.py)
var LIST = [
  {id: 'vcam', group: 'screen', label: 'FrameDecks vCam and Looks', what: 'Your picture with the cards, as a camera in Zoom or Teams.', off: 'Off: share the Share Window instead (How people see it). Saves the most memory.'},
  {id: 'memory', group: 'screen', label: 'Memory Cards and Capture copies', what: 'Copied chat messages shown as bubbles on screen.', off: 'Off: the clipboard is never watched.'},
  {id: 'birthdays', group: 'screen', label: 'Birthdays', what: 'Birthday reminders and the birthday card.'},
  {id: 'seasons', group: 'screen', label: 'Seasons', what: 'Christmas, Easter and other looks for the cards.'},
  {id: 'listen', group: 'listening', label: 'Listen for scripture', what: 'Hears a Bible reference while live and offers it.', off: 'Off: the microphone is never opened for it.'},
  {id: 'voice', group: 'listening', label: 'Voice commands', what: 'Hold Right Ctrl and say “next frame”.', off: 'Off: the key and the microphone are left alone.'},
  {id: 'follow', group: 'listening', label: 'Teleprompter: Follow my voice', what: 'The script scrolls as you speak. The Teleprompter stays either way.'},
  {id: 'remote', group: 'people', label: 'Phone remote', what: 'Run the meeting from a phone or iPad on the same Wi-Fi.', off: 'Off: this PC takes no connections from the network.'},
  {id: 'team', group: 'people', label: 'Prayer wall, members’ phones and Sync', what: 'Your team and members, through framedecks.com.', off: 'Off: hidden here. A PC already added keeps syncing until you disconnect it in Sync.'},
  {id: 'summary', group: 'after', label: 'Meeting summary, sermon notes and Moment', what: 'What was shown, kept for the summary after the meeting.', off: 'Off: nothing is recorded about the meeting.'},
  {id: 'ready', group: 'helpers', label: 'Ready check and light hints', what: 'One look at everything before you go live.'},
  {id: 'guard', group: 'helpers', label: 'Lighter during meetings', what: 'FrameDecks does less while the PC is busy with your meeting.'},
  // 26.11.33
  {id: 'songs', group: 'screen', label: 'Songs and lyrics', what: 'Paste a hymn: it splits into verses you step through with Next.'},
  {id: 'nametags', group: 'screen', label: 'Speaker name tags', what: 'A name and role across the bottom of the picture, in two clicks.'},
  {id: 'responses', group: 'people', label: 'Polls and responses from members’ phones', what: 'Yes or no, a poll or a 1–5 rating, answered on their phones.', off: 'Off: no question is sent to phones.'},
  {id: 'timing', group: 'helpers', label: 'Timing plan', what: 'On time or minutes over, against each Frame’s planned minutes. Only you see it.'}];
var PRESETS = [
  {id: 'simple', label: 'Simple', icon: 'layout-grid', text: 'The essentials and the Teleprompter.'},
  {id: 'study', label: 'Bible study', icon: 'book-open', text: 'Adds Listen for scripture, Memory Cards, songs, name tags, polls, the phone remote and the summary.'},
  {id: 'full', label: 'Full', icon: 'layers', text: 'Everything FrameDecks can do.'}];

var state = {features: null, preset: '', locked: false, rev: -1}, subs = [];
var byId = {}; LIST.forEach(function(f){ byId[f.id] = f; });

function on(id){ return !state.features || state.features[id] !== false; }
function allOn(ids){ return String(ids || '').split(/\s+/).filter(Boolean).every(on); }
function count(){ var n = 0; LIST.forEach(function(f){ if (on(f.id)) n++; }); return n; }

/* hide what is off: one style for every page (CSS rules by feature id) and a class on <html> per feature off */
var styled = false;
function paint(){
  if (typeof document === 'undefined') return;
  if (!styled){
    styled = true;
    var css = LIST.map(function(f){ return 'html.ft-off-' + f.id + ' [data-feature~="' + f.id + '"]{display:none!important}'; }).join('\n');
    var st = document.createElement('style'); st.id = 'kc-features-css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  var cl = document.documentElement.classList;
  LIST.forEach(function(f){ cl.toggle('ft-off-' + f.id, !on(f.id)); });
}
function take(d){
  if (!d || !d.features) return state;
  var changed = JSON.stringify(d.features) !== JSON.stringify(state.features) || !!d.locked !== state.locked;
  state = {features: d.features, preset: d.preset || '', locked: !!d.locked, rev: d.rev == null ? state.rev : d.rev};
  paint();
  if (changed) subs.forEach(function(fn){ try { fn(state); } catch(e){} });
  return state;
}
function local(){ return typeof location !== 'undefined' && !/remote\.html$/.test(location.pathname); }
function load(){
  if (typeof fetch === 'undefined' || !local()) return Promise.resolve(state);
  return fetch('api/app/features', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(take).catch(function(){ return state; });
}
function send(body){
  return fetch('api/app/features', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); })
    .then(take);
}

var API = {
  groups: GROUPS, list: LIST, presets: PRESETS,
  get: function(id){ return byId[id] || null; },
  on: on, allOn: allOn, count: count,
  state: function(){ return state; },
  locked: function(){ return state.locked; },
  load: load,
  take: take,                                       // the phone remote: the switches come with the Studio's answer
  set: function(id, value){ var s = {}; s[id] = !!value; return send({set: s}); },
  preset: function(name){ return send({preset: name}); },
  onChange: function(fn){ subs.push(fn); },
  /* one quiet line: "8 of 12 on · lighter on this PC" */
  summary: function(){ var n = count(); return n + ' of ' + LIST.length + ' on' + (n < LIST.length ? ' · lighter on this PC' : ''); }
};
root.KCFeatures = API;

if (typeof document !== 'undefined'){
  paint();
  load();
  var Store = root.KCStore;
  /* the program says when the switches change (the Command Center, Settings or another window): read them again */
  if (Store && Store.served && Store.ride && local()) Store.ride('ft', function(){ load(); });
  /* going live locks the switches, and off air frees them: read the lock with the state */
  if (Store && Store.subscribe && local()){
    Store.subscribe(function(st){
      var lk = !!(st && st.live && st.live.scene);
      if (state.features && lk !== state.locked){ state.locked = lk; subs.forEach(function(fn){ try { fn(state); } catch(e){} }); }
    });
  }
}
})(typeof window !== 'undefined' ? window : this);
