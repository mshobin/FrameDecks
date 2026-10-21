/// Frames (scenes), Content (layers) and the live program: store.js `Scenes` and `Present`, ported function by
/// function. Every operation edits a state document in place, like the JavaScript does inside Store.update().
library;

import 'dart:math';

import 'model.dart';
import 'normalize.dart';

/// The time source (milliseconds since 1970). Tests set it, so `live.at` and countdowns are predictable.
int Function() nowMs = () => DateTime.now().millisecondsSinceEpoch;

/// Random choices (random card effects). Tests may replace it.
Random rng = Random();

List<Json> scenesOf(Json st) => (st['scenes'] as List).cast<Json>();
List<Json> layersOf(Json sc) => (sc['layers'] as List).cast<Json>();
Json cOf(Json l) => l['c'] as Json;
Json liveOf(Json st) => st['live'] as Json;

bool isCard(String k) => cardKinds.contains(k);
bool isText(String k) => textKinds.contains(k);
bool isMedia(String k) => mediaKinds.contains(k);

Json? findScene(Json st, Object? id) {
  for (final sc in scenesOf(st)) {
    if (sc['id'] == id) return sc;
  }
  return null;
}

Json? layerOf(Json? sc, Object? id) {
  if (sc == null) return null;
  for (final l in layersOf(sc)) {
    if (l['id'] == id) return l;
  }
  return null;
}

Json? firstOf(Json? sc, String kind) {
  if (sc == null) return null;
  for (final l in layersOf(sc)) {
    if (l['kind'] == kind) return l;
  }
  return null;
}

Json? liveScene(Json st) => findScene(st, liveOf(st)['scene']);

// ---------- FrameDecks: Frame -> Deck -> Content ----------
// A Frame holds one or more Decks; one Deck of the live Frame is on screen at a time (live.deck). Each Content names
// its Deck (layer.deck); the Content stays one list per Frame, as store.js keeps it.

/// A Frame's Decks (a Frame made before its first save gets its "Deck 1" here).
List<Json> decksOf(Json sc) {
  if (sc['decks'] is! List || (sc['decks'] as List).isEmpty) sc['decks'] = cleanDecks(sc['decks']);
  return (sc['decks'] as List).cast<Json>();
}

Json? deckById(Json? sc, Object? id) {
  if (sc == null) return null;
  for (final d in decksOf(sc)) {
    if (d['id'] == id) return d;
  }
  return null;
}

/// The Deck a Content belongs to (Content added without one belongs to the first Deck).
String deckOf(Json sc, Json l) => deckById(sc, l['deck']) != null ? l['deck'] as String : decksOf(sc).first['id'] as String;

/// Gives every Content of every Frame a valid Deck (the backends run it before saving, like Store.update).
void fixDecks(Json st) {
  for (final sc in (st['scenes'] as List? ?? const []).cast<Json>()) {
    for (final l in layersOf(sc)) {
      l['deck'] = deckOf(sc, l);
    }
  }
}

/// The Deck of this Frame that is (or would be) on screen: the live Deck of the live Frame, else the first.
String liveDeckId(Json st, Json? sc) {
  if (sc == null) return '';
  return liveOf(st)['scene'] == sc['id'] && deckById(sc, liveOf(st)['deck']) != null
      ? liveOf(st)['deck'] as String
      : decksOf(sc).first['id'] as String;
}

List<Json> deckLayers(Json? sc, Object? deckId) => sc == null ? const [] : layersOf(sc).where((l) => deckOf(sc, l) == deckId).toList();

int deckIndex(Json? sc, Object? deckId) {
  final a = sc == null ? const <Json>[] : decksOf(sc);
  for (var i = 0; i < a.length; i++) {
    if (a[i]['id'] == deckId) return i;
  }
  return -1;
}

/// The first Content of a kind in one Deck.
Json? firstIn(Json? sc, Object? deckId, String kind) {
  if (sc == null) return null;
  for (final l in layersOf(sc)) {
    if (l['kind'] == kind && deckOf(sc, l) == deckId) return l;
  }
  return null;
}

Json addDeck(Json sc, [String? name, Object? afterId]) {
  final decks = decksOf(sc);
  final used = {for (final d in decks) (d['name'] as String).toLowerCase()};
  var nm = name ?? '';
  var k = decks.length + 1;
  while (nm.isEmpty || used.contains(nm.toLowerCase())) {
    nm = 'Deck ${k++}';
  }
  final d = <String, dynamic>{'id': rid('d'), 'name': str(nm, 60)};
  final i = deckIndex(sc, afterId);
  if (i < 0) {
    decks.add(d);
  } else {
    decks.insert(i + 1, d);
  }
  return d;
}

