/* BSF Command Center - BSF Members, Birthdays, Email Preparation, Settings */
(function(){
'use strict';

var M = window.BSFMembers, Store = window.BSFStore, XLSX = window.XLSX;
var $ = function(id){ return document.getElementById(id); };
var PKEY = 'bsf-cc-members-v1';
var ACK_KEY = 'bsf-cc-birthday-ack';

/* ---------- Defaults ---------- */
var DEFAULTS = {
  meetingTitle: 'BSF Meeting',
  yourName: '', yourEmail: '', groupName: 'BSF',
  greeting: 'Hello [Member Name],', groupGreeting: 'Hello everyone,',
  signature: 'Regards,\n[Your Name]\n[Group Name]',
  defaultSubject: 'A note from [Group Name]',
  defaultBody: '[Greeting]\n\n\n\nMay God bless you.\n\n[Signature]',
  separator: ';',
  bdayGreeting: 'Happy Birthday, [Member Name]!',
  bdayMessage: 'May your day be filled with joy, peace, and God’s blessings.',
  bdayLabel: 'Birthday Celebration', bdayNameStyle: 'full', bdayTransition: 'rise', bdayShowCountry: false,
  reminderDays: 14, leap: 'feb28', dateOrder: 'dmy'
};
var FORMATS = {
  plain: null, // uses the default subject/body from Settings
  summary: {
    subject: '[Group Name] Meeting Summary – [Today’s Date]',
    body: '[Greeting]\n\nThank you for participating in our [Group Name] meeting.\n\nHere is the summary of today’s discussion:\n\n[Add summary here]\n\nMay God bless you.\n\n[Signature]'
  },
  join: {
    subject: 'Welcome to [Group Name], [Member Name]!',
    body: '[Greeting]\n\nWelcome to our [Group Name] group. We are happy to have you with us.\n\nWe look forward to learning, growing, and fellowshipping together.\n\nPlease feel free to contact us if you have any questions.\n\nMay God bless you.\n\n[Signature]'
  }
};
var KIND_NAMES = {plain: 'Email', summary: 'Summary Email', join: 'New Joinee Email'};

var data = {members: [], settings: JSON.parse(JSON.stringify(DEFAULTS))};
var storedAt = '';
var ui = {tab: 'overlays', selectedId: null, checked: {}, search: '', country: '', sort: 'name', eSearch: '',
          celebrateId: null, shownBdayId: null, compSource: 'selected'};
var live = null;

/* ---------- Small helpers (all text goes in as text, never as HTML) ---------- */
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){
    var v = attrs[k];
    if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  (kids || []).forEach(function(c){ if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
var toastT;
function toast(msg, bad){
  var t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast'; }, bad ? 4500 : 2600);
}
function byId(id){ for (var i = 0; i < data.members.length; i++) if (data.members[i].id === id) return data.members[i]; return null; }
function copyText(text, what){
  var done = function(){ toast(what + ' copied'); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback(){
    var ta = h('textarea', {style: 'position:fixed;opacity:0'}); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch(e){ toast('Could not copy. Select the text and press Ctrl+C.', true); }
    ta.remove();
  }
}
function download(blob, name){
  var a = h('a', {href: URL.createObjectURL(blob), download: name});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 3000);
}
function stamp(){ var t = M.today(); return t.y + '-' + (t.m < 10 ? '0' : '') + t.m + '-' + (t.d < 10 ? '0' : '') + t.d; }
function commit(fn){ return window.BSFCommit(fn); }
var CAKE = '<svg class="cake" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M4 29h24M6 29V18h20v11M6 23c2.5 2 5 2 7.5 0s5-2 7.5 0 3.5 1.5 5 .5"/><path d="M10 18v-4M16 18v-4M22 18v-4"/></svg>';

/* ---------- Dialog ---------- */
function openDialog(o){
  var d = $('dlg');
  d.className = o.wide ? 'wide' : '';
  $('dlg-title').textContent = o.title;
  var body = $('dlg-body'); body.innerHTML = ''; body.appendChild(o.body);
  var acts = $('dlg-actions'); acts.innerHTML = '';
  (o.actions || []).forEach(function(a){
    var b = h('button', {type: 'button', 'class': 'btn big' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), text: a.label, disabled: !!a.disabled});
    b.addEventListener('click', function(){ if (!(a.onClick && a.onClick(b) === false)) d.close(); });
    acts.appendChild(b); a.el = b;
  });
  d.showModal();
  var f = o.focus || acts.querySelector('.primary') || acts.lastChild;
  if (f) setTimeout(function(){ f.focus(); }, 30);
  return d;
}
function confirmDialog(title, text, okLabel, onOk, danger){
  openDialog({title: title, body: h('p', {'class': 'plain', text: text}), actions: [
    {label: 'Cancel'}, {label: okLabel, primary: !danger, danger: danger, onClick: onOk}
  ]});
}

/* ---------- Private storage (this computer only) ---------- */
function normalizeData(d){
  d = d && typeof d === 'object' ? d : {};
  var s = JSON.parse(JSON.stringify(DEFAULTS));
  if (d.settings && typeof d.settings === 'object') for (var k in s) if (d.settings[k] !== undefined && d.settings[k] !== null) s[k] = typeof s[k] === 'boolean' ? !!d.settings[k] : (typeof s[k] === 'number' ? Number(d.settings[k]) || s[k] : String(d.settings[k]));
  var members = (Array.isArray(d.members) ? d.members : []).filter(function(m){ return m && typeof m === 'object' && M.clean(m.name); }).map(function(m){
    var bd = /^(\d{4}|-)-\d{2}-\d{2}$/.test(m.birthDate || '') && M.parseDate(m.birthDate).ok ? m.birthDate : '';
    return {id: M.clean(m.id, 40) || M.uid(), name: M.clean(m.name, 120), country: M.clean(m.country, 80),
            phone: M.clean(m.phone, 40), email: M.clean(m.email, 160), birthDate: bd};
  });
  return {members: members, settings: s};
}
function loadPrivate(){
  if (Store.served){
    return fetch('api/private', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error(); return r.json(); })
      .then(function(d){ storedAt = d.storedAt || 'the BSF Command Center folder'; return d; });
  }
  storedAt = 'This browser’s own storage on this computer (no-install mode). Other browsers and OBS can’t see it.';
  try { return Promise.resolve(JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch(e){ return Promise.resolve({}); }
}
var saveT, saveChain = Promise.resolve(), loadFailed = false;
function persist(){
  if (loadFailed){ toast('Changes can’t be saved because member data didn’t load. Restart the BSF Command Center and reload this page.', true); return; }
  clearTimeout(saveT);
  saveT = setTimeout(function(){
    var payload = JSON.stringify({members: data.members, settings: data.settings});
    saveChain = saveChain.then(function(){
      if (Store.served){
        return fetch('api/private', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: payload})
          .then(function(r){ if (!r.ok) throw new Error(); });
      }
      localStorage.setItem(PKEY, payload);
    }).catch(function(){ toast('Member data couldn’t be saved. Check that the BSF Command Center window is open.', true); });
  }, 250);
}

/* ---------- Birthdays ---------- */
function bInfo(m){ return m && m.birthDate ? M.birthday(m.birthDate, data.settings.leap) : null; }
function byBirthday(){
  return data.members.map(function(m){ return {m: m, b: bInfo(m)}; }).filter(function(x){ return x.b; })
    .sort(function(a, b){ return a.b.days - b.b.days || a.m.name.localeCompare(b.m.name); });
}
function windowList(){ var n = Number(data.settings.reminderDays) || 14; return byBirthday().filter(function(x){ return x.b.days <= n; }); }
function acks(){ try { return JSON.parse(sessionStorage.getItem(ACK_KEY) || '[]'); } catch(e){ return []; } }
function ackKey(x){ return x.m.id + '|' + x.b.nextLabel; }
function isAcked(x){ return acks().indexOf(ackKey(x)) >= 0; }
function ack(list){
  var a = acks(); list.forEach(function(x){ if (a.indexOf(ackKey(x)) < 0) a.push(ackKey(x)); });
  try { sessionStorage.setItem(ACK_KEY, JSON.stringify(a)); } catch(e){}
}
function whenText(b){ return b.days === 0 ? 'Today' : b.days === 1 ? 'Tomorrow' : 'In ' + b.days + ' days'; }
function turningText(b){ return b.turning ? (b.days === 0 ? 'Turns ' + b.turning + ' today' : 'Turns ' + b.turning) : ''; }

/* ---------- Tabs ---------- */
var TABS = ['meeting', 'overlays', 'members', 'birthdays', 'email', 'settings'];
function setTab(t){
  ui.tab = t; document.body.dataset.tab = t;
  TABS.forEach(function(k){
    $('tabbtn-' + k).setAttribute('aria-selected', String(k === t));
    $('tab-' + k).hidden = k !== t;
  });
  if (t === 'members'){ $('slot-members').appendChild(composerEl); if (ui.compSource === 'ticked' && !anyChecked()) ui.compSource = 'selected'; }
  if (t === 'email'){ $('slot-email').appendChild(composerEl); ui.compSource = 'ticked'; renderPicker(); }
  if (t === 'birthdays') renderBirthdays();
  if (t === 'settings') renderSettings();
  renderComposer();
  if (window.BSFOnTab) window.BSFOnTab(t);
}
window.BSFSetTab = function(t){ setTab(t); };

/* ---------- Header chips, reminder banner ---------- */
function renderStatus(){
  var n = Number(data.settings.reminderDays) || 14;
  var w = windowList(), today = w.filter(function(x){ return x.b.days === 0; });
  $('chip-members').querySelector('b').textContent = data.members.length;
  $('chip-today').querySelector('b').textContent = today.length;
  $('chip-today').classList.toggle('hot', today.length > 0);
  $('chip-upcoming').firstChild.nodeValue = 'Next ' + n + ' days: ';
  $('chip-upcoming').querySelector('b').textContent = w.length - today.length;
  var badge = $('tab-bday-badge'); badge.hidden = !today.length; badge.textContent = today.length;

  var r = $('bday-reminder'), open = w.filter(function(x){ return !isAcked(x); });
  if (!open.length){ r.hidden = true; return; }
  r.hidden = false; r.innerHTML = CAKE;
  var tOpen = open.filter(function(x){ return x.b.days === 0; }), uOpen = open.filter(function(x){ return x.b.days > 0; });
  var txt = h('div', {'class': 'rtext'});
  if (tOpen.length){
    txt.appendChild(document.createTextNode(tOpen.length === 1 ? 'Birthday today: ' : 'Birthdays today: '));
    txt.appendChild(h('b', {text: tOpen.map(function(x){ return x.m.name; }).join(', ')}));
    if (uOpen.length) txt.appendChild(document.createTextNode('  ·  '));
  }
  if (uOpen.length){
    txt.appendChild(document.createTextNode('Coming up: '));
    txt.appendChild(h('b', {text: uOpen[0].m.name}));
    txt.appendChild(document.createTextNode(' (' + whenText(uOpen[0].b).toLowerCase() + ')' + (uOpen.length > 1 ? ' and ' + (uOpen.length - 1) + ' more in the next ' + n + ' days' : '')));
  }
  r.appendChild(txt);
  r.appendChild(h('button', {'class': 'btn small', type: 'button', text: 'View birthdays', onclick: function(){ setTab('birthdays'); }}));
  if (tOpen.length) r.appendChild(h('button', {'class': 'btn primary small', type: 'button', text: 'Celebrate ' + tOpen[0].m.name.split(/\s+/)[0],
    onclick: function(){ ui.celebrateId = tOpen[0].m.id; renderBar(); showBirthday(); }}));
  r.appendChild(h('button', {'class': 'btn quiet small', type: 'button', text: 'Dismiss for this session',
    onclick: function(){ ack(w); renderStatus(); renderBirthdays(); toast('Reminder dismissed until you reopen the dashboard'); }}));
}

/* ---------- Members list ---------- */
function filtered(){
  var q = ui.search.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  var list = data.members.filter(function(m){
    if (ui.country && m.country !== ui.country) return false;
    if (!q) return true;
    if ((m.name + ' ' + m.country + ' ' + m.email + ' ' + m.phone).toLowerCase().indexOf(q) >= 0) return true;
    return qd.length >= 3 && m.phone.replace(/\D/g, '').indexOf(qd) >= 0;
  });
  var key = {
    'name': function(a, b){ return a.name.localeCompare(b.name); },
    'name-desc': function(a, b){ return b.name.localeCompare(a.name); },
    'next': function(a, b){ var x = bInfo(a), y = bInfo(b); return (x ? x.days : 1e9) - (y ? y.days : 1e9) || a.name.localeCompare(b.name); },
    'calendar': function(a, b){ var x = bInfo(a), y = bInfo(b); return (x ? x.sortKey : 1e9) - (y ? y.sortKey : 1e9) || a.name.localeCompare(b.name); },
    'oldest': function(a, b){ var x = a.birthDate.charAt(0) === '-' || !a.birthDate ? 'z' : a.birthDate, y = b.birthDate.charAt(0) === '-' || !b.birthDate ? 'z' : b.birthDate; return x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name); }
  }[ui.sort];
  return list.sort(key);
}
function anyChecked(){ for (var k in ui.checked) if (ui.checked[k] && byId(k)) return true; return false; }
function checkedMembers(){ return data.members.filter(function(m){ return ui.checked[m.id]; }); }
function birthdayBadge(m){
  var b = bInfo(m); if (!b) return null;
  if (b.days === 0) return h('span', {'class': 'badge today', text: 'Birthday today'});
  if (b.days <= (Number(data.settings.reminderDays) || 14)) return h('span', {'class': 'badge soon', text: whenText(b)});
  return null;
}
function renderCountries(){
  var sel = $('m-country'), cur = ui.country, seen = {};
  data.members.forEach(function(m){ if (m.country) seen[m.country] = (seen[m.country] || 0) + 1; });
  sel.innerHTML = '';
  sel.appendChild(h('option', {value: '', text: 'All countries'}));
  Object.keys(seen).sort().forEach(function(c){ sel.appendChild(h('option', {value: c, text: c + ' (' + seen[c] + ')'})); });
  if (cur && !seen[cur]) ui.country = '';
  sel.value = ui.country;
}
function renderList(){
  var list = filtered(), ul = $('m-items');
  $('m-count').textContent = data.members.length;
  ul.setAttribute('data-empty', data.members.length ? 'No members match your search.' : 'No members yet. Select Import Excel or Add member to get started.');
  ul.innerHTML = '';
  list.forEach(function(m){
    var ph = M.parsePhone(m.phone);
    var cb = h('input', {type: 'checkbox', 'aria-label': 'Tick ' + m.name, onclick: function(e){ e.stopPropagation(); }, onchange: function(){
      if (cb.checked) ui.checked[m.id] = true; else delete ui.checked[m.id];
      renderSelbar(); renderComposer(); renderPicker();
    }});
    cb.checked = !!ui.checked[m.id];
    var flags = h('span', {'class': 'm-flags'}, [birthdayBadge(m),
      (!ph.empty && !ph.intl) ? h('span', {'class': 'badge warn', title: 'Phone number has no country code', text: 'No code'}) : null]);
    var li = h('li', {'class': 'm-item', role: 'option', tabindex: '0', 'data-id': m.id, 'aria-selected': String(m.id === ui.selectedId)}, [
      cb,
      h('span', {}, [h('span', {'class': 'm-name', text: m.name}),
        h('span', {'class': 'm-sub', text: [m.country, m.phone || m.email].filter(Boolean).join(' · ') || 'No contact details'})]),
      flags
    ]);
    li.addEventListener('click', function(){ select(m.id); });
    li.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        e.preventDefault();
        var sib = e.key === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling;
        if (sib){ sib.focus(); select(sib.dataset.id, true); }
      } else if (e.key === 'Enter'){ select(m.id); }
      else if (e.key === ' '){ e.preventDefault(); cb.click(); }
    });
    ul.appendChild(li);
  });
  renderSelbar();
}
function renderSelbar(){
  var bar = $('m-selbar'), n = checkedMembers().length;
  bar.innerHTML = '';
  if (!n){ bar.appendChild(document.createTextNode('Tick members to email several people at once.')); return; }
  bar.appendChild(h('b', {text: n + ' ticked'}));
  bar.appendChild(h('button', {'class': 'btn small primary', type: 'button', text: 'Prepare group email', onclick: function(){
    ui.compSource = 'ticked'; renderComposer(); composerEl.scrollIntoView({behavior: 'smooth', block: 'start'}); }}));
  bar.appendChild(h('button', {'class': 'btn quiet small', type: 'button', text: 'Untick all', onclick: function(){
    ui.checked = {}; renderList(); renderComposer(); renderPicker(); }}));
}
function select(id, keepFocus){
  ui.selectedId = id;
  Array.prototype.forEach.call($('m-items').children, function(li){ li.setAttribute('aria-selected', String(li.dataset.id === id)); });
  if (ui.tab === 'members') ui.compSource = 'selected';
  renderDetail(); renderComposer();
}

