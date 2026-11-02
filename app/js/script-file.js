/* FrameDecks 8.2 - a script from a file: .txt, .md or a Word .docx (the Teleprompter's Upload).
 * KCScriptFile.read(file) → Promise<string> in the Teleprompter's markup (# Heading, - bullet, **bold**).
 * A .docx is a zip: its central directory is read here and word/document.xml inflated with the browser's own
 * DecompressionStream, so no library is loaded. Only text comes out: headings, list items, bold, line breaks. */
(function(){
'use strict';
var MAX = 20000;                                  // the script's limit in the shared state (store.js)
function u16(b, i){ return b[i] | (b[i + 1] << 8); }
function u32(b, i){ return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

/* one file out of a zip (stored or deflated) */
function unzip(buf, name){
  var b = new Uint8Array(buf), end = -1;
  for (var i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (u32(b, i) === 0x06054b50){ end = i; break; }
  if (end < 0) return Promise.reject(new Error('This is not a Word document (.docx).'));
  var count = u16(b, end + 10), p = u32(b, end + 16);
  for (var n = 0; n < count && p + 46 <= b.length; n++){
    if (u32(b, p) !== 0x02014b50) break;
    var method = u16(b, p + 10), size = u32(b, p + 20), nameLen = u16(b, p + 28), extra = u16(b, p + 30), comment = u16(b, p + 32), local = u32(b, p + 42);
    var fname = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    if (fname === name){
      var start = local + 30 + u16(b, local + 26) + u16(b, local + 28), data = b.subarray(start, start + size);
      if (method === 0) return Promise.resolve(data);
      if (method !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This Word document cannot be read here. Save it as .txt and upload that.'));
      var ds = new DecompressionStream('deflate-raw');
      return new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer().then(function(a){ return new Uint8Array(a); });
    }
    p += 46 + nameLen + extra + comment;
  }
  return Promise.reject(new Error('This Word document has no text.'));
}

/* word/document.xml → the Teleprompter's markup */
function docxText(xml){
  var doc = new DOMParser().parseFromString(xml, 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var out = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'p'), function(p){
    var style = p.getElementsByTagNameNS(W, 'pStyle')[0], sv = style ? (style.getAttributeNS(W, 'val') || style.getAttribute('w:val') || '') : '';
    var list = p.getElementsByTagNameNS(W, 'numPr').length > 0, line = '';
    Array.prototype.forEach.call(p.getElementsByTagNameNS(W, 'r'), function(r){
      var bold = r.getElementsByTagNameNS(W, 'b').length > 0, t = '';
      Array.prototype.forEach.call(r.childNodes, function(c){
        if (c.localName === 't') t += c.textContent;
        else if (c.localName === 'tab') t += ' ';
        else if (c.localName === 'br') t += '\n';
      });
      line += bold && t.trim() ? '**' + t + '**' : t;
    });
    line = line.replace(/\*\*\*\*/g, '');
    if (/^(heading|title)/i.test(sv) && line.trim()) line = '# ' + line.replace(/\*\*/g, '');
    else if (list && line.trim()) line = '- ' + line;
    out.push(line);
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function read(file){
  if (!file) return Promise.reject(new Error('Choose a file.'));
  var name = String(file.name || '').toLowerCase();
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error('That file is too large for a script.'));
  if (/\.docx$/.test(name)){
    return file.arrayBuffer().then(function(buf){ return unzip(buf, 'word/document.xml'); })
      .then(function(u8){ return docxText(new TextDecoder().decode(u8)).slice(0, MAX); });
  }
  if (/\.(txt|md|markdown|text)$/.test(name) || /^text\//.test(file.type || '')){
    return file.text().then(function(t){ return String(t).replace(/\r\n?/g, '\n').replace(/^﻿/, '').slice(0, MAX); });
  }
  return Promise.reject(new Error('Choose a .txt, .md or Word (.docx) file.'));
}
window.KCScriptFile = {read: read, docxText: docxText, ACCEPT: '.txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
})();
