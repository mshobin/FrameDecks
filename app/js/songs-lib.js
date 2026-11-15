/* FrameDecks 26.11.57 - songs: reading lyrics in the forms churches have them, and laying a song out for the screen.
 * Pure functions (no page, no requests), used by the Song Library (js/songs.js) and tests (tests/songs-lib.test.js).
 *   fromText(text)      lyrics pasted or in a .txt file: sections split at blank lines or at a label line such as
 *                       "Verse 1", "[Chorus]", "Bridge:", "V2", "Pre-Chorus"; a first block of "Title: ..." /
 *                       "CCLI: ..." / "Author: ..." lines fills the details
 *   fromChordPro(text)  .cho / .chordpro / .pro: {title}, {artist}, {ccli}, {copyright}, {key}, {start_of_chorus} ...,
 *                       {comment: Verse 2}; chords in [brackets] are removed
 *   fromOpenLyrics(xml) OpenLyrics .xml: titles, authors, ccliNo, copyright, verseOrder, each <verse name="v1">
 *   fromSlides(slides)  a PowerPoint's slides (title, text): one section per slide with words
 *   arrange(song)       the sections in the order of song.order (V1 C V2 C B C), repeating without copying words
 *   jumpTo(items, at, key)  the item the key 1-9, C, B, P or E goes to (next one of that kind after `at`)
 *   credit(song, licence)   "CCLI Song # 22025 · © 1779 Public Domain · CCLI Licence # 123456" */
(function(root){
'use strict';
var LABEL = /^\s*[\[(]?\s*((?:verse|chorus|refrain|bridge|pre-?chorus|tag|ending|intro|outro|coda|interlude|stanza|vamp)\b[^\])\]:]{0,14}|[vcbp]\d{0,2})\s*[\])]?\s*:?\s*$/i;
var SHORT = {v: 'Verse', c: 'Chorus', b: 'Bridge', p: 'Pre-Chorus', e: 'Ending', t: 'Tag', i: 'Intro', o: 'Outro'};