/* ---------- Member details card ---------- */
function renderDetail(){
  var box = $('m-detail'), m = byId(ui.selectedId);
  box.innerHTML = '';
  if (!m){
    box.appendChild(h('div', {'class': 'empty-card', text: data.members.length ? 'Select a member to see their details.' : 'Your member list is empty. Import an Excel file or add a member.'}));
    return;
  }
  var ph = M.parsePhone(m.phone), b = bInfo(m);
  var card = h('div', {'class': 'mcard'});
  card.appendChild(h('div', {'class': 'mcard-top'}, [
    h('div', {style: 'flex:1;min-width:0'}, [h('h3', {text: m.name}), m.country ? h('div', {'class': 'country', text: m.country}) : null]),
    h('button', {'class': 'btn small', type: 'button', text: 'Edit', onclick: function(){ editMember(m); }}),
    h('button', {'class': 'btn small danger', type: 'button', text: 'Delete', onclick: function(){ deleteMember(m); }})
  ]));
  card.appendChild(h('div', {'class': 'rule'}));

  // Phone
  var phoneV = h('div', {'class': 'v'});
  if (ph.empty) phoneV.appendChild(h('span', {'class': 'fhint', text: 'No phone number'}));
  else {
    phoneV.appendChild(document.createTextNode(m.phone));
    var btns = h('div', {'class': 'btns'});
    if (ph.intl) btns.appendChild(h('a', {'class': 'btn wa', href: M.whatsappUrl(m.phone), target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp'}));
    else btns.appendChild(h('button', {'class': 'btn', type: 'button', disabled: true, title: 'Add a country code first', text: 'WhatsApp'}));
    var tel = M.telUrl(m.phone);
    if (tel) btns.appendChild(h('a', {'class': 'btn', href: tel, text: 'Call'}));
    phoneV.appendChild(btns);
    if (ph.invalid) phoneV.appendChild(h('div', {'class': 'warnbox', text: 'This phone number doesn’t look valid. Select Edit to correct it.'}));
    else if (!ph.intl) phoneV.appendChild(countryCodeFixer(m));
  }
  card.appendChild(h('div', {'class': 'mrow'}, [h('span', {'class': 'k', text: 'Phone'}), phoneV]));

  // Email
  var emailV = h('div', {'class': 'v'});
  if (!m.email) emailV.appendChild(h('span', {'class': 'fhint', text: 'No email address'}));
  else if (!M.validEmail(m.email)) emailV.appendChild(h('span', {'class': 'fhint bad', text: m.email + ' (not a valid address)'}));
  else {
    emailV.appendChild(h('a', {href: M.mailto({to: [m.email]}), text: m.email}));
    emailV.appendChild(h('div', {'class': 'btns'}, [h('button', {'class': 'btn', type: 'button', text: 'Email', onclick: function(){ prepareFor(m, 'plain'); }})]));
  }
  card.appendChild(h('div', {'class': 'mrow'}, [h('span', {'class': 'k', text: 'Email'}), emailV]));

  // Birthday
  var bdV = h('div', {'class': 'v'});
  if (!b) bdV.appendChild(h('span', {'class': 'fhint', text: 'No birth date'}));
  else {
    bdV.appendChild(h('div', {'class': 'bday-line'}, [M.formatDate(m.birthDate), b.leapDay ? h('span', {'class': 'badge', text: 'Leap-day birthday'}) : null]));
    var stats = h('div', {'class': 'stats'});
    stats.appendChild(h('div', {'class': 'stat gold'}, [h('b', {text: b.days === 0 ? 'Today!' : String(b.days)}), h('span', {text: b.days === 0 ? 'Happy birthday' : b.days === 1 ? 'day to go' : 'days to go'})]));
    stats.appendChild(h('div', {'class': 'stat'}, [h('b', {text: b.age !== null ? String(b.age) : '—'}), h('span', {text: b.age !== null ? 'Age' : 'Age unknown'})]));
    stats.appendChild(h('div', {'class': 'stat'}, [h('b', {text: b.next.d + ' ' + M.MONTH_NAMES[b.next.m - 1].slice(0, 3)}), h('span', {text: 'Next birthday'})]));
    bdV.appendChild(stats);
    bdV.appendChild(h('div', {'class': 'fhint' + (b.days <= (Number(data.settings.reminderDays) || 14) ? ' warn' : ''), style: 'margin-top:8px',
      text: b.status + (b.turning ? ' · turns ' + b.turning : '') + (b.leapDay && b.next.d !== 29 ? ' · celebrated on ' + b.next.d + ' ' + M.MONTH_NAMES[b.next.m - 1] + ' this year' : '')}));
  }
  card.appendChild(h('div', {'class': 'mrow'}, [h('span', {'class': 'k', text: 'Birthday'}), bdV]));
  card.appendChild(h('div', {'class': 'rule'}));
  var hasEmail = M.validEmail(m.email);
  card.appendChild(h('div', {'class': 'actions'}, [
    h('button', {'class': 'btn', type: 'button', text: 'Prepare Email', disabled: !hasEmail, onclick: function(){ prepareFor(m, 'plain'); }}),
    h('button', {'class': 'btn', type: 'button', text: 'Prepare Summary Email', disabled: !hasEmail, onclick: function(){ prepareFor(m, 'summary'); }}),
    h('button', {'class': 'btn', type: 'button', text: 'Prepare New Joinee Email', disabled: !hasEmail, onclick: function(){ prepareFor(m, 'join'); }})
  ]));
  card.appendChild(h('div', {'class': 'actions', style: 'margin-top:10px'}, [
    h('button', {'class': 'btn primary', type: 'button', text: 'Celebrate on screen', title: 'Show the birthday overlay for this member',
      onclick: function(){ ui.celebrateId = m.id; renderBar(); showBirthday(); }})
  ]));
  box.appendChild(card);
}
function countryCodeFixer(m){
  var sug = M.countryCode(m.country);
  var sel = h('select', {'aria-label': 'Country code'});
  sel.appendChild(h('option', {value: '', text: 'Choose a country code…'}));
  M.countryList.forEach(function(c){ sel.appendChild(h('option', {value: c.code, text: c.name + ' (+' + c.code + ')'})); });
  if (sug){ for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === sug && sel.options[i].text.toLowerCase().indexOf(m.country.toLowerCase()) === 0){ sel.selectedIndex = i; break; } }
  var addBtn = h('button', {'class': 'btn small', type: 'button', text: 'Add code', onclick: function(){
    var code = sel.value; if (!code){ toast('Choose a country code first.', true); return; }
    var next = M.withCountryCode(m.phone, code);
    confirmDialog('Add country code?', 'Change ' + m.name + '’s phone number from “' + m.phone + '” to “' + next + '”?', 'Change number', function(){
      m.phone = next; persist(); renderAll(); toast('Phone number updated');
    });
  }});
  return h('div', {'class': 'warnbox'}, [
    h('b', {text: 'No country code. '}),
    document.createTextNode(sug ? m.country + ' uses +' + sug + '. Please confirm before WhatsApp can be used.' : 'Choose the right code so WhatsApp can open this number.'),
    h('div', {'class': 'fix'}, [sel, addBtn])
  ]);
}

/* ---------- Add / edit / delete ---------- */
function editMember(m){
  var isNew = !m;
  m = m || {name: '', country: '', phone: '', email: '', birthDate: ''};
  var f = {};
  function field(key, label, placeholder, list){
    var input = h('input', {type: 'text', value: key === 'birthDate' ? (m.birthDate ? M.formatDate(m.birthDate) : '') : m[key], placeholder: placeholder || '', list: list || null, autocomplete: 'off'});
    var hint = h('div', {'class': 'fhint'});
    f[key] = {input: input, hint: hint};
    input.addEventListener('input', check);
    return h('label', {'class': 'field'}, [h('span', {text: label}), input, hint]);
  }
  var dl = h('datalist', {id: 'dl-countries'});
  M.countryList.forEach(function(c){ dl.appendChild(h('option', {value: c.name})); });
  var codeBtn = h('button', {'class': 'btn small', type: 'button', hidden: true, onclick: function(){
    f.phone.input.value = M.withCountryCode(f.phone.input.value, codeBtn.dataset.code); check(); }});
  var body = h('div', {}, [
    field('name', 'Name (required)', 'e.g. Grace Mensah'),
    field('country', 'Country', 'e.g. Kuwait', 'dl-countries'), dl,
    field('phone', 'Phone Number (with country code, e.g. +965 5000 1234)', '+965 5000 1234'), codeBtn,
    field('email', 'Email', 'name@example.com'),
    field('birthDate', 'Birth Date (YYYY-MM-DD, e.g. 1985-03-15; the year is optional)', '1985-03-15')
  ]);
  function check(){
    var r = M.checkMember({name: f.name.input.value, country: f.country.input.value, phone: f.phone.input.value,
      email: f.email.input.value, birthDate: f.birthDate.input.value}, data.settings.dateOrder);
    var ph = M.parsePhone(f.phone.input.value);
    f.name.hint.textContent = r.member.name ? '' : 'Name is required'; f.name.hint.className = 'fhint' + (r.member.name ? '' : ' bad');
    f.email.hint.textContent = !r.member.email ? '' : M.validEmail(r.member.email) ? '' : 'This email address isn’t valid';
    f.email.hint.className = 'fhint bad';
    if (ph.empty){ f.phone.hint.textContent = ''; }
    else if (ph.invalid){ f.phone.hint.textContent = 'This doesn’t look like a phone number'; f.phone.hint.className = 'fhint bad'; }
    else if (!ph.intl){ f.phone.hint.textContent = 'No country code. WhatsApp needs one, for example +965.'; f.phone.hint.className = 'fhint warn'; }
    else { f.phone.hint.textContent = 'WhatsApp ready: ' + ph.e164 + (ph.note ? ' (' + ph.note + ')' : ''); f.phone.hint.className = 'fhint ok'; }
    var sug = M.countryCode(f.country.input.value);
    codeBtn.hidden = !(sug && !ph.empty && !ph.intl && !ph.invalid);
    if (sug){ codeBtn.dataset.code = sug; codeBtn.textContent = 'Add +' + sug + ' (' + f.country.input.value.trim() + ')'; }
    var bd = M.parseDate(f.birthDate.input.value, data.settings.dateOrder);
    if (!f.birthDate.input.value.trim()){ f.birthDate.hint.textContent = ''; }
    else if (!bd.ok){ f.birthDate.hint.textContent = bd.error; f.birthDate.hint.className = 'fhint bad'; }
    else { f.birthDate.hint.textContent = 'Read as ' + M.formatDate(bd.iso) + (bd.note ? ' (' + bd.note.toLowerCase() + ')' : ''); f.birthDate.hint.className = 'fhint ok'; }
    return r;
  }
  openDialog({title: isNew ? 'Add member' : 'Edit member', body: body, focus: f.name.input, actions: [
    {label: 'Cancel'},
    {label: isNew ? 'Add member' : 'Save changes', primary: true, onClick: function(){
      var r = check();
      if (r.errors.length){ toast(r.errors[0], true); return false; }
      if (isNew){ r.member.id = M.uid(); data.members.push(r.member); }
      else { r.member.id = m.id; var i = data.members.indexOf(m); if (i >= 0) data.members[i] = r.member; }
      ui.selectedId = r.member.id;
      persist(); renderAll();
      toast(isNew ? r.member.name + ' added' : 'Changes saved');
    }}
  ]});
  check();
}
function deleteMember(m){
  confirmDialog('Delete member?', 'Delete ' + m.name + ' from your member list? This can’t be undone. (Export a backup first if you might need it.)', 'Delete member', function(){
    data.members = data.members.filter(function(x){ return x.id !== m.id; });
    delete ui.checked[m.id];
    if (ui.selectedId === m.id) ui.selectedId = null;
    if (ui.celebrateId === m.id) ui.celebrateId = null;
    persist(); renderAll(); toast(m.name + ' deleted');
  }, true);
}

/* ---------- Excel import ---------- */
function dateCode(v){
  if (typeof v !== 'number' || v < 1 || v > 80000) return null;
  var d = XLSX.SSF.parse_date_code(v);
  return d && d.y ? {y: d.y, m: d.m, d: d.d} : null;
}
function readFile(file){
  if (!XLSX){ toast('The Excel reader is missing (vendor/xlsx.full.min.js).', true); return; }
  if (file.size > 10 * 1024 * 1024){ toast('That file is larger than 10 MB. Please use a smaller file.', true); return; }
  var reader = new FileReader();
  reader.onerror = function(){ toast('That file couldn’t be read.', true); };
  reader.onload = function(){
    var wb;
    try { wb = XLSX.read(new Uint8Array(reader.result), {type: 'array', raw: true, cellFormula: false, cellHTML: false, sheetStubs: false}); }
    catch(e){ toast('That file isn’t a readable Excel or CSV file.', true); return; }
    analyse(wb, file.name);
  };
  reader.readAsArrayBuffer(file);
}
function analyse(wb, fileName){
  var found = null;
  for (var s = 0; s < wb.SheetNames.length && !found; s++){
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[s]], {header: 1, raw: true, defval: '', blankrows: false});
    for (var r = 0; r < Math.min(rows.length, 10); r++){
      var map = {};
      (rows[r] || []).forEach(function(cell, i){ var n = M.headerName(cell); if (n && map[n] === undefined) map[n] = i; });
      if (map['Name'] !== undefined){ found = {rows: rows, headerRow: r, map: map, sheet: wb.SheetNames[s]}; break; }
    }
  }
  var missing = found ? M.COLUMNS.filter(function(c){ return found.map[c] === undefined; }) : M.COLUMNS.slice();
  if (missing.length){
    openDialog({title: 'Some columns are missing', body: h('div', {}, [
      h('p', {'class': 'plain', text: '“' + fileName + '” is missing ' + (missing.length === 1 ? 'this column' : 'these columns') + ':'}),
      h('p', {'class': 'plain'}, [h('b', {text: missing.join(', ')})]),
      h('p', {'class': 'plain', text: 'The first row of the sheet must contain these column names: ' + M.COLUMNS.join(' | ') + '. Download the template to see the exact layout.'})
    ]), actions: [{label: 'Download template', onClick: function(){ downloadTemplate(); }}, {label: 'OK', primary: true}]});
    return;
  }
  var results = [], seen = {};
  var body = found.rows.slice(found.headerRow + 1, found.headerRow + 1 + 5000);
  body.forEach(function(row, i){
    var get = function(c){ return row[found.map[c]]; };
    if (M.COLUMNS.every(function(c){ var v = get(c); return v === '' || v === null || v === undefined; })) return;
    var bdRaw = get('Birth Date');
    var r = M.checkMember({name: get('Name'), country: get('Country'), phone: typeof get('Phone Number') === 'number' ? String(get('Phone Number')) : get('Phone Number'),
      email: get('Email'), birthDate: bdRaw}, data.settings.dateOrder, dateCode);
    r.rowNum = found.headerRow + i + 2;
    var key = matchKey(r.member);
    if (key && seen[key]) r.warnings.push('Appears twice in this file');
    if (key) seen[key] = true;
    results.push(r);
  });
  if (found.rows.length - found.headerRow - 1 > 5000) toast('Only the first 5,000 rows were read.', true);
  showPreview(results, fileName);
}
function matchKey(m){
  if (m.email) return 'e:' + m.email.toLowerCase();
  if (m.name) return 'n:' + m.name.toLowerCase() + '|' + m.phone.replace(/\D/g, '');
  return '';
}
function showPreview(results, fileName){
  var ok = results.filter(function(r){ return !r.errors.length; });
  var warn = ok.filter(function(r){ return r.warnings.length || r.notes.length; });
  var bad = results.filter(function(r){ return r.errors.length; });
  var existing = {}; data.members.forEach(function(m){ existing[matchKey(m)] = m; });
  var updates = ok.filter(function(r){ return existing[matchKey(r.member)]; }).length;
  var mode = 'merge';

  var table = h('table', {'class': 'imp'});
  table.appendChild(h('thead', {}, [h('tr', {}, ['Row', 'Status', 'Name', 'Country', 'Phone Number', 'Email', 'Birth Date', 'Notes'].map(function(t){ return h('th', {text: t}); }))]));
  var tb = h('tbody');
  results.forEach(function(r){
    var st = r.errors.length ? ['err', 'Will be skipped'] : (r.warnings.length ? ['warn', 'Check'] : ['ok', 'Ready']);
    tb.appendChild(h('tr', {'class': r.errors.length ? 'err' : ''}, [
      h('td', {text: String(r.rowNum)}), h('td', {'class': 'st ' + st[0], text: st[1]}),
      h('td', {text: r.member.name || '—'}), h('td', {text: r.member.country}), h('td', {text: r.member.phone}),
      h('td', {text: r.member.email}), h('td', {text: r.member.birthDate ? M.formatDate(r.member.birthDate) : ''}),
      h('td', {'class': 'issues', text: r.errors.concat(r.warnings, r.notes).join('; ')})
    ]));
  });
  table.appendChild(tb);
  var radios = h('div', {}, [
    h('label', {'class': 'radio'}, [h('input', {type: 'radio', name: 'impmode', value: 'merge', checked: true, onchange: function(){ mode = 'merge'; label(); }}),
      h('span', {text: 'Add to my current list (members with the same email, or the same name and phone, are updated)'})]),
    h('label', {'class': 'radio'}, [h('input', {type: 'radio', name: 'impmode', value: 'replace', onchange: function(){ mode = 'replace'; label(); }}),
      h('span', {text: 'Replace my whole member list with this file (' + data.members.length + ' current members will be removed)'})])
  ]);
  var body = h('div', {}, [
    h('div', {'class': 'imp-sum'}, [
      h('span', {'class': 'badge', text: results.length + ' rows read'}),
      h('span', {'class': 'badge', style: 'color:var(--on);border-color:rgba(127,209,160,.5)', text: ok.length + ' ready to import'}),
      warn.length ? h('span', {'class': 'badge soon', text: warn.length + ' with notes to check'}) : null,
      bad.length ? h('span', {'class': 'badge warn', text: bad.length + ' with errors (skipped)'}) : null,
      updates ? h('span', {'class': 'badge', text: updates + ' match existing members'}) : null
    ]),
    radios,
    h('p', {'class': 'fhint', text: 'Nothing is saved until you confirm. Rows with errors are skipped; fix them in Excel and import again, or add them by hand.'}),
    h('div', {'class': 'imp-table-wrap'}, [table])
  ]);
  var actions = [{label: 'Cancel'}, {label: '', primary: true, disabled: !ok.length, onClick: function(){
    if (mode === 'replace') data.members = [];
    var idx = {}; data.members.forEach(function(m, i){ idx[matchKey(m)] = i; });
    var added = 0, updated = 0;
    ok.forEach(function(r){
      var k = matchKey(r.member);
      if (idx[k] !== undefined){ r.member.id = data.members[idx[k]].id; data.members[idx[k]] = r.member; updated++; }
      else { idx[k] = data.members.length; data.members.push(r.member); added++; }
    });
    if (mode === 'replace'){ ui.checked = {}; ui.selectedId = null; ui.celebrateId = null; }
    persist(); renderAll();
    toast('Imported: ' + added + ' added' + (updated ? ', ' + updated + ' updated' : '') + (bad.length ? ', ' + bad.length + ' skipped' : ''));
  }}];
  function label(){ actions[1].el.textContent = (mode === 'replace' ? 'Replace list with ' : 'Import ') + ok.length + (ok.length === 1 ? ' member' : ' members'); }
  openDialog({title: 'Check the import: ' + fileName, wide: true, body: body, actions: actions});
  label();
}

