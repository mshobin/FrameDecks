/*
 * FRAMEDECKS - member logic (no user interface here).
 * Dates, birthdays, phone numbers, email drafts, CSV. Used by the dashboard only;
 * none of this is ever sent to the overlay pages.
 */
(function(root){
'use strict';

/* ---------- Country calling codes (used only as a suggestion the user must confirm) ---------- */
var CODES_RAW =
 'Afghanistan:93|Albania:355|Algeria:213|Andorra:376|Angola:244|Argentina:54|Armenia:374|Australia:61|Austria:43|' +
 'Azerbaijan:994|Bahamas:1|Bahrain:973|Bangladesh:880|Barbados:1|Belarus:375|Belgium:32|Belize:501|Benin:229|' +
 'Bhutan:975|Bolivia:591|Bosnia and Herzegovina:387|Botswana:267|Brazil:55|Brunei:673|Bulgaria:359|Burkina Faso:226|' +
 'Burundi:257|Cambodia:855|Cameroon:237|Canada:1|Cape Verde:238|Central African Republic:236|Chad:235|Chile:56|' +
 'China:86|Colombia:57|Comoros:269|Congo:242|Democratic Republic of the Congo:243|DR Congo:243|DRC:243|Costa Rica:506|' +
 'Croatia:385|Cuba:53|Cyprus:357|Czech Republic:420|Czechia:420|Denmark:45|Djibouti:253|Dominican Republic:1|' +
 'Ecuador:593|Egypt:20|El Salvador:503|Equatorial Guinea:240|Eritrea:291|Estonia:372|Eswatini:268|Ethiopia:251|' +
 'Fiji:679|Finland:358|France:33|Gabon:241|Gambia:220|Georgia:995|Germany:49|Ghana:233|Greece:30|Grenada:1|' +
 'Guatemala:502|Guinea:224|Guyana:592|Haiti:509|Honduras:504|Hong Kong:852|Hungary:36|Iceland:354|India:91|' +
 'Indonesia:62|Iran:98|Iraq:964|Ireland:353|Israel:972|Italy:39|Ivory Coast:225|Cote d\'Ivoire:225|Jamaica:1|Japan:81|' +
 'Jordan:962|Kazakhstan:7|Kenya:254|Kuwait:965|Kyrgyzstan:996|Laos:856|Latvia:371|Lebanon:961|Lesotho:266|Liberia:231|' +
 'Libya:218|Liechtenstein:423|Lithuania:370|Luxembourg:352|Macau:853|Madagascar:261|Malawi:265|Malaysia:60|Maldives:960|' +
 'Mali:223|Malta:356|Mauritania:222|Mauritius:230|Mexico:52|Moldova:373|Monaco:377|Mongolia:976|Montenegro:382|' +
 'Morocco:212|Mozambique:258|Myanmar:95|Namibia:264|Nepal:977|Netherlands:31|Holland:31|New Zealand:64|Nicaragua:505|' +
 'Niger:227|Nigeria:234|North Macedonia:389|Norway:47|Oman:968|Pakistan:92|Palestine:970|Panama:507|' +
 'Papua New Guinea:675|Paraguay:595|Peru:51|Philippines:63|Poland:48|Portugal:351|Puerto Rico:1|Qatar:974|Romania:40|' +
 'Russia:7|Rwanda:250|Saudi Arabia:966|KSA:966|Senegal:221|Serbia:381|Seychelles:248|Sierra Leone:232|Singapore:65|' +
 'Slovakia:421|Slovenia:386|Somalia:252|South Africa:27|South Korea:82|Korea:82|South Sudan:211|Spain:34|Sri Lanka:94|' +
 'Sudan:249|Suriname:597|Sweden:46|Switzerland:41|Syria:963|Taiwan:886|Tajikistan:992|Tanzania:255|Thailand:66|' +
 'Togo:228|Trinidad and Tobago:1|Tunisia:216|Turkey:90|Turkiye:90|Turkmenistan:993|Uganda:256|Ukraine:380|' +
 'United Arab Emirates:971|UAE:971|United Kingdom:44|UK:44|England:44|Scotland:44|Wales:44|Great Britain:44|' +
 'United States:1|United States of America:1|USA:1|US:1|America:1|Uruguay:598|Uzbekistan:998|Venezuela:58|' +
 'Vietnam:84|Yemen:967|Zambia:260|Zimbabwe:263';
var CODES = {};
CODES_RAW.split('|').forEach(function(p){ var i = p.lastIndexOf(':'); CODES[p.slice(0, i).toLowerCase()] = p.slice(i + 1); });
var CODE_LIST = (function(){
  var seen = {}, out = [];
  CODES_RAW.split('|').forEach(function(p){
    var i = p.lastIndexOf(':'), name = p.slice(0, i);
    if (name.length <= 3 || seen[name]) return;
    seen[name] = 1; out.push({name: name, code: p.slice(i + 1)});
  });
  return out.sort(function(a, b){ return a.name.localeCompare(b.name); });
})();
function countryCode(country){
  var k = String(country || '').trim().toLowerCase().replace(/^the\s+/, '');
  return CODES[k] || null;
}

/* ---------- Text safety ---------- */
function clean(v, max){
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.length > (max || 200) ? s.slice(0, max || 200) : s;
}

/* ---------- Dates ---------- */
var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function monthFromName(s){
  s = String(s).toLowerCase().replace(/\.$/, '');
  if (s.length < 3) return 0;
  for (var i = 0; i < 12; i++) if (MONTHS[i].indexOf(s) === 0) return i + 1;
  if (s === 'sept') return 9;
  return 0;
}
function isLeap(y){ return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysIn(m, y){ return [31, (y === null || isLeap(y)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
function pad(n){ return (n < 10 ? '0' : '') + n; }
function dayNum(y, m, d){ return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

var todayOverride = null;
function today(){
  if (todayOverride) return todayOverride;
  var n = new Date();
  return {y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate()};
}
function setToday(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  todayOverride = m ? {y: +m[1], m: +m[2], d: +m[3]} : null;
}

/*
 * Parse a birth date. Returns {ok, iso, note, error}.
 * iso is "YYYY-MM-DD", or "--MM-DD" when no year was given, or "" when empty.
 * order: 'dmy' or 'mdy' decides ambiguous numeric dates such as 03/04/1990.
 * excelSerial: a number from an Excel date cell.
 */
function parseDate(value, order, dateCode){
  if (value === null || value === undefined || String(value).trim() === '') return {ok: true, iso: '', note: ''};
  var y = null, m, d, note = '';
  if (typeof value === 'number' && dateCode){
    var dc = dateCode(value);
    if (!dc) return {ok: false, error: 'Not a date'};
    y = dc.y; m = dc.m; d = dc.d;
  } else {
    var s = clean(value, 40).replace(/\s+/g, ' ').replace(/(\d)(st|nd|rd|th)\b/gi, '$1'), r;
    if ((r = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T].*)?$/.exec(s))){ y = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = /^--(\d{2})-(\d{2})$/.exec(s))){ m = +r[1]; d = +r[2]; }
    else if ((r = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s))){
      var a = +r[1], b = +r[2]; y = +r[3];
      if (a > 12 && b <= 12){ d = a; m = b; }
      else if (b > 12 && a <= 12){ m = a; d = b; }
      else if (a === b){ d = a; m = b; }
      else if (order === 'mdy'){ m = a; d = b; note = 'Read as month/day/year'; }
      else { d = a; m = b; note = 'Read as day/month/year'; }
    }
    else if ((r = /^(\d{1,2})[ \-]([A-Za-z]{3,}\.?),?[ \-](\d{4})$/.exec(s))){ d = +r[1]; m = monthFromName(r[2]); y = +r[3]; }
    else if ((r = /^([A-Za-z]{3,}\.?) (\d{1,2}),? (\d{4})$/.exec(s))){ m = monthFromName(r[1]); d = +r[2]; y = +r[3]; }
    else if ((r = /^(\d{1,2})[ \-]([A-Za-z]{3,}\.?)$/.exec(s))){ d = +r[1]; m = monthFromName(r[2]); }
    else if ((r = /^([A-Za-z]{3,}\.?) (\d{1,2})$/.exec(s))){ m = monthFromName(r[1]); d = +r[2]; }
    else return {ok: false, error: 'Unrecognised date. Use YYYY-MM-DD, for example 1985-03-15'};
  }
  if (!m || m < 1 || m > 12) return {ok: false, error: 'Month is not valid'};
  if (!d || d < 1 || d > daysIn(m, y)) return {ok: false, error: 'Day ' + d + ' does not exist in ' + MONTH_NAMES[m - 1] + (y ? ' ' + y : '')};
  if (y !== null){
    var t = today();
    if (y < 1900) return {ok: false, error: 'Year is too early'};
    if (dayNum(y, m, d) > dayNum(t.y, t.m, t.d)) return {ok: false, error: 'Birth date is in the future'};
  }
  return {ok: true, iso: (y !== null ? y + '-' : '--') + pad(m) + '-' + pad(d), note: note};
}
function splitIso(iso){
  var r = /^(?:(\d{4})|-)-(\d{2})-(\d{2})$/.exec(iso || '');
  return r ? {y: r[1] ? +r[1] : null, m: +r[2], d: +r[3]} : null;
}
function formatDate(iso, withYear){
  var p = splitIso(iso); if (!p) return '';
  return p.d + ' ' + MONTH_NAMES[p.m - 1] + (p.y && withYear !== false ? ' ' + p.y : '');
}
function formatToday(){ var t = today(); return t.d + ' ' + MONTH_NAMES[t.m - 1] + ' ' + t.y; }

/*
 * Next annual birthday. The birth year is ignored except for age.
 * leap: 'feb28' (default) or 'mar1' — when a 29 February birthday is celebrated in other years.
 */
function birthday(iso, leap){
  var p = splitIso(iso); if (!p) return null;
  var t = today(), tn = dayNum(t.y, t.m, t.d);
  function onYear(Y){
    if (p.m === 2 && p.d === 29 && !isLeap(Y)) return leap === 'mar1' ? {y: Y, m: 3, d: 1} : {y: Y, m: 2, d: 28};
    return {y: Y, m: p.m, d: p.d};
  }
  var nx = onYear(t.y);
  if (dayNum(nx.y, nx.m, nx.d) < tn) nx = onYear(t.y + 1);
  var days = dayNum(nx.y, nx.m, nx.d) - tn;
  var info = {days: days, isToday: days === 0, next: nx, nextLabel: nx.d + ' ' + MONTH_NAMES[nx.m - 1] + ' ' + nx.y,
              leapDay: p.m === 2 && p.d === 29, age: null, turning: null, sortKey: p.m * 100 + p.d};
  if (p.y !== null){
    info.turning = nx.y - p.y;
    info.age = days === 0 ? info.turning : info.turning - 1;
  }
  info.status = days === 0 ? 'Birthday today' : days === 1 ? 'Birthday tomorrow' : 'In ' + days + ' days';
  return info;
}

/* ---------- Phone numbers ---------- */
/* Never adds a country code on its own: numbers without one are flagged. */
function parsePhone(raw){
  var s = clean(raw, 40);
  if (!s) return {empty: true, raw: '', intl: false};
  var c = s.replace(/[\s().\-\u00A0\/]/g, '');
  if (/^\+\d{7,15}$/.test(c)) return {raw: s, intl: true, digits: c.slice(1), e164: c};
  if (/^00\d{7,15}$/.test(c)) return {raw: s, intl: true, digits: c.slice(2), e164: '+' + c.slice(2), note: 'Starts with 00; read as +' + c.slice(2, 5) + '…'};
  if (/^\d{5,15}$/.test(c)) return {raw: s, intl: false, digits: c, warning: 'No country code'};
  return {raw: s, intl: false, invalid: true, warning: 'Not a valid phone number'};
}
function withCountryCode(raw, code){
  var p = parsePhone(raw);
  if (!p.digits || p.intl) return p.e164 || raw;
  var digits = p.digits;
  if (code !== '39' && digits.charAt(0) === '0') digits = digits.replace(/^0+/, ''); // drop the national trunk 0
  return '+' + code + ' ' + digits;
}
function whatsappUrl(raw){ var p = parsePhone(raw); return p.intl ? 'https://wa.me/' + p.digits : ''; }
function telUrl(raw){ var p = parsePhone(raw); if (p.empty || p.invalid) return ''; return 'tel:' + (p.intl ? p.e164 : p.digits); }

/* ---------- Email ---------- */
function validEmail(s){ return /^[^\s@<>(),;:"\[\]\\]+@[^\s@<>(),;:"\[\]\\]+\.[A-Za-z]{2,}$/.test(String(s || '').trim()); }

function fill(template, ctx){
  return String(template || '').replace(/\[(Member Name|First Name|Country|Birth Date|Today[’']s Date|Date|Group Name|Your Name|Greeting|Signature)\]/g,
    function(all, key){
      key = key.replace('’', "'");
      var v = ctx[key];
      return v === undefined || v === null ? all : v;
    });
}
/* Builds the placeholder values. members: one member, or several for a group email. */
function context(members, settings){
  var group = members.length !== 1, m = members[0] || {};
  var ctx = {
    'Member Name': group ? 'everyone' : (m.name || ''),
    'First Name': group ? 'everyone' : String(m.name || '').split(/\s+/)[0],
    'Country': group ? '' : (m.country || ''),
    'Role': group ? '' : (m.role || ''),
    'Birth Date': group ? '' : formatDate(m.birthDate, false),
    "Today's Date": formatToday(), 'Date': formatToday(),
    'Group Name': settings.groupName || '',
    'Your Name': settings.yourName || '[Your Name]'
  };
  ctx['Greeting'] = fill(group ? settings.groupGreeting : settings.greeting, ctx);
  ctx['Signature'] = fill(settings.signature, ctx);
  return ctx;
}
function crlf(s){ return String(s).replace(/\r?\n/g, '\r\n'); }
function mailto(opts){
  var sep = opts.separator === ',' ? ',' : ';';
  var enc = function(a){ return encodeURIComponent(a).replace(/%40/g, '@'); };
  var url = 'mailto:' + (opts.to || []).map(enc).join(sep);
  var q = [];
  if (opts.cc && opts.cc.length) q.push('cc=' + opts.cc.map(enc).join(sep));
  if (opts.bcc && opts.bcc.length) q.push('bcc=' + opts.bcc.map(enc).join(sep));
  if (opts.subject) q.push('subject=' + encodeURIComponent(opts.subject));
  if (opts.body) q.push('body=' + encodeURIComponent(crlf(opts.body)));
  return url + (q.length ? '?' + q.join('&') : '');
}

/* ---------- CSV (spreadsheet-safe) ---------- */
function csvCell(v, isPhone){
  var s = String(v === null || v === undefined ? '' : v);
  // Stop spreadsheet apps treating a value as a formula (phone numbers like +965… are allowed)
  if (/^[=+\-@\t\r]/.test(s) && !(isPhone && /^\+[\d\s()\-]+$/.test(s))) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(headers, rows, phoneCol){
  return '\uFEFF' + [headers.map(function(h){ return csvCell(h); }).join(',')].concat(rows.map(function(r){
    return r.map(function(v, i){ return csvCell(v, i === phoneCol); }).join(',');
  })).join('\r\n');
}

/* ---------- Members ---------- */
var COLUMNS = ['Name', 'Country', 'Phone Number', 'Email', 'Birth Date'];        // required in imported sheets
var OPTIONAL_COLUMNS = ['Role'];                                                   // used when present
var EXPORT_COLUMNS = COLUMNS.concat(OPTIONAL_COLUMNS);
var ALIASES = {
  'name': 'Name', 'full name': 'Name', 'member name': 'Name',
  'country': 'Country',
  'role': 'Role', 'title': 'Role', 'position': 'Role', 'ministry': 'Role', 'responsibility': 'Role', 'serving role': 'Role',
  'phone number': 'Phone Number', 'phone': 'Phone Number', 'mobile': 'Phone Number', 'mobile number': 'Phone Number', 'whatsapp': 'Phone Number',
  'email': 'Email', 'e-mail': 'Email', 'email address': 'Email',
  'birth date': 'Birth Date', 'birthdate': 'Birth Date', 'date of birth': 'Birth Date', 'dob': 'Birth Date', 'birthday': 'Birth Date'
};
function headerName(h){ return ALIASES[String(h || '').trim().toLowerCase().replace(/\s+/g, ' ')] || null; }
function uid(){ return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* Validate one record. Returns {member, errors[], warnings[], notes[]} */
function checkMember(input, order, dateCode){
  var errors = [], warnings = [], notes = [];
  var m = {
    id: input.id || uid(),
    name: clean(input.name, 120), country: clean(input.country, 80),
    phone: clean(input.phone, 40), email: clean(input.email, 160), birthDate: '', role: clean(input.role, 60)
  };
  if (!m.name) errors.push('Name is missing');
  if (!m.country) warnings.push('Country is missing');
  if (m.email && !validEmail(m.email)) errors.push('Email is not valid');
  if (!m.email) warnings.push('Email is missing');
  var ph = parsePhone(m.phone);
  if (ph.empty) warnings.push('Phone number is missing');
  else if (ph.invalid) errors.push('Phone number is not valid');
  else if (!ph.intl) warnings.push('Phone has no country code');
  var bd = parseDate(input.birthDate, order, dateCode);
  if (!bd.ok) errors.push('Birth date: ' + bd.error);
  else { m.birthDate = bd.iso; if (!bd.iso) warnings.push('Birth date is missing'); if (bd.note) notes.push(bd.note); }
  return {member: m, errors: errors, warnings: warnings, notes: notes};
}

root.KCMembers = {
  COLUMNS: COLUMNS, OPTIONAL_COLUMNS: OPTIONAL_COLUMNS, EXPORT_COLUMNS: EXPORT_COLUMNS, headerName: headerName, checkMember: checkMember, uid: uid, clean: clean,
  parseDate: parseDate, formatDate: formatDate, formatToday: formatToday, birthday: birthday, setToday: setToday, today: today,
  parsePhone: parsePhone, withCountryCode: withCountryCode, whatsappUrl: whatsappUrl, telUrl: telUrl,
  countryCode: countryCode, countryList: CODE_LIST,
  validEmail: validEmail, fill: fill, context: context, mailto: mailto, toCsv: toCsv, MONTH_NAMES: MONTH_NAMES
};
})(typeof window !== 'undefined' ? window : globalThis);
