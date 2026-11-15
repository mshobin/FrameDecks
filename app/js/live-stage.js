/* FrameDecks 26.11.13 - the Live Stage (Mockup B). The picture takes the room (css/theme.css .stage-row); the column
 * beside it (#stage-status) says if all is well (js/stage-status.js), what comes next, and has the one button that
 * matters: Go Live while nothing is on screen, then Next. In Advanced the column also lists the live Frame's
 * questions and scriptures (a dot for what is on screen, Show for the rest) and the Next button carries Up next.
 * It reads what the page already shows (the top bar's Go Live and Next, Up next from js/workspace.js) and presses
 * the same buttons, so every rule (no double takes, the last Frame, a template) stays in one place. No requests. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
function $(id){ return document.getElementById(id); }
var go = $('ls-go'), goT = $('ls-go-t'), goSub = $('ls-go-sub'), list = $('ls-list'), box = $('ls-items');
if (!go || !Store || !SC) return;

/* ---------- the one button ---------- */
function paintGo(){
  var take = $('cb-take'), next = $('lb-next'), st = Store.get();
  var onAir = !!(st && st.live && st.live.scene);
  go.dataset.mode = '';
  if (!onAir){
    var what = ($('cb-take-what') || {}).textContent || '';
    // 26.11.49 a Frame with slides: Go Live reads Present slides, and opens the slides large once it is live
    var sel = window.KCSelFrame ? SC.find(st, window.KCSelFrame()) : null, deck = sel && sel.layers.some(function(l){ return l.kind === 'pdf' && l.visible !== false && l.c && l.c.file; });
    goT.textContent = deck && window.KCSlides ? 'Present slides' : 'Go Live'; goSub.textContent = what.replace(/^●\s*On air:\s*/, '');
    go.disabled = !take || take.disabled; go.classList.add('is-take'); go.classList.remove('is-off');
    go.title = deck ? 'Go Live with this Frame and show its slides large, with big Back and Next (T goes live only)' : 'Go Live: put the selected Frame on screen (T)';
    if (deck && window.KCSlides) go.dataset.mode = 'present';
    return;
  }
  go.classList.remove('is-take');
  go.classList.remove('is-off');
  var up = $('upnext'), name = ($('un-name') || {}).textContent || '', meta = ($('un-meta') || {}).textContent || '';
  if (st && SC.flowDeckHolds && SC.flowDeckHolds(st, 1) && window.KCSlides && KCSlides.nextWhat){   // 26.11.56 slides that are a step: slide by slide, then the next step
    var sdk = st.live.deck, snw = KCSlides.nextWhat(sdk, ''), sfs = SC.liveScene(st), sfl = SC.flowOf(sfs), sat = SC.flowAt(st);
    if (!go.classList.contains('holding')) goT.textContent = snw.label;
    go.classList.remove('is-off'); go.disabled = false; go.dataset.mode = 'deck';
    go.removeAttribute('aria-label'); if (go.getAttribute('aria-describedby') === 'kc-hold-hint') go.removeAttribute('aria-describedby');
    goSub.textContent = 'Slide ' + (sdk.page + 1) + ' of ' + sdk.pages + ' · step ' + (sat + 1) + ' of ' + sfl.length;
    go.title = snw.text + (sat < sfl.length - 1 ? ' (then step ' + (sat + 2) + ': ' + SC.flowLabel(sfs, sat + 1) + ')' : '');
    return;
  }
  if (st && SC.flowCan && SC.flowCan(st, 1)){                 // 26.11.51 the Frame's own order: Next shows its next step first
    var fsc = SC.liveScene(st), fat = SC.flowAt(st) + 1, fl = SC.flowOf(fsc);
    if (!go.classList.contains('holding')) goT.textContent = 'Next step';
    go.classList.remove('is-off'); go.disabled = false; delete go.dataset.mode;
    go.removeAttribute('aria-label'); if (go.getAttribute('aria-describedby') === 'kc-hold-hint') go.removeAttribute('aria-describedby');
    goSub.textContent = SC.flowLabel(fsc, fat) + ' · step ' + (fat + 1) + ' of ' + fl.length;
    go.title = 'Next: step ' + (fat + 1) + ' of this Frame (' + SC.flowLabel(fsc, fat) + ')';
    return;
  }
  var warn = up && !up.hidden && $('un-warn') && $('un-warn').firstChild ? ' · ⚠︎ ' + $('un-warn').firstChild.textContent : '';
  if (!up || up.hidden || !name){
    // 26.11.29 after the last Frame the button goes off air by press and hold (js/off-air.js); 26.11.42 it reads On air
    // and looks on (the owner: Go Live is on by default, the hold only switches it off)
    if (!go.classList.contains('holding')) goT.textContent = 'On air';
    goSub.textContent = 'Last Frame · hold to go off air'; go.disabled = false; go.classList.add('is-off');
    go.title = 'Hold for a second to take everything off screen.';
    go.removeAttribute('aria-label');                          // 26.11.30 (audit M3) its name is what it shows;
    go.setAttribute('aria-describedby', 'kc-hold-hint');       // the hold is its description (js/off-air.js)
    return;
  }
  go.removeAttribute('aria-label');
  if (go.getAttribute('aria-describedby') === 'kc-hold-hint') go.removeAttribute('aria-describedby');
  // 26.11.49 slides on screen: Next plays the next animation or slide first, and says which
  var dk = st.live.deck, nw = dk && window.KCSlides && KCSlides.nextWhat ? KCSlides.nextWhat(dk, name) : null;
  if (nw && nw.kind !== 'end' && nw.kind !== 'none'){
    goT.textContent = nw.label; go.disabled = false; go.dataset.mode = 'deck';
    goSub.textContent = nw.text.replace(/^Next: /, '') + ' · slide ' + (dk.page + 1) + ' of ' + dk.pages;
    go.title = nw.text + ' (then Next goes to “' + name + '”)';
    return;
  }
  goT.textContent = 'Next'; go.disabled = !next || next.disabled;
  if (dk) name = 'Last slide · ' + name;
  goSub.textContent = name + (meta ? ' · ' + meta.split(' · ').pop() : '') + warn;
  go.title = 'Next: ' + name + ' (goes live)';
}
go.addEventListener('click', function(){
  if (go.classList.contains('is-off')) return;                 // 26.11.29 Off air is a hold, never a click
  if (go.dataset.mode === 'deck'){                             // 26.11.49 the next animation or slide: the top bar's ▶
    var sn = document.querySelector('#lb-slides [data-cb="slide"][data-step="1"]'); if (sn) sn.click();
    return;
  }
  var present = go.dataset.mode === 'present';
  var st = Store.get(), b = st && st.live && st.live.scene ? $('lb-next') : $('cb-take');
  if (b && !b.disabled) b.click();
  if (present && window.KCSlides) setTimeout(function(){ if (Store.get().live.deck) KCSlides.open({studio: true, present: true, dock: $('canvas-wrap')}); }, 900);   // 26.11.54 inside the Studio's stage
});