/* ---------- Excel / CSV export and template ---------- */
function memberRows(){
  return data.members.slice().sort(function(a, b){ return a.name.localeCompare(b.name); })
    .map(function(m){ return [m.name, m.country, m.phone, m.email, m.birthDate]; });
}
function sheetFrom(rows){
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch: 28}, {wch: 18}, {wch: 20}, {wch: 30}, {wch: 14}];
  return ws;
}
function exportXlsx(){
  if (!data.members.length){ toast('There are no members to export.', true); return; }
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom([M.COLUMNS].concat(memberRows())), 'Members');
  XLSX.writeFile(wb, 'BSF-Members-' + stamp() + '.xlsx');
  toast('Exported ' + data.members.length + ' members to Excel (saved to Downloads)');
}
function exportCsv(){
  if (!data.members.length){ toast('There are no members to export.', true); return; }
  download(new Blob([M.toCsv(M.COLUMNS, memberRows(), 2)], {type: 'text/csv;charset=utf-8'}), 'BSF-Members-' + stamp() + '.csv');
  toast('Exported ' + data.members.length + ' members to CSV (saved to Downloads)');
}
function downloadTemplate(){
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom([M.COLUMNS,
    ['Grace Mensah', 'Ghana', '+233 20 000 0001', 'grace@example.com', '1985-03-15'],
    ['Daniel Okafor', 'Nigeria', '+234 800 000 0002', 'daniel@example.com', '1990-11-02'],
    ['Priya Nair', 'India', '+91 90000 00003', 'priya@example.com', '--07-21']]), 'Members');
  var info = XLSX.utils.aoa_to_sheet([
    ['BSF Members template - how to fill it in'], [''],
    ['Keep the first row of the Members sheet exactly as it is:  Name | Country | Phone Number | Email | Birth Date'],
    ['Replace the example rows with your members (one member per row).'], [''],
    ['Name', 'Required.'],
    ['Country', 'For example Kuwait, India, United Kingdom.'],
    ['Phone Number', 'Include the country code with +, for example +965 5000 1234. Numbers without a code are imported, but flagged so you can add the code.'],
    ['Email', 'For example name@example.com.'],
    ['Birth Date', 'Use YYYY-MM-DD, for example 1985-03-15. Excel date cells also work. If you don’t know the year, write --MM-DD, e.g. --07-21.'],
    [''], ['Tip', 'Format the Phone Number column as Text in Excel so the + and leading zeros are kept.']
  ]);
  info['!cols'] = [{wch: 16}, {wch: 110}];
  XLSX.utils.book_append_sheet(wb, info, 'Instructions');
  XLSX.writeFile(wb, 'BSF-Members-Template.xlsx');
  toast('Template saved to your Downloads folder');
}

