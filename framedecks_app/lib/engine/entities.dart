/// The saved document as sync entities, and back: a port of app/js/entities.js (SaaS Phase 1; see
/// docs/project/saas-pwa-architecture.md §7, §11). tests/fixtures/entities/ holds the cases both engines must agree on.
///
/// split(doc)            → the entities the cloud receives, and `local`: what stays on this computer (what is live,
///                         the revision, and the cards' current text, the birthday person's name among it)
/// join(entities, local) → the document again (the same JSON, key order aside)
/// changes(before, after) → what a sync push would send
library;

import 'dart:convert';

import 'model.dart';

/// The D1 entities.kind list.
const kKinds = ['frame', 'template', 'order', 'theme', 'library_verse', 'library_question', 'brand', 'profile', 'layout', 'meeting', 'members'];

/// What a card shows right now (live, never synced); every other card field is its look (the theme entity).
const kCardLive = <String, List<String>>{
  'question': ['text', 'visible', 'seq', 'cut', 'itemId', 'mode', 'play', 'upcoming', 'out'],
  'verse': ['text', 'ref', 'version', 'visible', 'seq', 'cut', 'itemId', 'play', 'upcoming', 'out'],
  'birthday': ['name', 'greeting', 'message', 'country', 'visible', 'seq', 'cut', 'out'],
};
const _cards = ['question', 'verse', 'birthday'];
const _single = ['brand', 'layout', 'meeting']; // one entity each, the block as it is

/// One synced piece of the document.
class Entity {
  Entity(this.kind, this.id, this.body);

  factory Entity.fromJson(Json j) => Entity(j['kind'] as String, j['id'] as String, j['body']);

  final String kind;
  final String id;
  final Object? body;

  Json toJson() => {'kind': kind, 'id': id, 'body': body};
}

Object? _copy(Object? v) => v == null ? null : jsonDecode(jsonEncode(v));

/// JSON with sorted keys, so equal documents give equal text whatever order their keys were written in.
/// Whole-number doubles are written as integers, as JavaScript does (1.0 → 1).
String canon(Object? v) {
  if (v is List) return '[${v.map(canon).join(',')}]';
  if (v is Map) {
    final keys = v.keys.map((k) => k.toString()).toList()..sort();
    return '{${keys.map((k) => '${jsonEncode(k)}:${canon(v[k])}').join(',')}}';
  }
  if (v is double && v.isFinite && v == v.truncateToDouble() && v.abs() < 1e15) return jsonEncode(v.toInt());
  return jsonEncode(v);
}

/// List items → entity ids, unique within the list (a repeated id gets #2, #3… so nothing is lost).
List<String> _ids(List<Object?> list) {
  final seen = <String, int>{};
  return [
    for (var i = 0; i < list.length; i++)
      () {
        final it = list[i];
        final raw = it is Map ? it['id'] : null;
        final id = raw != null && raw != '' ? raw.toString() : '#$i';
        final n = seen[id] = (seen[id] ?? 0) + 1;
        return n > 1 ? '$id#$n' : id;
      }(),
  ];
}

({List<Entity> entities, Json local}) split(Json doc) {
  final d = _copy(doc) as Json;
  final out = <Entity>[];
  void add(String kind, String id, Object? body) => out.add(Entity(kind, id, body));
  final scenes = d['scenes'] is List ? d['scenes'] as List : const [];
  final sceneIds = _ids(scenes);
  for (var i = 0; i < scenes.length; i++) {
    final sc = scenes[i];
    add(sc is Map && sc['tpl'] == true ? 'template' : 'frame', sceneIds[i], sc);
  }
  final lib = d['library'] is Map ? d['library'] as Map : const {};
  final qs = lib['questions'] is List ? lib['questions'] as List : const [];
  final vs = lib['verses'] is List ? lib['verses'] as List : const [];
  final qIds = _ids(qs), vIds = _ids(vs);
  for (var i = 0; i < qs.length; i++) {
    add('library_question', qIds[i], qs[i]);
  }
  for (var i = 0; i < vs.length; i++) {
    add('library_verse', vIds[i], vs[i]);
  }
  add('order', 'order', {'scenes': sceneIds, 'questions': qIds, 'verses': vIds});
  final theme = <String, dynamic>{};
  for (final k in _cards) {
    final c = d[k];
    if (c is! Map) continue;
    theme[k] = {
      for (final f in c.keys)
        if (!kCardLive[k]!.contains(f)) f.toString(): c[f],
    };
  }
  add('theme', 'cards', theme);
  for (final k in _single) {
    if (d.containsKey(k)) add(k, k, d[k]);
  }
  if (d.containsKey('profile')) add('profile', 'profile', {'value': d['profile']});
  // what stays here: everything not sent above
  final local = <String, dynamic>{};
  for (final k in d.keys) {
    if (k == 'scenes' || k == 'profile' || _single.contains(k)) continue;
    if (k == 'library') {
      local['library'] = {
        for (final f in lib.keys)
          if (f != 'questions' && f != 'verses') f.toString(): lib[f],
      };
      continue;
    }
    final c = d[k];
    if (_cards.contains(k) && c is Map) {
      local[k] = {
        for (final f in kCardLive[k]!)
          if (c.containsKey(f)) f: c[f],
      };
      continue;
    }
    local[k] = c;
  }
  local['keys'] = d.keys.toList(); // the document's own key order, so join writes it back the same
  return (entities: out, local: local);
}