/* ---------- In this Frame (Advanced) ---------- */
var sig = '';
function paintItems(){
  var st = Store.get(), A = window.KCActions;
  var sc = st && SC.find(st, st.live && st.live.scene);
  if (!sc || !A){ box.hidden = true; sig = ''; return; }
  var rows = [];
  ['verse', 'question'].forEach(function(k){
    (A.list(k) || []).forEach(function(it){
      var o = st[k] || {}, on = !!(o.visible && o.itemId === it.id && String(o.text || '').trim());
      rows.push({k: k, it: it, on: on, t: k === 'verse' ? (it.ref || 'Scripture') + (it.version ? ' · ' + it.version : '') : (it.text || 'Question')});
    });
  });
  box.hidden = !rows.length;
  var s = JSON.stringify(rows.map(function(r){ return [r.k, r.it.id, r.on, r.t]; }));
  if (s === sig) return; sig = s;
  list.textContent = '';
  rows.forEach(function(r){
    var li = document.createElement('li'); li.className = r.on ? 'on' : '';
    var dot = document.createElement('i'); dot.className = 'ls-dot'; dot.setAttribute('aria-hidden', 'true');
    var t = document.createElement('span'); t.className = 'ls-t'; t.textContent = r.t; t.title = r.t;
    li.appendChild(dot); li.appendChild(t);
    if (r.on){ var on = document.createElement('span'); on.className = 'ls-on'; on.textContent = 'On screen'; li.appendChild(on); }
    else {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = 'Show';
      b.setAttribute('aria-label', 'Show ' + r.t);
      b.addEventListener('click', function(){ window.KCActions.showItem(r.k, r.it); });
      li.appendChild(b);
    }
    list.appendChild(li);
  });
}

/* ---------- Up next's picture fills the column's width ---------- */
var pic = $('un-pic'), fr = $('un-frame');
function scalePic(){ if (pic && fr && pic.clientWidth) fr.style.transform = 'scale(' + (pic.clientWidth / 1280) + ')'; }
if (window.ResizeObserver && pic) new ResizeObserver(scalePic).observe(pic);

/* ---------- repaint after the page has drawn the same state (one frame later, at most once per frame) ---------- */
var raf = 0;
function later(){ if (!raf) raf = requestAnimationFrame(function(){ raf = 0; paintGo(); paintItems(); scalePic(); }); }
Store.subscribe(later);
var watch = new MutationObserver(later);
['cb-take', 'cb-take-what', 'lb-next', 'upnext'].forEach(function(id){ var e = $(id); if (e) watch.observe(e, {attributes: true, childList: true, subtree: true, characterData: true}); });
window.addEventListener('resize', later);
later();
window.KCLiveStage = {paint: later};
})();