/* ---------- Email composer ---------- */
var composerEl, comp = {kind: null, forKey: '', bcc: true};
function compRecipients(){
  if (ui.compSource === 'ticked') return checkedMembers();
  var m = byId(ui.selectedId); return m ? [m] : [];
}
function recipKey(list){ return list.map(function(m){ return m.id; }).sort().join(','); }
function buildComposer(){
  composerEl = h('section', {'class': 'box composer', 'aria-labelledby': 'comp-title'});
  composerEl.innerHTML =
    '<div class="box-head"><h2 id="comp-title">Email preparation</h2></div>' +
    '<div class="recips" id="c-recips"></div>' +
    '<div class="comp-kinds">' +
      '<button class="btn" type="button" data-kind="plain">Prepare Email</button>' +
      '<button class="btn" type="button" data-kind="summary">Prepare Summary Email</button>' +
      '<button class="btn" type="button" data-kind="join">Prepare New Joinee Email</button></div>' +
    '<div id="c-alerts"></div>' +
    '<label class="field"><span>Subject</span><input type="text" id="c-subject"></label>' +
    '<label class="field"><span>Message (edit anything before opening)</span><textarea id="c-body" rows="12"></textarea></label>' +
    '<h3>Preview</h3><div class="preview-mail" id="c-preview"></div>' +
    '<div class="comp-actions">' +
      '<button class="btn primary big" type="button" id="c-open">Open in Outlook / email app</button>' +
      '<button class="btn" type="button" id="c-copy-subject">Copy subject</button>' +
      '<button class="btn" type="button" id="c-copy-body">Copy message</button>' +
      '<button class="btn" type="button" id="c-copy-addr">Copy addresses</button></div>' +
    '<p class="hint">Nothing is sent automatically. Your email app opens a draft so you can review it and press Send yourself.</p>';
  composerEl.querySelector('.comp-kinds').addEventListener('click', function(e){
    var b = e.target.closest('[data-kind]'); if (b) prepare(b.dataset.kind);
  });
  composerEl.querySelector('#c-subject').addEventListener('input', renderPreview);
  composerEl.querySelector('#c-body').addEventListener('input', renderPreview);
  composerEl.querySelector('#c-open').addEventListener('click', openEmail);
  composerEl.querySelector('#c-copy-subject').addEventListener('click', function(){ copyText(composerEl.querySelector('#c-subject').value, 'Subject'); });
  composerEl.querySelector('#c-copy-body').addEventListener('click', function(){ copyText(composerEl.querySelector('#c-body').value, 'Message'); });
  composerEl.querySelector('#c-copy-addr').addEventListener('click', function(){
    var a = addresses(); var all = a.to.concat(a.bcc);
    if (!all.length){ toast('No valid email addresses to copy.', true); return; }
    copyText(all.join(data.settings.separator === ',' ? ', ' : '; '), 'Addresses');
  });
  $('slot-members').appendChild(composerEl);
}
function addresses(){
  var list = compRecipients(), valid = list.filter(function(m){ return M.validEmail(m.email); });
  var emails = valid.map(function(m){ return m.email; });
  var group = ui.compSource === 'ticked' && list.length > 1;
  if (!group) return {to: emails, bcc: [], group: false, valid: valid, list: list};
  if (comp.bcc) return {to: M.validEmail(data.settings.yourEmail) ? [data.settings.yourEmail] : [], bcc: emails, group: true, valid: valid, list: list};
  return {to: emails, bcc: [], group: true, valid: valid, list: list};
}
function renderComposer(){
  if (!composerEl) return;
  var list = compRecipients(), box = composerEl.querySelector('#c-recips');
  box.innerHTML = '';
  var sel = byId(ui.selectedId), nTicked = checkedMembers().length;
  var src = h('div', {'class': 'rl'});
  if (ui.tab !== 'email'){
    src.appendChild(h('label', {'class': 'radio', style: 'display:inline-flex;margin:0 14px 0 0'}, [
      h('input', {type: 'radio', name: 'csrc', checked: ui.compSource === 'selected', onchange: function(){ ui.compSource = 'selected'; renderComposer(); }}),
      h('span', {text: 'Selected member' + (sel ? ' (' + sel.name + ')' : '')})]));
    src.appendChild(h('label', {'class': 'radio', style: 'display:inline-flex;margin:0'}, [
      h('input', {type: 'radio', name: 'csrc', checked: ui.compSource === 'ticked', disabled: !nTicked, onchange: function(){ ui.compSource = 'ticked'; renderComposer(); }}),
      h('span', {text: 'Ticked members (' + nTicked + ')'})]));
  } else src.textContent = list.length > 1 ? 'Group email to ' + list.length + ' members' : 'Recipient';
  box.appendChild(src);
  var chips = h('div', {'class': 'list'});
  if (!list.length) chips.appendChild(h('span', {'class': 'fhint', text: ui.compSource === 'ticked' ? 'Tick one or more members.' : 'Select a member first.'}));
  list.forEach(function(m){
    var ok = M.validEmail(m.email);
    chips.appendChild(h('span', {'class': 'rchip' + (ok ? '' : ' bad'), title: ok ? m.email : 'No valid email address; will be left out'}, [
      h('span', {text: m.name + (ok ? ' <' + m.email + '>' : ' (no valid email)')}),
      ui.compSource === 'ticked' ? h('button', {type: 'button', 'aria-label': 'Remove ' + m.name, text: '×', onclick: function(){
        delete ui.checked[m.id]; renderList(); renderPicker(); renderComposer(); }}) : null
    ]));
  });
  box.appendChild(chips);
  if (ui.compSource === 'ticked' && list.length > 1){
    var cb = h('input', {type: 'checkbox', onchange: function(){ comp.bcc = cb.checked; renderPreview(); }}); cb.checked = comp.bcc;
    box.appendChild(h('label', {'class': 'check', style: 'margin-top:8px'}, [cb, 'Use BCC so members can’t see each other’s addresses (recommended)']));
  }
  renderPreview();
}
function prepareFor(m, kind){
  ui.selectedId = m.id; ui.compSource = 'selected';
  if (ui.tab !== 'members' && ui.tab !== 'email') setTab('members');
  renderList(); renderDetail(); prepare(kind);
  composerEl.scrollIntoView({behavior: 'smooth', block: 'start'});
}
function prepare(kind){
  var list = compRecipients();
  if (!list.length){ toast(ui.compSource === 'ticked' ? 'Tick at least one member first.' : 'Select a member first.', true); return; }
  var tpl = FORMATS[kind] || {subject: data.settings.defaultSubject, body: data.settings.defaultBody};
  var ctx = M.context(list, data.settings);
  composerEl.querySelector('#c-subject').value = M.fill(tpl.subject, ctx);
  composerEl.querySelector('#c-body').value = M.fill(tpl.body, ctx);
  comp.kind = kind; comp.forKey = recipKey(list);
  renderPreview();
  toast(KIND_NAMES[kind] + ' prepared. Review it, then select Open.');
}
function renderPreview(){
  if (!composerEl) return;
  var a = addresses(), subject = composerEl.querySelector('#c-subject').value, body = composerEl.querySelector('#c-body').value;
  var alerts = composerEl.querySelector('#c-alerts'); alerts.innerHTML = '';
  if (comp.forKey && comp.forKey !== recipKey(a.list) && a.list.length){
    alerts.appendChild(h('div', {'class': 'comp-alert'}, ['The recipients changed since this email was prepared.',
      h('button', {'class': 'btn small', type: 'button', text: 'Prepare it again', onclick: function(){ prepare(comp.kind); }})]));
  }
  var left = a.list.length - a.valid.length;
  if (left) alerts.appendChild(h('div', {'class': 'comp-alert bad', text: left + (left === 1 ? ' member has' : ' members have') + ' no valid email address and will be left out.'}));
  if (/\[Add summary here\]|\[Your Name\]/.test(body + subject)){
    alerts.appendChild(h('div', {'class': 'comp-alert', text: /\[Your Name\]/.test(body + subject)
      ? 'Tip: add your name in Settings so [Your Name] is filled in automatically.' : 'Replace [Add summary here] with today’s summary before sending.'}));
  }
  if (a.group && comp.bcc && !a.to.length) alerts.appendChild(h('div', {'class': 'comp-alert', text: 'Everyone is in BCC. Add your own email in Settings to put it in “To”.'}));
  var pv = composerEl.querySelector('#c-preview'); pv.innerHTML = '';
  var ph = h('div', {'class': 'ph'});
  ph.appendChild(h('span', {text: 'To'})); ph.appendChild(h('span', {text: a.to.join('; ') || '—'}));
  if (a.bcc.length){ ph.appendChild(h('span', {text: 'Bcc'})); ph.appendChild(h('span', {text: a.bcc.join('; ')})); }
  ph.appendChild(h('span', {text: 'Subject'})); ph.appendChild(h('span', {text: subject || '(no subject)'}));
  pv.appendChild(ph); pv.appendChild(h('pre', {text: body || 'Choose Prepare Email, Prepare Summary Email or Prepare New Joinee Email.'}));
  composerEl.querySelector('#c-open').disabled = !a.valid.length;
}
function openEmail(){
  var a = addresses();
  if (!a.valid.length){ toast('There’s no valid email address to send to.', true); return; }
  var subject = composerEl.querySelector('#c-subject').value, body = composerEl.querySelector('#c-body').value;
  var url = M.mailto({to: a.to, bcc: a.bcc, subject: subject, body: body, separator: data.settings.separator});
  function go(){
    var link = h('a', {href: url}); document.body.appendChild(link); link.click(); link.remove();
    toast('Opening your email app. Nothing has been sent; review the draft and send it yourself.');
  }
  if (url.length > 1900){
    openDialog({title: 'This email is long', body: h('p', {'class': 'plain', text: 'Some email apps shorten very long drafts opened this way. Copy the message first so you can paste it into the draft if anything is cut off.'}),
      actions: [{label: 'Cancel'}, {label: 'Open anyway', onClick: go}, {label: 'Copy message and open', primary: true, onClick: function(){ copyText(body, 'Message'); go(); }}]});
  } else go();
}
window.BSFMemberEmail = {mailtoFor: function(){ var a = addresses(); return M.mailto({to: a.to, bcc: a.bcc, subject: composerEl.querySelector('#c-subject').value, body: composerEl.querySelector('#c-body').value, separator: data.settings.separator}); }};