function cap(s){ s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
/* "v1" → "Verse 1", "c" → "Chorus", "pre-chorus" → "Pre-Chorus", "verse 2" → "Verse 2" */
function niceLabel(raw){
  var s = String(raw || '').trim(), m = s.match(/^([vcbpetio])(\d{0,2})$/i);
  if (m) return SHORT[m[1].toLowerCase()] + (m[2] ? ' ' + m[2] : '');
  s = s.replace(/\s+/g, ' ');
  if (/^pre-?chorus/i.test(s)) return 'Pre-Chorus' + s.replace(/^pre-?chorus/i, '');
  return cap(s);
}
function cleanLines(lines){
  var out = lines.map(function(x){ return String(x).replace(/\s+$/, ''); });
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
}
function blank(){ return {title: '', author: '', ccli: '', copyright: '', key: '', sections: [], order: []}; }
function numberVerses(song){
  var n = 0;
  song.sections.forEach(function(s){
    var m = /^verse\s*(\d+)/i.exec(s.label || '');
    if (m) n = Math.max(n, Number(m[1]));
    else if (!s.label){ n++; s.label = 'Verse ' + n; }
  });
  return song;
}

/* ---------- plain text ---------- */
var META = /^\s*(title|author|artist|words|music|ccli(?:\s*(?:song)?\s*(?:#|no\.?|number)?)?|copyright|©|key)\s*[:#]\s*(.+)$/i;
function fromText(text){
  var song = blank(), lines = String(text || '').replace(/\r\n?/g, '\n').split('\n'), i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  for (; i < lines.length; i++){                                  // the details at the top, if any
    var m = lines[i].match(META); if (!m) break;
    var k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'title') song.title = v;
    else if (/^(author|artist|words|music)$/.test(k)) song.author = song.author ? song.author + ', ' + v : v;
    else if (/^ccli/.test(k)) song.ccli = v.replace(/[^0-9]/g, '');
    else if (k === 'key') song.key = v;
    else song.copyright = v.replace(/^©\s*/, '');
  }
  var cur = null;
  function flush(){ if (cur){ var t = cleanLines(cur.lines); if (t) song.sections.push({label: cur.label, text: t}); } cur = null; }
  for (; i < lines.length; i++){
    var line = lines[i], lab = line.match(LABEL);
    if (lab && line.trim().length <= 24){ flush(); cur = {label: niceLabel(lab[1]), lines: []}; continue; }
    if (/^\s*(order|sequence)\s*:/i.test(line)){ song.order = parseOrder(line.replace(/^\s*(order|sequence)\s*:/i, '')); continue; }
    if (!line.trim()){ if (cur && cur.lines.some(function(x){ return x.trim(); })) flush(); continue; }
    if (!cur) cur = {label: '', lines: []};
    cur.lines.push(line);
  }
  flush();
  return numberVerses(song);
}

/* ---------- ChordPro ---------- */
function fromChordPro(text){
  var song = blank(), cur = null, inBlock = '';
  function flush(){ if (cur){ var t = cleanLines(cur.lines); if (t) song.sections.push({label: cur.label, text: t}); } cur = null; }
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(function(raw){
    var d = raw.match(/^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i);
    if (d){
      var k = d[1].toLowerCase(), v = (d[2] || '').trim();
      if (k === 'title' || k === 't') song.title = v;
      else if (k === 'artist' || k === 'composer' || k === 'lyricist' || k === 'subtitle' || k === 'st') song.author = song.author ? song.author + ', ' + v : v;
      else if (k === 'ccli') song.ccli = v.replace(/[^0-9]/g, '');
      else if (k === 'copyright') song.copyright = v.replace(/^©\s*/, '');
      else if (k === 'key') song.key = v;
      else if (/^(start_of_chorus|soc)$/.test(k)){ flush(); inBlock = 'chorus'; cur = {label: v || 'Chorus', lines: []}; }
      else if (/^(start_of_verse|sov)$/.test(k)){ flush(); inBlock = 'verse'; cur = {label: v ? niceLabel(v) : '', lines: []}; }
      else if (/^(start_of_bridge|sob)$/.test(k)){ flush(); inBlock = 'bridge'; cur = {label: v || 'Bridge', lines: []}; }
      else if (/^(end_of_chorus|eoc|end_of_verse|eov|end_of_bridge|eob)$/.test(k)){ flush(); inBlock = ''; }
      else if (/^(comment|c|comment_italic|ci|comment_box|cb)$/.test(k)){ flush(); if (LABEL.test(v)) cur = {label: niceLabel(v.match(LABEL)[1]), lines: []}; }
      return;
    }
    if (/^\s*#/.test(raw)) return;                                 // a ChordPro comment line
    var line = raw.replace(/\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ');
    if (!line.trim()){ if (!inBlock && cur && cur.lines.some(function(x){ return x.trim(); })) flush(); return; }
    var lab = line.match(LABEL);
    if (lab && !inBlock && line.trim().length <= 24){ flush(); cur = {label: niceLabel(lab[1]), lines: []}; return; }
    if (!cur) cur = {label: '', lines: []};
    cur.lines.push(line.trim());
  });
  flush();
  return numberVerses(song);
}

/* ---------- OpenLyrics ---------- */
function xmlText(s){
  return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<comment>[\s\S]*?<\/comment>/gi, '').replace(/<chord[^>]*\/>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function tag(xml, name){ var m = String(xml).match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i')); return m ? m[1] : ''; }
function fromOpenLyrics(xml){
  var song = blank(), props = tag(xml, 'properties');
  song.title = xmlText(tag(tag(props, 'titles'), 'title')).trim();
  var authors = []; String(tag(props, 'authors')).replace(/<author[^>]*>([\s\S]*?)<\/author>/gi, function(_, a){ authors.push(xmlText(a).trim()); });
  song.author = authors.filter(Boolean).join(', ');
  song.ccli = xmlText(tag(props, 'ccliNo')).replace(/[^0-9]/g, '');
  song.copyright = xmlText(tag(props, 'copyright')).trim();
  song.key = xmlText(tag(props, 'key')).trim();
  var names = {};
  String(tag(xml, 'lyrics')).replace(/<verse\s+[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/gi, function(_, name, body){
    var lines = []; body.replace(/<lines[^>]*>([\s\S]*?)<\/lines>/gi, function(__, l){ lines.push(xmlText(l).split('\n').map(function(x){ return x.trim(); }).join('\n')); });
    var text = cleanLines(lines.join('\n').split('\n'));
    if (!text) return;
    var label = niceLabel(name.replace(/^([a-z])(\d*)[a-z]?$/i, '$1$2'));
    names[name.toLowerCase()] = label;
    song.sections.push({label: label, text: text});
  });
  var order = xmlText(tag(props, 'verseOrder')).trim();
  if (order) song.order = order.split(/\s+/).map(function(n){ return names[n.toLowerCase()] || niceLabel(n); });
  return song;
}

/* ---------- a PowerPoint's slides ---------- */
function fromSlides(slides, title){
  var song = blank(); song.title = String(title || '').replace(/\.(pptx?|pdf)$/i, '');
  (slides || []).forEach(function(s){
    var t = cleanLines(String((s && s.text) || '').split('\n'));
    var head = String((s && s.title) || '').trim(), lab = head.match(LABEL);
    if (!song.title && head && !lab && !song.sections.length){ song.title = head; if (!t) return; }
    if (!t) return;
    song.sections.push({label: lab ? niceLabel(lab[1]) : '', text: t});
  });
  return numberVerses(song);
}

/* ---------- order and layout ---------- */
function parseOrder(s){
  return String(s || '').split(/[\s,]+/).filter(Boolean).map(function(x){ return niceLabel(x.replace(/[^a-z0-9-]/gi, '')); }).filter(Boolean);
}
function findSection(sections, label){
  var l = String(label || '').toLowerCase();
  for (var i = 0; i < sections.length; i++) if (sections[i].label.toLowerCase() === l) return sections[i];
  for (var j = 0; j < sections.length; j++) if (sections[j].label.toLowerCase().indexOf(l) === 0) return sections[j];   // "Chorus" finds "Chorus 1"
  return null;
}
/* the song as the screen shows it: one item per part, in the arrangement (sections not named are left out); no
   arrangement: the sections as written */
function arrange(song){
  var secs = (song && song.sections) || [], order = (song && song.order) || [], out = [];
  if (order.length){
    order.forEach(function(lab){ var s = findSection(secs, lab); if (s) out.push({label: s.label, text: s.text}); });
    if (out.length) return out;
  }
  return secs.map(function(s){ return {label: s.label, text: s.text}; });
}
/* the key pressed while a song is on screen: 1-9 a verse, C chorus, B bridge, P pre-chorus, E ending (or tag);
   the next one after the part on screen, else the first. -1: no such part */
function jumpTo(items, at, key){
  var k = String(key || '').toLowerCase(), test;
  if (/^[1-9]$/.test(k)) test = function(l){ return new RegExp('^verse\\s*' + k + '\\b', 'i').test(l); };
  else if (k === 'c') test = function(l){ return /^(chorus|refrain)/i.test(l); };
  else if (k === 'b') test = function(l){ return /^bridge/i.test(l); };
  else if (k === 'p') test = function(l){ return /^pre-?chorus/i.test(l); };
  else if (k === 'e') test = function(l){ return /^(ending|tag|outro|coda)/i.test(l); };
  else return -1;
  var n = (items || []).length;
  for (var d = 1; d <= n; d++){ var i = ((at || 0) + d) % n; if (test(String(items[i].label || ''))) return i; }
  return -1;
}
function credit(song, licence){
  var bits = [];
  if (song && song.ccli) bits.push('CCLI Song # ' + song.ccli);
  if (song && song.copyright) bits.push('© ' + String(song.copyright).replace(/^©\s*/, ''));
  if (licence && String(licence).trim()) bits.push('CCLI Licence # ' + String(licence).trim());
  return bits.join(' · ');
}
/* the song as text again (for the editor): details, sections with their labels, the order */
function toText(song){
  var out = [];
  song.sections.forEach(function(s){ out.push('[' + s.label + ']'); out.push(s.text); out.push(''); });
  return out.join('\n').trim();
}
/* pick the reader from the file's name and content */
function fromFile(name, text){
  var n = String(name || '').toLowerCase();
  if (/\.xml$/.test(n) || /<song[\s>]/i.test(text)) return fromOpenLyrics(text);
  if (/\.(cho|chordpro|chopro|crd|pro)$/.test(n) || /\{\s*(title|t|soc|start_of_chorus)\s*[:}]/i.test(text)) return fromChordPro(text);
  var s = fromText(text);
  if (!s.title) s.title = String(name || '').replace(/\.[^.]+$/, '');
  return s;
}

var API = {fromText: fromText, fromChordPro: fromChordPro, fromOpenLyrics: fromOpenLyrics, fromSlides: fromSlides, fromFile: fromFile,
  arrange: arrange, parseOrder: parseOrder, jumpTo: jumpTo, credit: credit, toText: toText, niceLabel: niceLabel};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.KCSongsLib = API;
})(typeof window !== 'undefined' ? window : this);