bool renameDeck(Json sc, Object? id, String? name) {
  final d = deckById(sc, id);
  if (d != null && (name ?? '').trim().isNotEmpty) d['name'] = str(name!.trim(), 60);
  return d != null;
}

/// Deletes a Deck and its Content (a Frame keeps at least one Deck); the live Deck moves to a neighbour.
bool removeDeck(Json n, Json sc, Object? id) {
  final i = deckIndex(sc, id);
  final decks = decksOf(sc);
  if (i < 0 || decks.length < 2) return false;
  fixDecks({
    'scenes': [sc],
  });
  final wasLive = liveOf(n)['scene'] == sc['id'] && liveDeckId(n, sc) == id;
  decks.removeAt(i);
  sc['layers'] = layersOf(sc).where((l) => l['deck'] != id).toList();
  if (wasLive) take(n, sc['id'], 'cut', decks[min(i, decks.length - 1)]['id'] as String);
  return true;
}

bool moveDeck(Json sc, Object? id, int d) {
  final i = deckIndex(sc, id), j = i + d;
  final decks = decksOf(sc);
  if (i < 0 || j < 0 || j >= decks.length) return false;
  final x = decks.removeAt(i);
  decks.insert(j, x);
  return true;
}

/// Moves Content to another Deck of the same Frame (the program follows when the Frame is live).
bool moveToDeck(Json n, Json sc, List<Object?> layerIds, Object? deckId) {
  if (deckById(sc, deckId) == null) return false;
  fixDecks({
    'scenes': [sc],
  });
  for (final l in layersOf(sc)) {
    if (layerIds.contains(l['id'])) l['deck'] = deckId;
  }
  if (liveOf(n)['scene'] == sc['id']) take(n, sc['id'], 'cut', liveDeckId(n, sc));
  return true;
}

/// Where Next (d = 1) or Previous (d = -1) goes: the live Frame's next Deck, else the next Frame (its first Deck;
/// going back, its last). Null at the end.
({Json scene, Json deck})? stepTarget(Json st, int d, [String? fromScene]) {
  final from = fromScene == null || fromScene == '' ? liveOf(st)['scene'] : fromScene;
  final s = findScene(st, from);
  if (s != null && (fromScene == null || fromScene == '' || fromScene == liveOf(st)['scene'])) {
    final i = deckIndex(s, liveDeckId(st, s)) + d;
    final decks = decksOf(s);
    if (liveOf(st)['scene'] == s['id'] && i >= 0 && i < decks.length) return (scene: s, deck: decks[i]);
  }
  final nx = neighbour(st, s?['id'] ?? '', d);
  if (nx == null) return null;
  final nd = decksOf(nx);
  return (scene: nx, deck: d < 0 && s != null ? nd.last : nd.first);
}

bool step(Json n, int d, [String? override]) {
  final t = stepTarget(n, d);
  if (t == null) return false;
  return take(n, t.scene['id'], override, t.deck['id'] as String);
}

/// The Frames you step through with Previous / Next (templates are not in the running order).
List<Json> order(Json st) => scenesOf(st).where((sc) => sc['tpl'] != true).toList();

Json? neighbour(Json st, Object? id, int d) {
  final o = order(st);
  var i = -1;
  for (var k = 0; k < o.length; k++) {
    if (o[k]['id'] == id) i = k;
  }
  final j = i < 0 ? (d > 0 ? 0 : o.length - 1) : i + d;
  return j >= 0 && j < o.length ? o[j] : null;
}

({String id, String name, String type, int ms}) profileOf(Json st) => profiles.firstWhere((p) => p.id == st['profile'], orElse: () => profiles[1]);

({String type, num ms}) transitionOf(Json st, Json? sc, [String? override]) {
  if (override != null && txIds.contains(override)) return (type: override, ms: override == 'cut' ? 0 : txMs[override]!);
  if (sc != null && (sc['tx'] as Json)['type'] != 'profile') {
    final t = (sc['tx'] as Json)['type'] as String;
    return (type: t, ms: t == 'cut' ? 0 : (sc['tx'] as Json)['ms'] as num);
  }
  final p = profileOf(st);
  return (type: p.type, ms: p.ms);
}

String txName(String id) => transitionsList.firstWhere((t) => t.$1 == id, orElse: () => (id, id)).$2;

void stamp(Json sc, [String? who]) {
  sc['modified'] = nowMs();
  sc['version'] = ((sc['version'] as num?) ?? 1) + 1;
  if (who != null && (sc['creator'] ?? '') == '') sc['creator'] = who;
}

