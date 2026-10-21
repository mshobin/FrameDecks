/* FrameDecks - the saved document as sync entities, and back (SaaS Phase 1; docs/project/saas-pwa-architecture.md §7, §11).
 *
 * split(doc)              -> {entities: [{kind, id, body}], local: {...}}
 * join(entities, local)   -> the document again (the same JSON, key order aside: tests/entities.test.js)
 * changes(before, after)  -> {upserts: [entity], deletes: [{kind, id}]}   (what a sync push would send)
 *
 * doc is a normalized state (KCStore.normalize). The cloud only ever receives entities; `local` stays on this
 * computer: what is live, the revision, and the cards' current text (the birthday person's name among it).
 *
 * Kinds (the D1 entities.kind list):
 *   frame / template   one per Frame (tpl = template), the whole Frame: its Decks, its Content and their lists
 *   order              one: the running order of the Frames and of the library lists, so inserting a Frame
 *                      changes that Frame and the order, never every Frame after it
 *   library_question / library_verse   one per saved question / scripture
 *   theme              one ('cards'): how the question, scripture and birthday cards look
 *   brand, layout, meeting, profile    one each
 * The same mapping is in framedecks_app/lib/engine/entities.dart; tests/fixtures/entities/ holds the shared cases. */
(function(root){
'use strict';

/* What a card shows right now (live, never synced); every other card field is its look (the theme entity) */
var CARD_LIVE = {
  question: ['text', 'visible', 'seq', 'cut', 'itemId', 'mode', 'play', 'upcoming', 'out'],
  verse: ['text', 'ref', 'version', 'visible', 'seq', 'cut', 'itemId', 'play', 'upcoming', 'out'],
  birthday: ['name', 'greeting', 'message', 'country', 'visible', 'seq', 'cut', 'out']
};
var CARDS = ['question', 'verse', 'birthday'];
var SINGLE = ['brand', 'layout', 'meeting'];                     // one entity each, the block as it is

function copy(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function isObj(o){ return o && typeof o === 'object' && !Array.isArray(o); }
/* JSON with sorted keys: equal documents give equal text whatever order their keys were written in */
function canon(v){
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).filter(function(k){ return v[k] !== undefined; }).sort()      // as JSON: no undefined
    .map(function(k){ return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
/* list items -> entity ids, unique within the list (a repeated id gets #2, #3… so nothing is lost) */
function ids(list){
  var seen = {};
  return list.map(function(it, i){
    var id = String(it && it.id != null && it.id !== '' ? it.id : '#' + i);
    seen[id] = (seen[id] || 0) + 1;
    return seen[id] > 1 ? id + '#' + seen[id] : id;
  });
}

function split(doc){
  var d = copy(doc), out = [];
  function add(kind, id, body){ out.push({kind: kind, id: String(id), body: body}); }
  var scenes = Array.isArray(d.scenes) ? d.scenes : [], sceneIds = ids(scenes);
  scenes.forEach(function(sc, i){ add(sc && sc.tpl ? 'template' : 'frame', sceneIds[i], sc); });
  var lib = isObj(d.library) ? d.library : {}, qs = Array.isArray(lib.questions) ? lib.questions : [], vs = Array.isArray(lib.verses) ? lib.verses : [];
  var qIds = ids(qs), vIds = ids(vs);
  qs.forEach(function(it, i){ add('library_question', qIds[i], it); });
  vs.forEach(function(it, i){ add('library_verse', vIds[i], it); });
  add('order', 'order', {scenes: sceneIds, questions: qIds, verses: vIds});
  var theme = {};
  CARDS.forEach(function(k){
    if (!isObj(d[k])) return;
    theme[k] = {};
    Object.keys(d[k]).forEach(function(f){ if (CARD_LIVE[k].indexOf(f) < 0) theme[k][f] = d[k][f]; });
  });
  add('theme', 'cards', theme);
  SINGLE.forEach(function(k){ if (d[k] !== undefined) add(k, k, d[k]); });
  if (d.profile !== undefined) add('profile', 'profile', {value: d.profile});
  // what stays here: everything not sent above
  var local = {};
  Object.keys(d).forEach(function(k){
    if (k === 'scenes' || k === 'profile' || SINGLE.indexOf(k) >= 0) return;
    if (k === 'library'){
      var rest = {}; Object.keys(lib).forEach(function(f){ if (f !== 'questions' && f !== 'verses') rest[f] = lib[f]; });
      local.library = rest; return;
    }
    if (CARDS.indexOf(k) >= 0 && isObj(d[k])){
      var live = {}; CARD_LIVE[k].forEach(function(f){ if (f in d[k]) live[f] = d[k][f]; });
      local[k] = live; return;
    }
    local[k] = d[k];
  });
  local.keys = Object.keys(d);                       // the document's own key order, so join writes it back the same
  return {entities: out, local: local};
}

function join(entities, local){
  local = copy(local) || {};
  var by = {};
  (entities || []).forEach(function(e){ if (e && e.body != null) (by[e.kind] = by[e.kind] || {})[e.id] = e; });   // an empty entity is no entity
  function body(kind, id){ var e = by[kind] && by[kind][id]; return e ? copy(e.body) : undefined; }
  var order = body('order', 'order') || {scenes: [], questions: [], verses: []};
  var d = {};
  var keys = Array.isArray(local.keys) ? local.keys : [];
  delete local.keys;
  var parts = {};
  parts.scenes = order.scenes.map(function(id){ return body('frame', id) || body('template', id); }).filter(Boolean);
  // Frames the order does not know yet (added on another computer before its order arrived) go at the end
  ['frame', 'template'].forEach(function(kind){
    Object.keys(by[kind] || {}).forEach(function(id){ if (order.scenes.indexOf(id) < 0) parts.scenes.push(copy(by[kind][id].body)); });
  });
  function list(kind, idsInOrder){
    var got = idsInOrder.map(function(id){ return body(kind, id); }).filter(Boolean);
    Object.keys(by[kind] || {}).forEach(function(id){ if (idsInOrder.indexOf(id) < 0) got.push(copy(by[kind][id].body)); });
    return got;
  }
  parts.library = Object.assign({verses: list('library_verse', order.verses), questions: list('library_question', order.questions)}, local.library || {});
  var theme = body('theme', 'cards') || {};
  CARDS.forEach(function(k){
    if (local[k] === undefined && theme[k] === undefined) return;
    parts[k] = Object.assign({}, theme[k] || {}, local[k] || {});
  });
  SINGLE.forEach(function(k){ var b = body(k, k); if (b !== undefined) parts[k] = b; });
  var p = body('profile', 'profile'); if (p !== undefined) parts.profile = p.value;
  Object.keys(local).forEach(function(k){ if (!(k in parts) && k !== 'library' && CARDS.indexOf(k) < 0) parts[k] = local[k]; });
  keys.forEach(function(k){ if (k in parts) d[k] = parts[k]; });
  Object.keys(parts).forEach(function(k){ if (!(k in d)) d[k] = parts[k]; });
  return d;
}

/* What changed between two entity lists: the entities to send, and the ones that are gone */
function changes(before, after){
  var old = {}, now = {}, upserts = [], deletes = [];
  (before || []).forEach(function(e){ old[e.kind + '\u0000' + e.id] = canon(e.body); });
  (after || []).forEach(function(e){ var k = e.kind + '\u0000' + e.id; now[k] = 1; if (old[k] !== canon(e.body)) upserts.push(e); });
  (before || []).forEach(function(e){ if (!now[e.kind + '\u0000' + e.id]) deletes.push({kind: e.kind, id: e.id}); });
  return {upserts: upserts, deletes: deletes};
}

var api = {split: split, join: join, changes: changes, canon: canon, KINDS: ['frame', 'template', 'order', 'theme', 'library_verse',
  'library_question', 'brand', 'profile', 'layout', 'meeting', 'members'], CARD_LIVE: CARD_LIVE};
root.KCEntities = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