/* ---------- Email tab picker ---------- */
function renderPicker(){
  var ul = $('e-items'); if (!ul) return;
  var q = ui.eSearch.trim().toLowerCase();
  var list = data.members.filter(function(m){ return !q || (m.name + ' ' + m.country + ' ' + m.email).toLowerCase().indexOf(q) >= 0; })
    .sort(function(a, b){ return a.name.localeCompare(b.name); });
  ul.setAttribute('data-empty', data.members.length ? 'No members match.' : 'No members yet.');
  ul.innerHTML = '';
  list.forEach(function(m){
    var ok = M.validEmail(m.email);
    var cb = h('input', {type: 'checkbox', disabled: !ok, 'aria-label': 'Tick ' + m.name, onchange: function(){
      if (cb.checked) ui.checked[m.id] = true; else delete ui.checked[m.id];
      renderComposer(); renderSelbar(); }});
    cb.checked = !!ui.checked[m.id];
    var li = h('li', {'class': 'm-item'}, [cb, h('span', {}, [h('span', {'class': 'm-name', text: m.name}),
      h('span', {'class': 'm-sub', text: ok ? m.email : 'No valid email address'})]), birthdayBadge(m)]);
    li.addEventListener('click', function(e){ if (e.target !== cb && ok){ cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } });
    ul.appendChild(li);
  });
  ui._pickerShown = list;
}