String cardKind(String kind) => kind == 'verse' || kind == 'scripture' ? 'scripture' : 'question';

/// The live (or given) Frame's Question / Scripture Content that owns a list.
Json? owner(Json st, String kind, [String? sid]) {
  final sc = findScene(st, sid ?? liveOf(st)['scene']);
  final k = cardKind(kind);
  final l = firstIn(sc, liveDeckId(st, sc), k) ?? firstOf(sc, k); // the Deck on screen first
  return l != null && cOf(l)['items'] is List ? l : null;
}

List<Json> items(Json st, String kind, [String? sid]) {
  final l = owner(st, kind, sid);
  return l == null ? const [] : (cOf(l)['items'] as List).cast<Json>();
}

/// An item anywhere (ids are unique across Frames).
({Json item, Json layer, int index, Json scene})? itemById(Json st, String kind, Object? id) {
  if (id == null || id == '') return null;
  final k = cardKind(kind);
  for (final sc in scenesOf(st)) {
    for (final l in layersOf(sc)) {
      final its = cOf(l)['items'];
      if (l['kind'] != k || its is! List) continue;
      for (var m = 0; m < its.length; m++) {
        if ((its[m] as Json)['id'] == id) return (item: its[m] as Json, layer: l, index: m, scene: sc);
      }
    }
  }
  return null;
}

String newItemId(String kind) => rid(kind == 'question' ? 'q' : 'v');

// ---------- card effects (store.js resolveTransition) ----------
String _pickFrom(List<dynamic> pool, String? avoid) {
  var p = [
    for (final t in pool)
      if (cardTransitions.contains(t)) t as String,
  ];
  if (p.isEmpty) p = [...defaultPool];
  final c = p.length > 1 ? p.where((t) => t != avoid).toList() : p;
  return c[rng.nextInt(c.length)];
}

String _preference(Json st, String kind, Object? id) {
  final f = id == null || id == '' ? null : itemById(st, kind, id);
  final t = f?.item['transition'];
  if (t != null && t != '') return t as String;
  return (st[kind] as Json)['random'] == true ? 'random' : '';
}

String resolveTransition(Json st, String kind, Object? id) {
  final o = st[kind] as Json;
  final pref = _preference(st, kind, id);
  String play;
  if (pref == 'random') {
    final pool = [
      for (final t in (o['pool'] as List? ?? const []))
        if (cardTransitions.contains(t)) t,
    ];
    final up = o['upcoming'] as String? ?? '';
    play = (up.isNotEmpty && up != o['play'] && (pool.isEmpty || pool.contains(up)))
        ? up
        : _pickFrom(o['pool'] as List? ?? const [], o['play'] as String?);
    o['upcoming'] = _pickFrom(o['pool'] as List? ?? const [], play);
  } else {
    play = pref.isNotEmpty ? pref : o['transition'] as String;
  }
  o['play'] = play;
  return play;
}

// ---------- Present: Question · Both · Verse ----------
Json? presentItem(Json st, [Object? id]) => itemById(st, 'question', id ?? (st['question'] as Json)['itemId'])?.item;

String presentMode(Json st, [Object? id]) {
  final it = presentItem(st, id);
  final m = it != null && (it['mode'] ?? '') != '' ? it['mode'] : (st['question'] as Json)['mode'];
  return presentModes.contains(m) ? m as String : 'question';
}

Json? _verseFor(Json st) {
  final it = presentItem(st);
  final pair = it?['pair'];
  return pair != null && pair != '' ? itemById(st, 'verse', pair)?.item : null;
}

bool presentLive(Json st) {
  final m = presentMode(st);
  final q = st['question'] as Json, v = st['verse'] as Json;
  final qOn = q['visible'] == true && (q['text'] ?? '').toString().trim().isNotEmpty;
  final vOn = v['visible'] == true && (v['text'] ?? '').toString().trim().isNotEmpty;
  return m == 'verse' ? vOn : qOn;
}

void _presentOn(Json n, String kind) {
  final o = n[kind] as Json;
  if (o['visible'] != true) {
    resolveTransition(n, kind, o['itemId']);
    o['visible'] = true;
    o['seq'] = ((o['seq'] as num?) ?? 0) + 1;
  }
}

bool _presentLoadVerse(Json n) {
  final v = _verseFor(n);
  final verse = n['verse'] as Json;
  if (v != null && verse['itemId'] != v['id']) {
    verse['text'] = v['text'];
    verse['ref'] = v['ref'];
    verse['version'] = v['version'];
    verse['itemId'] = v['id'];
    verse['visible'] = false;
  }
  return (verse['text'] ?? '').toString().trim().isNotEmpty;
}

