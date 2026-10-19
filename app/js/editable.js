/* Kingdom Connect v6.7 - EditableField: one way to edit text in place, everywhere.
 *
 *   BSFEditable.inline(el, opts)   the element's text becomes an editor in the same spot (lists, names, labels)
 *   BSFEditable.float(host, rect, opts)   an editor floating over something drawn elsewhere (canvas cards)
 *   BSFEditable.bind(el, opts)     double-click (or F2 / Enter while focused) starts BSFEditable.inline
 *
 * The same keys everywhere: Enter saves, Shift+Enter starts a new line (multi-line fields), Esc cancels, and
 * clicking away saves. Keys never reach the meeting shortcuts while editing.
 *
 * opts: value, multiline, placeholder, maxLength, label (accessible name), title (heading shown in a float),
 *       fields (float only: extra one-line fields [{key, value, placeholder, label, width}]),
 *       enterNewline (long texts such as a teleprompter script: Enter = new line, Ctrl+Enter saves),
 *       save(value, extra) -> promise | value   called only when something changed,
 *       cancel(), done()                         after closing either way. */
(function(){
'use strict';
var current = null;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function fit(ta, max){ if (ta.tagName !== 'TEXTAREA') return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, max || 320) + 'px'; }

/* The shared engine: keys, click-away, save / cancel. `fields` are the inputs; the first one holds `value`. */
function session(o, root, fields, restore){
  var closed = false;
  function values(){ var x = {}; fields.forEach(function(f){ x[f.key] = f.el.value; }); return x; }
  var before = values();
  function close(save){
    if (closed) return; closed = true;
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('blur', onBlurWin);
    if (current && current.close === close) current = null;
    var now = values();
    restore();
    setTimeout(function(){ window.dispatchEvent(new Event('bsf-edit-done')); }, 0);
    var changed = Object.keys(now).some(function(k){ return now[k] !== before[k]; });
    if (save && changed && o.save){
      var main = now.value.replace(/\s+$/, ''); delete now.value;
      Promise.resolve(o.save(o.multiline ? main : main.trim(), now)).catch(function(){}).then(function(){ if (o.done) o.done(true); });
    } else { if (!save && o.cancel) o.cancel(); if (o.done) o.done(false); }
  }
  function outside(e){ if (!root.contains(e.target)) close(true); }
  function onBlurWin(){ /* switching windows keeps the editor open */ }
  fields.forEach(function(f){
    f.el.addEventListener('keydown', function(e){
      e.stopPropagation();                                         // meeting shortcuts stay quiet while typing
      if (e.key === 'Escape'){ e.preventDefault(); close(false); }
      else if (e.key === 'Enter' && !e.isComposing){
        var newline = f.multiline && (e.shiftKey || (o.enterNewline && !(e.ctrlKey || e.metaKey)));   // scripts: Enter = new line, Ctrl+Enter saves
        if (!newline){ e.preventDefault(); close(true); }
      }
    });
    f.el.addEventListener('keyup', function(e){ e.stopPropagation(); });
    if (f.multiline) f.el.addEventListener('input', function(){ fit(f.el); });
  });
  setTimeout(function(){ if (!closed) document.addEventListener('pointerdown', outside, true); }, 0);
  window.addEventListener('blur', onBlurWin);
  if (current) current.close(true);                                // one editor at a time; the old one saves
  current = {close: close, root: root};
  return current;
}
function input(o, extra){
  var multi = !!(extra ? extra.multiline : o.multiline);
  var el = multi ? h('textarea', {rows: 1, cls: 'ef-input ef-multi', 'aria-label': (extra && extra.label) || o.label || 'Edit', placeholder: (extra && extra.placeholder) || o.placeholder || ''})
                 : h('input', {type: 'text', cls: 'ef-input', 'aria-label': (extra && extra.label) || o.label || 'Edit', placeholder: (extra && extra.placeholder) || o.placeholder || ''});
  var max = (extra && extra.maxLength) || o.maxLength; if (max) el.maxLength = max;
  el.value = String((extra ? extra.value : o.value) || '');
  return {el: el, key: extra ? extra.key : 'value', multiline: multi};
}

var E = {
  active: function(){ return !!current; },
  /* is an editor open inside this element? (lists skip redrawing under it, then redraw when it closes) */
  within: function(el){ return !!(current && el && el.contains(current.root)); },
  close: function(save){ if (current) current.close(save !== false); },
  /* In place: the element is hidden and an input with the same text and font takes its spot. */
  inline: function(el, o){
    o = o || {};
    var f = input(o), cs = getComputedStyle(el);
    f.el.classList.add('ef-inline');
    ['fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'textTransform'].forEach(function(p){ f.el.style[p] = cs[p]; });
    var w = el.getBoundingClientRect().width;
    if (!o.multiline) f.el.style.minWidth = Math.max(80, Math.min(w + 24, 520)) + 'px';
    el.hidden = true; el.parentNode.insertBefore(f.el, el.nextSibling);
    var wrap = f.el;
    var s = session(o, wrap, [f], function(){ if (f.el.parentNode) f.el.remove(); el.hidden = false; });
    fit(f.el); f.el.focus(); if (o.selectAll !== false) f.el.select(); else f.el.setSelectionRange(f.el.value.length, f.el.value.length);
    return s;
  },
  /* Floating over a rect (in host's coordinates): a small card with a heading, optional extra fields and the text. */
  float: function(host, rect, o){
    o = o || {};
    var extras = (o.fields || []).map(function(x){ return input(o, x); });
    var f = input(o);
    if (o.serif) f.el.classList.add('serif');
    var row = extras.length ? h('div', {cls: 'ef-row'}, extras.map(function(x, i){ var w = (o.fields[i] || {}).width; if (w) x.el.style.flex = '0 0 ' + w; return x.el; })) : null;
    var box = h('div', {cls: 'pv-ed ef-float', role: 'dialog', 'aria-label': o.title || 'Edit'}, [
      h('div', {cls: 'pv-head'}, [h('b', {text: o.title || 'Edit'}), h('span', {cls: 'hint', text: (f.multiline ? 'Enter saves · Shift+Enter new line' : 'Enter saves') + ' · Esc cancels'})]),
      row, f.el,
      h('div', {cls: 'pv-acts'}, [
        h('button', {cls: 'btn small', type: 'button', text: 'Cancel', onclick: function(){ s.close(false); }}),
        h('button', {cls: 'btn small primary', type: 'button', text: 'Save', onclick: function(){ s.close(true); }})])]);
    host.appendChild(box);
    var W = host.clientWidth, H = host.clientHeight;
    var w = Math.min(Math.max(rect.width, o.multiline ? 380 : 300), W - 16);
    box.style.width = w + 'px';
    box.style.left = Math.max(8, Math.min(rect.left + (rect.width - w) / 2, W - w - 8)) + host.scrollLeft + 'px';
    fit(f.el);
    box.style.top = Math.max(8, Math.min(rect.top, H - box.offsetHeight - 8)) + host.scrollTop + 'px';
    var s = session(o, box, [f].concat(extras), function(){ box.remove(); window.removeEventListener('resize', onResize); });
    function onResize(){ s.close(true); }
    window.addEventListener('resize', onResize);
    var first = o.focus === 'first' && extras.length ? extras[0].el : f.el;
    first.focus(); first.setSelectionRange(first.value.length, first.value.length);
    return s;
  },
  /* Double-click (or F2 / Enter on a focusable element) to edit in place. opts.value may be a function. */
  bind: function(el, o){
    function go(e){
      if (e){ e.preventDefault(); e.stopPropagation(); }
      var v = typeof o.value === 'function' ? o.value() : o.value;
      E.inline(el, Object.assign({}, o, {value: v}));
    }
    el.classList.add('ef-target');
    if (!el.title) el.title = 'Double-click to edit';
    el.addEventListener('dblclick', go);
    el.addEventListener('keydown', function(e){ if (e.key === 'F2'){ go(e); } });
    return go;
  }
};
window.BSFEditable = E;
})();