Json join(List<Entity> entities, Json local) {
  final loc = (_copy(local) as Json?) ?? <String, dynamic>{};
  final by = <String, Map<String, Entity>>{};
  for (final e in entities) {
    if (e.body != null) (by[e.kind] ??= {})[e.id] = e; // an empty entity is no entity (as in entities.js)
  }
  Object? body(String kind, String id) {
    final e = by[kind]?[id];
    return e == null ? null : _copy(e.body);
  }

  bool has(String kind, String id) => by[kind]?.containsKey(id) ?? false;
  final order = (body('order', 'order') as Map?) ?? {'scenes': [], 'questions': [], 'verses': []};
  final orderScenes = (order['scenes'] as List).cast<Object?>();
  final keys = loc['keys'] is List ? (loc['keys'] as List).cast<String>() : const <String>[];
  loc.remove('keys');
  final parts = <String, dynamic>{};
  parts['scenes'] = [
    for (final id in orderScenes)
      if (has('frame', '$id')) body('frame', '$id') else if (has('template', '$id')) body('template', '$id'),
  ];
  // Frames the order does not know yet (added on another computer before its order arrived) go at the end
  for (final kind in ['frame', 'template']) {
    for (final e in (by[kind] ?? const <String, Entity>{}).values) {
      if (!orderScenes.contains(e.id)) (parts['scenes'] as List).add(_copy(e.body));
    }
  }
  List<Object?> list(String kind, List<Object?> idsInOrder) => [
    for (final id in idsInOrder)
      if (has(kind, '$id')) body(kind, '$id'),
    for (final e in (by[kind] ?? const <String, Entity>{}).values)
      if (!idsInOrder.contains(e.id)) _copy(e.body),
  ];
  parts['library'] = {
    'verses': list('library_verse', order['verses'] as List),
    'questions': list('library_question', order['questions'] as List),
    ...((loc['library'] as Map?)?.cast<String, dynamic>() ?? const {}),
  };
  final theme = (body('theme', 'cards') as Map?) ?? const {};
  for (final k in _cards) {
    if (!loc.containsKey(k) && !theme.containsKey(k)) continue;
    parts[k] = {...((theme[k] as Map?)?.cast<String, dynamic>() ?? const {}), ...((loc[k] as Map?)?.cast<String, dynamic>() ?? const {})};
  }
  for (final k in _single) {
    if (has(k, k)) parts[k] = body(k, k);
  }
  if (has('profile', 'profile')) parts['profile'] = (body('profile', 'profile') as Map)['value'];
  for (final k in loc.keys) {
    if (!parts.containsKey(k) && k != 'library' && !_cards.contains(k)) parts[k] = loc[k];
  }
  final d = <String, dynamic>{};
  for (final k in keys) {
    if (parts.containsKey(k)) d[k] = parts[k];
  }
  for (final k in parts.keys) {
    if (!d.containsKey(k)) d[k] = parts[k];
  }
  return d;
}

/// What changed between two entity lists: the entities to send, and the ones that are gone.
({List<Entity> upserts, List<({String kind, String id})> deletes}) changes(List<Entity> before, List<Entity> after) {
  String key(Entity e) => '${e.kind}\u0000${e.id}';
  final old = {for (final e in before) key(e): canon(e.body)};
  final now = {for (final e in after) key(e)};
  return (
    upserts: [
      for (final e in after)
        if (old[key(e)] != canon(e.body)) e,
    ],
    deletes: [
      for (final e in before)
        if (!now.contains(key(e))) (kind: e.kind, id: e.id),
    ],
  );
}