/// Right after a question became visible: completes the picture for its mode.
String presentAfterShow(Json n) {
  final m = presentMode(n);
  final q = n['question'] as Json;
  q['mode'] = m == 'question' && (q['mode'] ?? '') == '' ? '' : m;
  if (m == 'question') return m;
  if (_presentLoadVerse(n)) _presentOn(n, 'verse');
  if (m == 'verse') q['visible'] = false;
  return m;
}

// ---------- looks ----------
void applyLook(Json n, Json l) {
  final d = look[l['kind']];
  final lk = cOf(l)['look'];
  if (d == null || lk is! Map) return;
  final card = n[l['kind'] == 'scripture' ? 'verse' : 'question'] as Json;
  final layout = n['layout'] as Json;
  for (final k in d.layout) {
    if (lk[k] != null) layout[k] = lk[k];
  }
  for (final k in d.card) {
    if (lk[k] != null) card[k] = deepCopy(lk[k]);
  }
}

// ---------- live ----------
bool isLive(Json st, Object? sceneId) => sceneId != null && sceneId != '' && liveOf(st)['scene'] == sceneId;

/// Is this Content on the program right now?
bool layerOn(Json st, Json? sc, Json l) {
  if (sc == null || liveOf(st)['scene'] != sc['id']) return false;
  if (deckOf(sc, l) != liveDeckId(st, sc)) return false; // another Deck of the live Frame
  bool shown(String k, String f) => (st[k] as Json)['visible'] == true && ((st[k] as Json)[f] ?? '').toString().trim().isNotEmpty;
  switch (l['kind']) {
    case 'question':
      return shown('question', 'text');
    case 'scripture':
      return shown('verse', 'text');
    case 'birthday':
      return shown('birthday', 'greeting');
  }
  if (isText(l['kind'] as String)) return (liveOf(st)['on'] as Json)[l['id']] == true;
  return l['visible'] == true;
}

bool loadQuestion(Json n, Object? itemId) {
  final f = itemById(n, 'question', itemId);
  if (f == null) return false;
  final q = n['question'] as Json;
  q['text'] = f.item['text'];
  q['itemId'] = f.item['id'];
  cOf(f.layer)['itemId'] = f.item['id'];
  q['label'] = _firstNonEmpty([f.item['label'], cOf(f.layer)['label']], 'Discussion Question');
  return true;
}

bool loadVerse(Json n, Json l) {
  final a = cOf(l)['items'] is List ? (cOf(l)['items'] as List).cast<Json>() : const <Json>[];
  Json? it;
  for (final x in a) {
    if (x['id'] == cOf(l)['itemId']) it = x;
  }
  it ??= a.isEmpty ? null : a.first;
  if (it == null) return false;
  final v = n['verse'] as Json;
  v['text'] = it['text'];
  v['ref'] = it['ref'];
  v['version'] = it['version'];
  v['itemId'] = it['id'];
  cOf(l)['itemId'] = it['id'];
  v['label'] = _firstNonEmpty([it['label'], cOf(l)['label']], 'Focus Verse');
  return (it['text'] ?? '').toString().trim().isNotEmpty;
}

String _firstNonEmpty(List<Object?> xs, String d) {
  for (final x in xs) {
    if (x != null && x.toString().isNotEmpty) return x.toString();
  }
  return d;
}

String _firstQuestion(Json l) {
  final a = cOf(l)['items'] is List ? (cOf(l)['items'] as List).cast<Json>() : const <Json>[];
  for (final x in a) {
    if (x['id'] == cOf(l)['itemId']) return x['id'] as String;
  }
  return a.isEmpty ? '' : a.first['id'] as String;
}

void _showCard(Json n, String kind, bool cut) {
  final o = n[kind] as Json;
  if (kind != 'birthday') resolveTransition(n, kind, o['itemId']);
  o['visible'] = true;
  o['seq'] = ((o['seq'] as num?) ?? 0) + 1;
  if (cut) o['play'] = 'none';
}