/* ---------- Birthdays tab ---------- */
function bdActions(x, big){
  var m = x.m, ops = h('span', {'class': 'ops'});
  ops.appendChild(h('button', {'class': 'btn small' + (big ? ' primary' : ''), type: 'button', text: big ? 'Show Birthday Celebration' : 'Celebrate',
    onclick: function(){ ui.celebrateId = m.id; renderBar(); showBirthday(); }}));
  var wa = M.whatsappUrl(m.phone);
  if (wa) ops.appendChild(h('a', {'class': 'btn small wa', href: wa, target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp'}));
  if (M.validEmail(m.email)) ops.appendChild(h('button', {'class': 'btn small', type: 'button', text: 'Email', onclick: function(){ prepareFor(m, 'plain'); }}));
  ops.appendChild(h('button', {'class': 'btn quiet small', type: 'button', text: 'Details', onclick: function(){ setTab('members'); select(m.id); }}));
  if (x.b.days <= (Number(data.settings.reminderDays) || 14))
    ops.appendChild(h('button', {'class': 'btn quiet small', type: 'button', text: isAcked(x) ? 'Acknowledged' : 'Acknowledge', disabled: isAcked(x),
      onclick: function(){ ack([x]); renderStatus(); renderBirthdays(); }}));
  return ops;
}
function renderBirthdays(){
  var n = Number(data.settings.reminderDays) || 14;
  var seg = $('bd-window'); seg.innerHTML = '';
  [7, 14, 30, 60].forEach(function(d){
    seg.appendChild(h('button', {type: 'button', 'aria-pressed': String(d === n), text: d + ' days', onclick: function(){
      data.settings.reminderDays = d; persist(); renderAll(); }}));
  });
  var all = byBirthday(), w = all.filter(function(x){ return x.b.days <= n; });
  var todayBox = $('bd-today'); todayBox.innerHTML = '';
  w.filter(function(x){ return x.b.days === 0; }).forEach(function(x){
    todayBox.appendChild(h('div', {'class': 'bd-today-card'}, [
      h('h4', {text: x.m.name}),
      h('div', {'class': 'sub', text: 'Birthday today' + (x.b.turning ? ' · turns ' + x.b.turning : '') + (x.m.country ? ' · ' + x.m.country : '')}),
      bdActions(x, true)]));
  });
  $('bd-up-title').textContent = 'Coming up in the next ' + n + ' days';
  var up = $('bd-upcoming'); up.innerHTML = '';
  w.filter(function(x){ return x.b.days > 0; }).forEach(function(x){ up.appendChild(bdRow(x)); });
  var none = $('bd-none');
  if (!all.length) none.textContent = 'No birth dates yet. Add them in the BSF Members tab or import an Excel file.';
  else if (!w.length) none.textContent = 'No birthdays today or in the next ' + n + ' days. The next one is ' + all[0].m.name + ' on ' + all[0].b.nextLabel + ' (in ' + all[0].b.days + ' days).';
  else if (!w.filter(function(x){ return x.b.days > 0; }).length) none.textContent = 'No other birthdays in the next ' + n + ' days.';
  else none.textContent = '';
  var allUl = $('bd-all'); allUl.innerHTML = '';
  all.forEach(function(x){ allUl.appendChild(bdRow(x, true)); });
  var missing = data.members.filter(function(m){ return !m.birthDate; });
  $('bd-missing').textContent = missing.length ? missing.length + (missing.length === 1 ? ' member has' : ' members have') + ' no birth date: ' + missing.slice(0, 8).map(function(m){ return m.name; }).join(', ') + (missing.length > 8 ? '…' : '') : '';
}
function bdRow(x, compact){
  var li = h('li', {'class': 'bd-row' + (isAcked(x) && !compact ? ' acked' : '')}, [
    h('span', {'class': 'when', text: whenText(x.b)}),
    h('span', {'class': 'who'}, [h('b', {text: x.m.name}),
      h('span', {text: x.b.next.d + ' ' + M.MONTH_NAMES[x.b.next.m - 1] + (turningText(x.b) ? ' · ' + turningText(x.b) : '') + (x.b.leapDay ? ' · leap-day birthday' : '')})]),
    compact ? h('span', {'class': 'ops'}, [h('button', {'class': 'btn quiet small', type: 'button', text: 'Celebrate',
      onclick: function(){ ui.celebrateId = x.m.id; renderBar(); showBirthday(); }})]) : bdActions(x)
  ]);
  return li;
}

/* ---------- Birthday celebration bar + overlay ---------- */
function barOptions(){
  var w = windowList().map(function(x){ return {m: x.m, label: x.m.name + ' — ' + whenText(x.b).toLowerCase()}; });
  if (ui.celebrateId && !w.some(function(o){ return o.m.id === ui.celebrateId; })){
    var m = byId(ui.celebrateId); if (m) w.unshift({m: m, label: m.name + ' — chosen'});
  }
  return w;
}
function renderBar(){
  var sel = $('bb-member'), opts = barOptions(), n = Number(data.settings.reminderDays) || 14;
  if (ui.celebrateId && !byId(ui.celebrateId)) ui.celebrateId = null;
  sel.innerHTML = '';
  opts.forEach(function(o){ sel.appendChild(h('option', {value: o.m.id, text: o.label})); });
  if (!opts.length) sel.appendChild(h('option', {value: '', text: 'No birthdays in the next ' + n + ' days'}));
  if (!ui.celebrateId && opts.length) ui.celebrateId = opts[0].m.id;
  sel.value = ui.celebrateId || '';
  sel.disabled = !opts.length;
  $('bb-show').disabled = !opts.length;
  stageBirthday();
  $('bb-msg').textContent = opts.length ? '' : 'Nobody has a birthday today or in the next ' + n + ' days. To celebrate someone else, choose “Celebrate on screen” on their member card.';
  renderBarStatus();
}
function renderBarStatus(){
  var on = !!(live && live.birthday.visible && live.birthday.greeting);
  var pill = $('bb-pill'); pill.className = 'pill' + (on ? ' on' : ''); pill.querySelector('b').textContent = on ? 'On screen' : 'Hidden';
  var top = $('pill-birthday'); top.className = 'pill' + (on ? ' on' : ''); top.querySelector('b').textContent = on ? 'On screen' : 'Hidden';
}
function bdayPayload(m){
  var st = data.settings, display = st.bdayNameStyle === 'first' ? m.name.split(/\s+/)[0] : m.name;
  var ctx = M.context([Object.assign({}, m, {name: display})], st);
  return {name: display, greeting: M.fill(st.bdayGreeting, ctx), message: M.fill(st.bdayMessage, ctx),
          country: $('bb-country').checked ? m.country : '', label: st.bdayLabel, showLabel: !!st.bdayLabel.trim(), transition: st.bdayTransition};
}
/* Load the chosen member's greeting into the (hidden) birthday overlay, so the phone remote
 * can show it without ever receiving the member list. Only greeting details are shared. */
function stageBirthday(){
  if (!live || live.birthday.visible) return;
  var m = byId(ui.celebrateId); if (!m) return;
  var p = bdayPayload(m), b = live.birthday;
  if (['name', 'greeting', 'message', 'country', 'label', 'showLabel', 'transition'].every(function(k){ return b[k] === p[k]; })) return;
  ui.shownBdayId = m.id;
  commit(function(n){ if (!n.birthday.visible) Object.assign(n.birthday, p); });
}
function showBirthday(){
  var m = byId(ui.celebrateId);
  if (!m){ toast('Choose a member to celebrate first.', true); return; }
  var p = bdayPayload(m);
  ui.shownBdayId = m.id;
  commit(function(n){ Object.assign(n.birthday, p); n.birthday.visible = true; n.birthday.seq = (n.birthday.seq || 0) + 1; })
    .then(function(){ toast('Birthday celebration on screen for ' + m.name); });
}
function hideBirthday(){ commit(function(n){ n.birthday.visible = false; }).then(function(){ toast('Birthday overlay hidden'); }); }
function clearBirthday(){
  ui.shownBdayId = null;
  commit(function(n){ var b = n.birthday; b.visible = false; b.name = b.greeting = b.message = b.country = ''; b.cut = (b.cut || 0) + 1; })
    .then(function(){ toast('Birthday overlay cleared'); });
}
/* Shared with Meeting Mode and keyboard shortcuts */
window.BSFBirthday = {
  show: function(){ showBirthday(); }, hide: hideBirthday, clear: clearBirthday,
  toggle: function(){ if (live && live.birthday.visible && live.birthday.greeting) hideBirthday(); else if (byId(ui.celebrateId)) showBirthday(); else toast('No birthday is ready. Choose a member in the birthday bar below.', true); },
  candidate: function(){ var m = byId(ui.celebrateId); return m ? {name: m.name} : null; }
};
window.BSFMembersAPI = { settings: function(){ return data.settings; } };
function refreshBirthdayInPlace(){
  if (live && !live.birthday.visible){ stageBirthday(); return; }
  if (!live || !live.birthday.visible) return;
  var m = byId(ui.shownBdayId); if (!m) return;
  var p = bdayPayload(m);
  commit(function(n){ if (n.birthday.visible) Object.assign(n.birthday, p); });
}

/* ---------- Settings ---------- */
var SEGS = {
  separator: [[';', 'Outlook ( ; )'], [',', 'Other apps ( , )']],
  bdayNameStyle: [['full', 'Full name'], ['first', 'First name only']],
  bdayTransition: [['fade', 'Fade'], ['rise', 'Gentle rise'], ['none', 'Cut']],
  reminderDays: [[7, '7 days'], [14, '14 days'], [30, '30 days'], [60, '60 days']],
  leap: [['feb28', '28 Feb in other years'], ['mar1', '1 Mar in other years']],
  dateOrder: [['dmy', 'Day/Month/Year'], ['mdy', 'Month/Day/Year']]
};
function bindSettings(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-set]'), function(el){
    el.addEventListener('input', function(){
      data.settings[el.dataset.set] = el.value; persist();
      if (/^bday/.test(el.dataset.set)) refreshBirthdayInPlace();
      renderPreview(); savedNote();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-setcheck]'), function(el){
    el.addEventListener('change', function(){ data.settings[el.dataset.setcheck] = el.checked; $('bb-country').checked = el.checked; persist(); refreshBirthdayInPlace(); savedNote(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-setseg]'), function(seg){
    var key = seg.dataset.setseg;
    SEGS[key].forEach(function(o){
      seg.appendChild(h('button', {type: 'button', 'data-val': String(o[0]), text: o[1], onclick: function(){
        data.settings[key] = o[0]; persist(); renderAll(); if (/^bday/.test(key)) refreshBirthdayInPlace(); savedNote(); }}));
    });
  });
  var pos = $('s-bdaypos');
  [['top', 'Top'], ['center', 'Middle'], ['bottom', 'Bottom']].forEach(function(o){
    pos.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ commit(function(n){ n.layout.bdayPos = o[0]; }); }}));
  });
  var sc = $('s-bdayscale'), scT;
  sc.addEventListener('input', function(){
    sc.nextElementSibling.textContent = Math.round(sc.value * 100) + '%';
    clearTimeout(scT); scT = setTimeout(function(){ commit(function(n){ n.layout.bdayScale = Number(sc.value); }); }, 90);
  });
  $('s-export').addEventListener('click', exportXlsx);
  $('s-samples').addEventListener('click', function(){
    confirmDialog('Load sample members?', 'This adds 12 fictional members (with birthdays around today, the end of the year and 29 February) so you can try every feature. You can delete them afterwards.', 'Add samples', loadSamples);
  });
  $('s-clear').addEventListener('click', clearAll);
}
var savedT;
function savedNote(){ clearTimeout(savedT); savedT = setTimeout(function(){ toast('Settings saved'); }, 700); }
function renderSettings(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-set]'), function(el){ if (document.activeElement !== el) el.value = data.settings[el.dataset.set]; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-setcheck]'), function(el){ el.checked = !!data.settings[el.dataset.setcheck]; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-setseg]'), function(seg){
    Array.prototype.forEach.call(seg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === String(data.settings[seg.dataset.setseg]))); });
  });
  if (live){
    Array.prototype.forEach.call($('s-bdaypos').children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === live.layout.bdayPos)); });
    var sc = $('s-bdayscale'); if (document.activeElement !== sc){ sc.value = live.layout.bdayScale; }
    sc.nextElementSibling.textContent = Math.round(sc.value * 100) + '%';
  }
  $('s-location').textContent = storedAt;
}
function clearAll(){
  var input = h('input', {type: 'text', placeholder: 'Type DELETE', autocomplete: 'off'});
  var btnRef = {};
  var body = h('div', {}, [
    h('p', {'class': 'plain', text: 'This permanently removes all ' + data.members.length + ' members from this computer. Settings are kept. Export a backup first if you might need the list again.'}),
    h('label', {'class': 'field'}, [h('span', {text: 'Type DELETE to confirm'}), input])
  ]);
  var acts = [{label: 'Cancel'}, {label: 'Clear all member data', danger: true, disabled: true, onClick: function(){
    if (input.value.trim() !== 'DELETE') return false;
    data.members = []; ui.checked = {}; ui.selectedId = null; ui.celebrateId = null;
    persist(); renderAll(); toast('All member data cleared from this computer');
  }}];
  openDialog({title: 'Clear all member data?', body: body, actions: acts, focus: input});
  input.addEventListener('input', function(){ acts[1].el.disabled = input.value.trim() !== 'DELETE'; });
}
function loadSamples(){
  var t = M.today();
  function iso(offset, year){
    var d = new Date(Date.UTC(t.y, t.m - 1, t.d + offset));
    var mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
    if (mm === 2 && dd === 29) dd = 28;
    return (year ? year + '-' : '--') + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }
  var s = [
    ['Grace Mensah', 'Ghana', '+233 20 000 0001', 'grace.mensah@example.com', iso(0, 1988)],
    ['Daniel Okafor', 'Nigeria', '+234 800 000 0002', 'daniel.okafor@example.com', iso(3, 1992)],
    ['Priya Nair', 'India', '+91 90000 00003', 'priya.nair@example.com', iso(10, null)],
    ['Samuel Thomas', 'Kuwait', '5000 0004', 'samuel.thomas@example.com', iso(25, 1979)],
    ['Maria Fernandes', 'Philippines', '+63 900 000 0005', 'maria.fernandes@example.com', iso(45, 1995)],
    ['John Mathew', 'United Arab Emirates', '+971 50 000 0006', 'john.mathew@example.com', iso(120, 1983)],
    ['Esther Wanjiru', 'Kenya', '+254 700 000007', 'esther.wanjiru@example.com', '1990-12-31'],
    ['Hannah Lee', 'South Korea', '+82 10 0000 0008', 'hannah.lee@example.com', '1997-01-01'],
    ['Leah Johnson', 'United States', '+1 555 010 0009', 'leah.johnson@example.com', '2000-02-29'],
    ['Oluwaseun Adebayo-Oluwaseyi Christabel Makinde-Richardson', 'Nigeria', '+234 800 000 0010', 'oluwaseun.makinde@example.com', iso(200, 1986)],
    ['Anna Kowalska', 'Poland', '+48 500 000 011', '', '1975-06-18'],
    ['Ruth Abraham', 'Ethiopia', '0911 000 012', 'ruth.abraham@example.com', '']
  ];
  var added = 0;
  s.forEach(function(r){
    var c = M.checkMember({name: r[0], country: r[1], phone: r[2], email: r[3], birthDate: r[4]});
    if (!c.errors.length){ data.members.push(c.member); added++; }
  });
  persist(); renderAll(); setTab('members'); toast(added + ' sample members added');
}