/// Go Live: the Frame's Content decides what the cards show, and its transition plays (override = the top bar's choice).
bool take(Json n, Object? id, [String? override, String? deckId]) {
  final sc = findScene(n, id);
  if (sc == null) return false;
  final tx = transitionOf(n, sc, override);
  final cut = tx.type == 'cut';
  final dk = deckById(sc, deckId) != null ? deckId! : decksOf(sc).first['id'] as String; // only this Deck's Content shows
  final q = firstIn(sc, dk, 'question'), v = firstIn(sc, dk, 'scripture'), b = firstIn(sc, dk, 'birthday');
  final qOn = q != null && q['visible'] == true, vOn = v != null && v['visible'] == true;
  if (q != null) applyLook(n, q);
  if (v != null) applyLook(n, v);
  final out = sc['out'] as Json;
  bool vcamOk(Json? l) => out['vcam'] == true && (l == null || cOf(l)['vcam'] != false);
  bool obsOk(Json? l) => out['obs'] == true && (l == null || cOf(l)['obs'] != false);
  final question = n['question'] as Json, verse = n['verse'] as Json, birthday = n['birthday'] as Json;
  // question
  if (qOn && !loadQuestion(n, _firstQuestion(q))) {
    question['text'] = '';
    question['itemId'] = '';
  }
  if (qOn && (question['text'] ?? '').toString().trim().isNotEmpty) {
    question['mode'] = vOn ? 'both' : 'question';
    final it = presentItem(n);
    if (it != null && (it['mode'] ?? '') != '' && it['mode'] != question['mode']) it['mode'] = question['mode'];
    _showCard(n, 'question', cut);
  } else {
    question['visible'] = false;
  }
  // scripture
  if (vOn) {
    var had = loadVerse(n, v);
    if (!had && qOn && _presentLoadVerse(n)) had = true;
    if (!had) {
      verse['text'] = '';
      verse['itemId'] = '';
    }
    if ((verse['text'] ?? '').toString().trim().isNotEmpty) {
      _showCard(n, 'verse', cut);
    } else {
      verse['visible'] = false;
    }
  } else {
    verse['visible'] = false;
  }
  // birthday
  if (b != null && b['visible'] == true && (birthday['greeting'] ?? '').toString().trim().isNotEmpty) {
    birthday['visible'] = true;
    birthday['seq'] = ((birthday['seq'] as num?) ?? 0) + 1;
  } else {
    birthday['visible'] = false;
  }
  question['out'] = {'vcam': vcamOk(q), 'obs': obsOk(q)};
  verse['out'] = {'vcam': vcamOk(v), 'obs': obsOk(v)};
  birthday['out'] = {'vcam': vcamOk(b), 'obs': obsOk(b)};
  // text Content
  final live = liveOf(n);
  final on = <String, dynamic>{}, cd = <String, dynamic>{};
  for (final l in layersOf(sc)) {
    if (deckOf(sc, l) == dk && isText(l['kind'] as String) && l['visible'] == true) {
      on[l['id'] as String] = true;
      if (l['kind'] == 'countdown') cd[l['id'] as String] = nowMs();
    }
  }
  live['on'] = on;
  live['cd'] = cd;
  live['scene'] = sc['id'];
  live['deck'] = dk;
  live['seq'] = ((live['seq'] as num?) ?? 0) + 1;
  live['at'] = nowMs();
  live['tx'] = tx.type;
  live['txMs'] = tx.ms;
  return true;
}

/// What the program would show if this Frame (and Deck) were taken live now (store.js previewState).
Json previewState(Json st, Object? id, [String? deckId]) {
  final n = deepCopy(st);
  if (!take(n, id, 'cut', deckId)) return n;
  for (final k in ['question', 'verse']) {
    (n[k] as Json)['play'] = 'none';
  }
  final live = liveOf(n);
  live['blackout'] = false;
  live['emergency'] = false;
  live['freeze'] = false;
  return n;
}

/// Hide All: every card and text Content off; the Frame stays live, media stays (it is the picture).
void hideAll(Json n) {
  (n['verse'] as Json)['visible'] = false;
  (n['question'] as Json)['visible'] = false;
  (n['birthday'] as Json)['visible'] = false;
  liveOf(n)['on'] = <String, dynamic>{};
}

/// Show or hide one Content on the program (live Frame only).
void setOn(Json n, Object? sceneId, Object? layerId, bool on) {
  final sc = findScene(n, sceneId);
  final l = layerOf(sc, layerId);
  if (l == null || liveOf(n)['scene'] != sceneId) return;
  if (deckOf(sc!, l) != liveDeckId(n, sc)) {
    if (!isCard(l['kind'] as String) && !isText(l['kind'] as String)) l['visible'] = on; // another Deck: not on screen
    return;
  }
  final question = n['question'] as Json, verse = n['verse'] as Json, birthday = n['birthday'] as Json;
  switch (l['kind']) {
    case 'question':
      if (on) {
        loadQuestion(n, _firstQuestion(l));
        if ((question['text'] ?? '').toString().trim().isNotEmpty) _showCard(n, 'question', false);
      } else {
        question['visible'] = false;
      }
    case 'scripture':
      if (on) {
        final had = loadVerse(n, l);
        if (!had && (verse['text'] ?? '').toString().trim().isEmpty) _presentLoadVerse(n);
        if ((verse['text'] ?? '').toString().trim().isNotEmpty) _showCard(n, 'verse', false);
      } else {
        verse['visible'] = false;
      }
      if (question['visible'] == true) question['mode'] = on ? 'both' : 'question';
    case 'birthday':
      if (on && (birthday['greeting'] ?? '').toString().trim().isNotEmpty) {
        birthday['visible'] = true;
        birthday['seq'] = ((birthday['seq'] as num?) ?? 0) + 1;
      } else {
        birthday['visible'] = false;
      }
    default:
      if (isText(l['kind'] as String)) {
        final live = liveOf(n);
        if (on) {
          (live['on'] as Json)[l['id'] as String] = true;
          if (l['kind'] == 'countdown' && (live['cd'] as Json)[l['id']] == null) (live['cd'] as Json)[l['id'] as String] = nowMs();
        } else {
          (live['on'] as Json).remove(l['id']);
        }
      } else {
        l['visible'] = on;
      }
  }
}

/// The Content's eye: its visibility in the Frame; on the live Frame the program follows at once.
void toggleVisible(Json n, Object? sceneId, Object? layerId) {
  final sc = findScene(n, sceneId);
  final l = layerOf(sc, layerId);
  if (l == null) return;
  final onAir = liveOf(n)['scene'] == sceneId && deckOf(sc!, l) == liveDeckId(n, sc);
  final on = onAir ? !layerOn(n, sc, l) : l['visible'] != true;
  l['visible'] = on;
  if (liveOf(n)['scene'] == sceneId) setOn(n, sceneId, layerId, on);
}

/// Question · Scripture · Both for a Frame that has both cards ('' when it does not).
/// st given: the Deck on screen (else the first Deck).
String qsMode(Json sc, [Json? st]) {
  final dk = st != null ? liveDeckId(st, sc) : decksOf(sc).first['id'];
  final q = firstIn(sc, dk, 'question'), v = firstIn(sc, dk, 'scripture');
  if (q == null || v == null) return '';
  return q['visible'] == true && v['visible'] == true ? 'both' : (v['visible'] == true ? 'verse' : 'question');
}

bool setQS(Json n, Object? sid, String m) {
  final sc = findScene(n, sid);
  final dk = liveDeckId(n, sc);
  final q = firstIn(sc, dk, 'question'), v = firstIn(sc, dk, 'scripture');
  if (q == null || v == null) return false;
  q['visible'] = m != 'verse';
  v['visible'] = m != 'question';
  if (liveOf(n)['scene'] == sid) {
    setOn(n, sid, q['id'], q['visible'] as bool);
    setOn(n, sid, v['id'], v['visible'] as bool);
    (n['question'] as Json)['mode'] = m == 'both' ? 'both' : 'question';
  }
  stamp(sc!);
  return true;
}

/// Show one item of the live Frame's list (the item stepper, ◀ Question 2 / 3 ▶), as the PC and the remote do.
bool showItem(Json n, String kind, Object? itemId) {
  final f = itemById(n, kind, itemId);
  if (f == null) return false;
  final k = kind == 'scripture' ? 'verse' : kind;
  if (k == 'question') {
    loadQuestion(n, itemId);
  } else {
    cOf(f.layer)['itemId'] = itemId;
    loadVerse(n, f.layer);
  }
  final o = n[k] as Json;
  o['visible'] = true;
  o['seq'] = ((o['seq'] as num?) ?? 0) + 1;
  resolveTransition(n, k, itemId);
  if (k == 'question') presentAfterShow(n);
  return true;
}

/// Which list the item stepper walks for the live Frame: 'question', 'verse' or null.
String? stepKind(Json st, [Object? selectedLayer]) {
  final ls = liveScene(st);
  final sl = layerOf(ls, selectedLayer);
  if (sl != null && (sl['kind'] == 'question' || sl['kind'] == 'scripture')) return sl['kind'] == 'question' ? 'question' : 'verse';
  final dk = liveDeckId(st, ls);
  if ((firstIn(ls, dk, 'question') ?? firstOf(ls, 'question')) != null) return 'question';
  if ((firstIn(ls, dk, 'scripture') ?? firstOf(ls, 'scripture')) != null) return 'verse';
  return null;
}

/// The position of the item on screen in the live Frame's list (-1 when none).
int currentIndex(Json st, String kind) {
  final l = items(st, kind);
  final id = (st[kind] as Json)['itemId'];
  for (var i = 0; i < l.length; i++) {
    if (l[i]['id'] == id) return i;
  }
  return -1;
}