/* ---------- Render everything ---------- */
function renderAll(){
  renderCountries(); renderList(); renderDetail(); renderComposer(); renderPicker();
  renderStatus(); renderBar(); if (ui.tab === 'birthdays') renderBirthdays(); if (ui.tab === 'settings') renderSettings();
}

/* ---------- Wiring ---------- */
function setup(){
  var q = new URLSearchParams(location.search).get('today'); // testing aid: ?today=YYYY-MM-DD
  if (q) M.setToday(q);
  buildComposer();
  document.querySelector('.tabs').addEventListener('click', function(e){ var b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function(b){ b.addEventListener('click', function(){ setTab(b.dataset.goto); }); });
  $('m-search').addEventListener('input', function(){ ui.search = this.value; renderList(); });
  $('m-country').addEventListener('change', function(){ ui.country = this.value; renderList(); });
  $('m-sort').addEventListener('change', function(){ ui.sort = this.value; renderList(); });
  $('m-add').addEventListener('click', function(){ editMember(null); });
  $('m-import').addEventListener('click', function(){ $('m-import-file').click(); });
  $('m-import-file').addEventListener('change', function(){ var f = this.files && this.files[0]; this.value = ''; if (f) readFile(f); });
  $('m-template').addEventListener('click', downloadTemplate);
  $('m-export-xlsx').addEventListener('click', exportXlsx);
  $('m-export-csv').addEventListener('click', exportCsv);
  $('e-search').addEventListener('input', function(){ ui.eSearch = this.value; renderPicker(); });
  $('e-all').addEventListener('click', function(){ (ui._pickerShown || []).forEach(function(m){ if (M.validEmail(m.email)) ui.checked[m.id] = true; }); renderPicker(); renderList(); renderComposer(); });
  $('e-none').addEventListener('click', function(){ ui.checked = {}; renderPicker(); renderList(); renderComposer(); });
  $('bb-member').addEventListener('change', function(){
    ui.celebrateId = this.value || null;
    if (live && live.birthday.visible) showBirthday();  // switch the overlay to the newly chosen member
  });
  $('bb-country').checked = !!data.settings.bdayShowCountry;
  $('bb-country').addEventListener('change', refreshBirthdayInPlace);
  $('bb-show').addEventListener('click', showBirthday);
  $('bb-hide').addEventListener('click', hideBirthday);
  $('bb-clear').addEventListener('click', clearBirthday);
  bindSettings();

  document.addEventListener('keydown', function(e){
    if (document.querySelector('dialog[open]')) return;
    if (e.altKey && !e.ctrlKey && /^[1-6]$/.test(e.key)){ e.preventDefault(); setTab(TABS[+e.key - 1]); return; }
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if (e.key === '/' && (ui.tab === 'members' || ui.tab === 'email')){ e.preventDefault(); $(ui.tab === 'members' ? 'm-search' : 'e-search').focus(); }
  });

  Store.subscribe(function(st){ live = st; renderBarStatus(); stageBirthday(); if (ui.tab === 'settings') renderSettings(); });
  // Keep day counts right if the dashboard stays open past midnight
  setInterval(function(){ var t = M.today(), k = t.y + '-' + t.m + '-' + t.d; if (k !== ui.dayKey){ ui.dayKey = k; renderAll(); } }, 60000);
  ui.dayKey = (function(t){ return t.y + '-' + t.m + '-' + t.d; })(M.today());
  setTab('meeting');
}

loadPrivate().then(function(d){ data = normalizeData(d); }, function(){
  loadFailed = true;
  toast('Member data couldn’t be loaded. Check that the BSF Command Center window is open, then reload.', true);
}).then(function(){ setup(); renderAll(); });
})();