// ---------- creating ----------
Json newLayer(String kind, [Json? extra]) {
  final l = <String, dynamic>{
    'id': rid(),
    'kind': kind,
    'name': kindInfo[kind]!.name,
    'visible': true,
    'locked': false,
    'opacity': 1,
    'c': <String, dynamic>{},
  };
  switch (kind) {
    case 'camera':
      l['c'] = {
        'x': 0.5,
        'y': 0.5,
        'w': 1,
        'h': 1,
        'props': {'fit': 'cover', 'mirror': false},
      };
    case 'screen':
      l['c'] = {
        'x': 0.5,
        'y': 0.5,
        'w': 0.6,
        'h': 0.6,
        'props': {'fit': 'contain'},
      };
    case 'background':
      l['c'] = {
        'props': {'color': '#0b1222'},
      };
    case 'text':
      l['c'] = {
        'x': 0.5,
        'y': 0.5,
        'w': 0.5,
        'h': 0.12,
        'props': {'text': 'Your text here'},
      };
    case 'rect':
      l['c'] = {'x': 0.5, 'y': 0.5, 'w': 0.3, 'h': 0.2, 'radius': 0.015};
    case 'ellipse':
      l['c'] = {'x': 0.5, 'y': 0.5, 'w': 0.15, 'h': 0.15 * 16 / 9};
    case 'image':
      l['c'] = {'x': 0.5, 'y': 0.5, 'w': 0.25, 'file': ''};
    case 'video':
      l['c'] = {'x': 0.5, 'y': 0.5, 'w': 0.5, 'file': '', 'loop': true};
    case 'pdf':
      l['c'] = {'x': 0.5, 'y': 0.5, 'w': 0.6, 'file': ''};
    case 'question' || 'scripture':
      l['c'] = {'items': <dynamic>[]};
  }
  if (extra != null) {
    for (final e in extra.entries) {
      if (e.key == 'c') {
        (l['c'] as Json).addAll(deepCopy(e.value as Json));
      } else {
        l[e.key] = e.value;
      }
    }
  }
  final c = l['c'] as Json;
  if (kind == 'scripture' && c['items'] is List && (c['items'] as List).isEmpty && (c['text'] ?? '').toString().trim().isNotEmpty) {
    (c['items'] as List).add({'id': rid('v'), 'ref': c['ref'], 'version': c['version'], 'text': c['text']});
    c['text'] = '';
    c['ref'] = '';
    c['version'] = '';
  }
  return cleanLayer(l)!;
}

String uniqueName(Json st, String base) {
  final names = {for (final s in scenesOf(st)) (s['name'] as String).toLowerCase()};
  if (!names.contains(base.toLowerCase())) return base;
  final m = RegExp(r'^(.*?)(\d+)$').firstMatch(base);
  if (m != null) {
    final start = int.parse(m.group(2)!);
    for (var n = start + 1; n < start + 500; n++) {
      if (!names.contains('${m.group(1)}$n'.toLowerCase())) return '${m.group(1)}$n';
    }
  }
  for (var c = 1; c < 500; c++) {
    final nm = base + (c == 1 ? ' copy' : ' copy $c');
    if (!names.contains(nm.toLowerCase())) return nm;
  }
  return '$base ${rid('')}';
}

void insertScene(Json st, Json sc, [Object? afterId]) {
  final list = st['scenes'] as List;
  var i = -1;
  for (var k = 0; k < list.length; k++) {
    if ((list[k] as Json)['id'] == afterId) i = k;
  }
  if (i < 0) {
    list.add(sc);
  } else {
    list.insert(i + 1, sc);
  }
}

bool hasBrand(Json st) {
  final b = st['brand'] as Json? ?? const {};
  return (b['logo'] ?? '') != '' || (b['meeting'] ?? '') != '' || (b['org'] ?? '') != '';
}

Json? addBrand(Json sc, [Json? opts]) {
  if (firstOf(sc, 'brand') != null) return null;
  final l = newLayer('brand', {'c': opts ?? <String, dynamic>{}});
  l['deck'] = decksOf(sc).first['id'];
  (sc['layers'] as List).insert(0, l);
  return l;
}

/// A new Frame from a built-in template.
Json createScene(Json st, String tplId, {String? name, String? group, String? creator, Object? after}) {
  final t = templates.firstWhere((x) => x.id == tplId, orElse: () => templates.last);
  final now = nowMs();
  final sc = cleanScene({
    'id': rid('sc_'),
    'name': name ?? uniqueName(st, t.name),
    'group': group ?? '',
    'created': now,
    'modified': now,
    'creator': creator ?? '',
    'template': t.id == 'blank' ? '' : t.name,
    'tx': {'type': 'profile', 'ms': 500},
  })!;
  sc['layers'] = [for (final k in t.layers) newLayer(k)];
  if (t.id == 'zoom' || t.id == 'teams') (sc['layers'] as List<dynamic>)[0]['name'] = t.id == 'zoom' ? 'Zoom camera' : 'Teams camera';
  final b = st['brand'] as Json?;
  if (b?['auto'] == true && sc['tpl'] != true && hasBrand(st)) addBrand(sc);
  insertScene(st, sc, after);
  return sc;
}

// ---------- text, branding and countdown on the program ----------
String brandText(Json st, Object? s) {
  final b = st['brand'] as Json? ?? const {};
  return (s ?? '')
      .toString()
      .replaceAll(RegExp(r'\{meeting\}', caseSensitive: false), (b['meeting'] ?? '').toString())
      .replaceAll(RegExp(r'\{org\}', caseSensitive: false), (b['org'] ?? '').toString());
}

/// Text Content on the program (announcement, prayer, lower third, countdown). output: 'vcam', 'obs' or null.
List<Json> liveText(Json st, [String? output]) {
  final sc = liveScene(st);
  if (sc == null || (output != null && (sc['out'] as Json)[output] == false)) return const [];
  final on = liveOf(st)['on'] as Json;
  return layersOf(sc).where((l) {
    final c = cOf(l);
    return isText(l['kind'] as String) &&
        l['kind'] != 'brand' &&
        on[l['id']] == true &&
        (output == null || c[output] != false) &&
        (l['kind'] == 'countdown' || brandText(st, c['text']).trim().isNotEmpty || brandText(st, c['title']).trim().isNotEmpty);
  }).toList();
}

/// Branding badges on the program.
List<Json> liveBrand(Json st, [String? output]) {
  final sc = liveScene(st);
  if (sc == null || (output != null && (sc['out'] as Json)[output] == false)) return const [];
  final b = st['brand'] as Json? ?? const {};
  final on = liveOf(st)['on'] as Json;
  return layersOf(sc).where((l) {
    final c = cOf(l);
    return l['kind'] == 'brand' &&
        on[l['id']] == true &&
        (output == null || c[output] != false) &&
        ((c['logo'] == true && (b['logo'] ?? '') != '') ||
            (c['name'] == true && (b['meeting'] ?? '') != '') ||
            (c['org'] == true && (b['org'] ?? '') != ''));
  }).toList();
}

/// A countdown's text now ("4:59", or its end text).
String countdownText(Json st, Json l, [int? now]) {
  final t = now ?? nowMs();
  final c = cOf(l);
  int end;
  if (c['mode'] == 'until') {
    final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch((c['until'] ?? '').toString().trim());
    if (m == null) return (c['text'] ?? '').toString();
    final d = DateTime.fromMillisecondsSinceEpoch(t);
    end = DateTime(d.year, d.month, d.day, int.parse(m.group(1)!), int.parse(m.group(2)!)).millisecondsSinceEpoch;
  } else {
    final started = ((liveOf(st)['cd'] as Json)[l['id']] as num?)?.toInt() ?? t;
    end = started + ((c['minutes'] as num) * 60000).round();
  }
  final left = ((end - t) / 1000).ceil();
  if (left <= 0) {
    final tx = (c['text'] ?? '').toString();
    return tx.isEmpty ? '0:00' : tx;
  }
  final h = left ~/ 3600, mm = left % 3600 ~/ 60, ss = left % 60;
  return '${h > 0 ? '$h:${mm.toString().padLeft(2, '0')}' : '$mm'}:${ss.toString().padLeft(2, '0')}';
}

/// The line under a Frame's name: its kinds of Content, then its transition ("Scripture · Question · Bible Study").
String sceneSummary(Json st, Json sc) {
  final kinds = <String>[];
  for (final l in layersOf(sc)) {
    final k = kindInfo[l['kind']]?.name ?? l['kind'].toString();
    if (!kinds.contains(k)) kinds.add(k);
  }
  final tx = sc['tx'] as Json;
  final t = tx['type'] == 'profile' ? profileOf(st).name : txName(tx['type'] as String);
  final auto = sc['auto'] as Json;
  return '${kinds.isEmpty ? 'Empty Frame' : kinds.join(' · ')} · $t${auto['on'] == true ? ' · auto ${auto['sec']} s' : ''}';
}
