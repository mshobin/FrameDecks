/// Cleaning and filling in a state document, exactly as store.js normalize() does, so the Flutter app accepts
/// anything the Windows app saved (and older versions of it), and writes nothing the Windows app would reject.
library;

import 'model.dart';

Json _merge(Json base, Object? extra) {
  final out = <String, dynamic>{};
  final ex = extra is Map ? extra : null;
  for (final k in base.keys) {
    final b = base[k];
    if (b is Map) {
      out[k] = _merge(b as Json, ex?[k]);
    } else {
      final v = ex?[k];
      out[k] = v != null ? deepCopy(v) : deepCopy(b);
    }
  }
  return out;
}

Json? cleanLayer(Object? raw) {
  if (raw is! Map) return null;
  final l = raw;
  final kind = allKinds.contains(l['kind']) ? l['kind'] as String : null;
  if (kind == null) return null;
  final c = l['c'] is Map ? deepCopy(Map<String, dynamic>.from(l['c'] as Map)) : <String, dynamic>{};
  final out = <String, dynamic>{
    'id': str(l['id'] ?? rid(), 40),
    'kind': kind,
    'name': str((l['name'] == null || l['name'] == '') ? kindInfo[kind]!.name : l['name'], 60),
    'visible': l['visible'] != false,
    'locked': _truthy(l['locked']),
    'opacity': numIn(l['opacity'], 0, 1, 1),
    'c': c,
  };
  if (_truthy(l['deck'])) out['deck'] = str(l['deck'], 40);
  if (textKinds.contains(kind)) {
    final d = textDefaults[kind]!;
    for (final k in d.keys) {
      final dv = d[k];
      if (dv is num) {
        final r = textRange[k];
        c[k] = numIn(c[k], r?[0] ?? 0.4, r?[1] ?? 3, dv);
      } else if (dv is bool) {
        c[k] = c[k] == null ? dv : _truthy(c[k]);
      } else {
        c[k] = str(c.containsKey(k) && c[k] != null ? c[k] : dv, k == 'text' ? 2000 : 200);
      }
    }
    if (!positions.contains(c['pos'])) c['pos'] = d['pos'];
    if (!['fade', 'rise', 'none'].contains(c['anim'])) c['anim'] = d['anim'];
    if (!['duration', 'until'].contains(c['mode'])) {
      // only a countdown has a mode; JavaScript sets the others to undefined, which JSON leaves out
      if (d['mode'] == null) {
        c.remove('mode');
      } else {
        c['mode'] = d['mode'];
      }
    }
  }
  if (cardKinds.contains(kind)) {
    c['itemId'] = str(c['itemId'], 40);
    c['label'] = str(c['label'], 80);
    if (kind == 'scripture') {
      c['ref'] = str(c['ref'], 120);
      c['version'] = str(c['version'], 40);
      c['text'] = str(c['text'], 8000);
    }
    if (c['items'] is List) {
      c['items'] = [for (final it in (c['items'] as List).whereType<Map<dynamic, dynamic>>().take(1000)) cleanItem(kind, it)];
    } else {
      c.remove('items');
    }
    if (c['look'] is Map) {
      c['look'] = cleanLook(kind, c['look'] as Map);
      if (c['look'] == null) c.remove('look');
    } else {
      c.remove('look');
    }
  }
  c['vcam'] = c['vcam'] != false;
  c['obs'] = c['obs'] != false;
  return out;
}

bool _truthy(Object? v) => !(v == null || v == false || v == 0 || v == '');

Json cleanItem(String kind, Map<dynamic, dynamic> it) {
  final o = <String, dynamic>{'id': str(it['id'] ?? rid('i'), 40)};
  for (final f in itemFields[kind] ?? const <String>[]) {
    if ((f == 'answer' || f == 'note') && !_truthy(it[f])) continue;
    o[f] = str(it[f], f == 'text' || f == 'answer' || f == 'note' ? 8000 : 200);
  }
  if (kind == 'question' && !presentModes.contains(o['mode'])) o['mode'] = '';
  final t = (it['transition'] ?? '').toString();
  if (t == 'random' || cardTransitions.contains(t)) o['transition'] = t;
  return o;
}

Json? cleanLook(String kind, Map<dynamic, dynamic> o) {
  final d = look[kind];
  if (d == null) return null;
  final out = <String, dynamic>{};
  for (final k in [...d.layout, ...d.card]) {
    if (!o.containsKey(k) || o[k] == null) continue;
    final v = o[k];
    final r = lookRange[k];
    if (r != null) {
      out[k] = numIn(v, r[0], r[1], r[0]);
    } else if (k == 'verseAlign') {
      out[k] = ['left', 'center', 'right'].contains(v) ? v : 'center';
    } else if (k == 'transition') {
      out[k] = cardTransitions.contains(v) ? v : 'fade';
    } else if (k == 'speed') {
      out[k] = speeds.contains(v) ? v : 'normal';
    } else if (k == 'burst') {
      out[k] = v == 'bold' ? 'bold' : 'gentle';
    } else if (k == 'pool') {
      out[k] = [
        for (final t in (v is List ? v : const []))
          if (cardTransitions.contains(t)) t,
      ];
    } else {
      out[k] = _truthy(v);
    }
  }
  return out;
}

Json cleanInk(Object? raw) {
  final o = raw is Map ? raw : const {};
  List<Json> items(Object? list) => [
    for (final it in (list is List ? list : const []).whereType<Map<dynamic, dynamic>>())
      if (inkTools.contains(it['t']) && it['p'] is List && (it['p'] as List).isNotEmpty) _inkItem(it),
  ];
  final all = items(o['items']);
  final undone = items(o['undone']);
  return {
    'on': _truthy(o['on']),
    'items': all.length > 300 ? all.sublist(all.length - 300) : all,
    'undone': undone.length > 50 ? undone.sublist(undone.length - 50) : undone,
  };
}

Json _inkItem(Map<dynamic, dynamic> it) {
  final c = (it['c'] ?? '').toString();
  num round4(num v) => (v * 1e4).round() / 1e4;
  return {
    't': it['t'],
    'c': RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(c) ? c : '#e8b931',
    'w': numIn(it['w'], 0.001, 0.05, 0.005),
    's': str(it['s'], 200),
    'p': [
      for (final q in (it['p'] as List).take(1500))
        [round4(numIn(q is List && q.isNotEmpty ? q[0] : null, -0.5, 1.5, 0)), round4(numIn(q is List && q.length > 1 ? q[1] : null, -0.5, 1.5, 0))],
    ],
  };
}

Json? cleanScene(Object? raw) {
  if (raw is! Map) return null;
  final sc = raw;
  final tx = sc['tx'] is Map ? sc['tx'] as Map : const {};
  final auto = sc['auto'] is Map ? sc['auto'] as Map : const {};
  final out = sc['out'] is Map ? sc['out'] as Map : const {};
  final layers = [for (final l in (sc['layers'] is List ? sc['layers'] as List : const [])) ?cleanLayer(l)].take(60).toList();
  if (out['vcam'] == false || out['obs'] == false) {
    for (final l in layers) {
      if (!(cardKinds.contains(l['kind']) || textKinds.contains(l['kind']))) continue;
      if (out['vcam'] == false) (l['c'] as Json)['vcam'] = false;
      if (out['obs'] == false) (l['c'] as Json)['obs'] = false;
    }
  }
  final txType = tx['type'] == 'profile' || txIds.contains(tx['type']) ? tx['type'] : 'profile';
  final decks = cleanDecks(sc['decks']);
  final deckIds = [for (final d in decks) d['id']];
  for (final l in layers) {
    if (!deckIds.contains(l['deck'])) l['deck'] = deckIds.first; // older Content: the first Deck
  }
  return {
    'id': str((sc['id'] == null || sc['id'] == '') ? rid('sc_') : sc['id'], 40),
    'name': str((sc['name'] == null || sc['name'] == '') ? 'Frame' : sc['name'], 80),
    'group': str(sc['group'], 60),
    'fav': _truthy(sc['fav']),
    'tpl': _truthy(sc['tpl']),
    'created': numOr0(sc['created']),
    'modified': numOr0(sc['modified']),
    'version': _max1(numOr0(sc['version'])),
    'creator': str(sc['creator'], 80),
    'from': str(sc['from'], 80),
    'template': str(sc['template'], 80),
    'parent': str(sc['parent'], 40),
    'notes': str(sc['notes'], 20000),
    'tx': {'type': txType, 'ms': numIn(tx['ms'], 0, 5000, 500)},
    'auto': {'on': _truthy(auto['on']), 'sec': numIn(auto['sec'], 2, 3600, 30)},
    'out': {'vcam': true, 'obs': true},
    'decks': decks,
    'layers': layers,
  };
}

/// A Frame's Decks: at least one. An older Frame gets "Deck 1" with the fixed id 'd1', so every screen that converts
/// the same file agrees (ids only need to be unique within their Frame). store.js cleanDecks.
List<Json> cleanDecks(Object? a) {
  final seen = <String>{};
  final out = <Json>[
    for (final d in (a is List ? a : const []))
      if (d is Map) {'id': str(d['id'], 40), 'name': str(_truthy(d['name']) ? d['name'] : 'Deck', 60)},
  ].where((d) => (d['id'] as String).isNotEmpty && seen.add(d['id'] as String)).take(30).toList();
  return out.isNotEmpty
      ? out
      : [
          {'id': 'd1', 'name': 'Deck 1'},
        ];
}

num _max1(num v) => v < 1 ? 1 : v;

num _clamp(Object? n, num lo, num hi, num d) => numIn(n, lo, hi, d);

/// store.js normalize(): any saved or served state → a complete, clean state.
Json normalize(Object? s) {
  final st = _merge(defaultState(), s);
  st['rev'] = numOr0(st['rev']);
  for (final k in ['verse', 'question']) {
    final o = st[k] as Json;
    o['text'] = str(o['text'], 1 << 30);
    o['label'] = str(o['label'], 1 << 30);
    o['itemId'] = str(o['itemId'], 1 << 30);
    if (o.containsKey('ref')) {
      o['ref'] = str(o['ref'], 1 << 30);
      o['version'] = str(o['version'], 1 << 30);
    }
    o['visible'] = _truthy(o['visible']);
    o['showLabel'] = _truthy(o['showLabel']);
    o['seq'] = numOr0(o['seq']);
    o['cut'] = numOr0(o['cut']);
    if (!cardTransitions.contains(o['transition'])) o['transition'] = 'fade';
    if (!speeds.contains(o['speed'])) o['speed'] = 'normal';
    o['random'] = _truthy(o['random']);
    final pool = <String>[];
    for (final t in (o['pool'] is List ? o['pool'] as List : const [])) {
      final s = t.toString();
      if (cardTransitions.contains(s) && !pool.contains(s)) pool.add(s);
    }
    o['pool'] = pool.isEmpty ? [...defaultPool] : pool;
    o['burst'] = o['burst'] == 'bold' ? 'bold' : 'gentle';
    o['play'] = cardTransitions.contains(o['play']) ? o['play'] : '';
    o['upcoming'] = cardTransitions.contains(o['upcoming']) ? o['upcoming'] : '';
  }
  final q = st['question'] as Json;
  q['mode'] = presentModes.contains(q['mode']) ? q['mode'] : '';

  List<Json> list(Object? arr, List<String> fields) => [
    for (final it in (arr is List ? arr : const []).whereType<Map<dynamic, dynamic>>())
      {
        'id': str(it['id'] ?? rid('i'), 1 << 30),
        for (final f in fields) f: str(it[f], 1 << 30),
        if (it['transition'] == 'random' || cardTransitions.contains(it['transition'])) 'transition': it['transition'],
      },
  ];
  final lib = st['library'] as Json;
  lib['verses'] = list(lib['verses'], ['ref', 'version', 'text', 'pair']);
  lib['questions'] = list(lib['questions'], ['text', 'num', 'note', 'pair', 'mode']);
  for (final x in lib['questions'] as List) {
    if (!presentModes.contains((x as Json)['mode'])) x['mode'] = '';
  }

  final b = st['birthday'] as Json;
  for (final k in ['label', 'name', 'greeting', 'message', 'country']) {
    b[k] = str(b[k], 1 << 30);
  }
  b['visible'] = _truthy(b['visible']);
  b['showLabel'] = _truthy(b['showLabel']);
  b['seq'] = numOr0(b['seq']);
  b['cut'] = numOr0(b['cut']);
  if (!['fade', 'rise', 'none'].contains(b['transition'])) b['transition'] = 'rise';

  final l = st['layout'] as Json;
  l['bdayPos'] = ['top', 'center', 'bottom'].contains(l['bdayPos']) ? l['bdayPos'] : 'top';
  l['bdayScale'] = _clamp(l['bdayScale'], .6, 1.6, 1);
  l['verseAlign'] = ['left', 'center', 'right'].contains(l['verseAlign']) ? l['verseAlign'] : 'center';
  l['verseY'] = _clamp(l['verseY'], 22, 60, 40);
  l['verseWidth'] = _clamp(l['verseWidth'], 40, 88, 70);
  l['verseScale'] = _clamp(l['verseScale'], .6, 1.6, 1);
  l['qBottom'] = _clamp(l['qBottom'], 4, 24, 10);
  l['qWidth'] = _clamp(l['qWidth'], 50, 94, 84);
  l['qScale'] = _clamp(l['qScale'], .6, 1.6, 1);
  l['panel'] = _clamp(l['panel'], 50, 100, 92);

  final src = s is Map ? s : const {};
  for (final k in ['question', 'verse', 'birthday']) {
    final o = src[k] is Map && (src[k] as Map)['out'] is Map ? (src[k] as Map)['out'] as Map : const {};
    (st[k] as Json)['out'] = {'vcam': o['vcam'] != false, 'obs': o['obs'] != false};
  }
  _normalizeInto(st, src);
  ownLists(st);
  final mt = src['meeting'] is Map ? src['meeting'] as Map : const {};
  st['meeting'] = {
    'title': str(mt['title'], 80),
    'date': str(mt['date'], 40),
    'time': str(mt['time'], 40),
    'location': str(mt['location'], 200),
    'presenter': str(mt['presenter'], 80),
    'contact': str(mt['contact'], 120),
    'attendees': str(mt['attendees'], 20),
    'attendeeNotes': str(mt['attendeeNotes'], 2000),
    'owner': str(mt['owner'], 80),
    'contentNotes': str(mt['contentNotes'], 2000),
    'notes': str(mt['notes'], 2000),
    'extra': str(mt['extra'], 4000),
  };
  final br = src['brand'] is Map ? src['brand'] as Map : const {};
  final color = (br['color'] ?? '').toString();
  st['brand'] = {
    'meeting': str(br['meeting'], 80),
    'org': str(br['org'], 80),
    'color': RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(color) ? color.toLowerCase() : '',
    'logo': str(br['logo'], 40),
    'lw': numOr0(br['lw']),
    'lh': numOr0(br['lh']),
    'auto': _truthy(br['auto']),
  };
  return st;
}

void _normalizeInto(Json st, Map<dynamic, dynamic> raw) {
  final seen = <String>{};
  st['scenes'] = [
    for (final sc in [for (final x in (raw['scenes'] is List ? raw['scenes'] as List : const [])) ?cleanScene(x)].take(400))
      if (seen.add(sc['id'] as String)) sc,
  ];
  final l = raw['live'] is Map ? raw['live'] as Map : const {};
  final live = <String, dynamic>{
    'scene': str(l['scene'], 40),
    'deck': str(l['deck'], 40),
    'seq': numOr0(l['seq']),
    'at': numOr0(l['at']),
    'tx': txIds.contains(l['tx']) ? l['tx'] : 'cut',
    'txMs': numIn(l['txMs'], 0, 5000, 0),
    'auto': l['auto'] != false,
    'blackout': _truthy(l['blackout']),
    'emergency': _truthy(l['emergency']),
    'freeze': _truthy(l['freeze']),
    'ink': cleanInk(l['ink']),
    'message': str(l.containsKey('message') ? l['message'] : 'Please stand by — we’ll be right back.', 300),
    'on': <String, dynamic>{},
    'cd': <String, dynamic>{},
  };
  if (l['on'] is Map) {
    (l['on'] as Map).forEach((k, v) {
      if (_truthy(v)) (live['on'] as Json)[str(k, 40)] = true;
    });
  }
  if (l['cd'] is Map) {
    (l['cd'] as Map).forEach((k, v) => (live['cd'] as Json)[str(k, 40)] = numOr0(v));
  }
  st['live'] = live;
  st['profile'] = profiles.any((p) => p.id == raw['profile']) ? raw['profile'] : 'bible-study';
  st['v6'] = _truthy(raw['v6']);
}

/// Older data: a Question / Scripture Content that still followed the shared list gets its own copy (store.js ownLists).
bool ownLists(Json st) {
  final lib = st['library'] is Map ? st['library'] as Json : {'questions': [], 'verses': []};
  var changed = false;
  for (final sc in (st['scenes'] as List).cast<Json>()) {
    final map = <String, String>{};
    for (final l in (sc['layers'] as List).cast<Json>()) {
      final c = l['c'] as Json;
      if ((l['kind'] != 'question' && l['kind'] != 'scripture') || c['items'] is List) continue;
      final q = l['kind'] == 'question';
      final src = ((q ? lib['questions'] : lib['verses']) as List).cast<Json>();
      final pick = (c['itemId'] ?? '').toString();
      var from = pick.isNotEmpty ? src.where((x) => x['id'] == pick).toList() : [...src];
      if (!q && from.isEmpty && (c['text'] ?? '').toString().trim().isNotEmpty) {
        from = [
          {'id': 'inline', 'ref': c['ref'], 'version': c['version'], 'text': c['text']},
        ];
      }
      c['items'] = [
        for (final it in from.take(1000))
          () {
            final nid = '${it['id']}_${l['id']}';
            final cut = nid.length > 40 ? nid.substring(0, 40) : nid;
            map[it['id'].toString()] = cut;
            return cleanItem(l['kind'] as String, {...it, 'id': cut});
          }(),
      ];
      final curId = ((q ? st['question'] : st['verse']) as Json)['itemId'].toString();
      c['itemId'] = map[pick] ?? ((map[curId] != null && pick.isEmpty) ? map[curId] : '') ?? '';
      c['look'] ??= snapshotLook(st, l['kind'] as String);
      changed = true;
    }
    for (final l in (sc['layers'] as List).cast<Json>()) {
      final items = (l['c'] as Json)['items'];
      if (l['kind'] == 'question' && items is List) {
        for (final it in items.cast<Json>()) {
          final pair = (it['pair'] ?? '').toString();
          if (pair.isNotEmpty && map[pair] != null) {
            it['pair'] = map[pair];
          } else if (pair.isNotEmpty && !pair.contains('_')) {
            it['pair'] = '';
          }
        }
      }
    }
    if (sc['id'] == (st['live'] as Json)['scene']) {
      final qq = st['question'] as Json, vv = st['verse'] as Json;
      if (map[qq['itemId']] != null) qq['itemId'] = map[qq['itemId']];
      if (map[vv['itemId']] != null) vv['itemId'] = map[vv['itemId']];
    }
  }
  return changed;
}

/// The current card settings, for a new (or converted) Question / Scripture Content.
Json snapshotLook(Json st, String kind) {
  final d = look[kind]!;
  final card = st[kind == 'scripture' ? 'verse' : 'question'] as Json;
  final layout = st['layout'] as Json;
  return cleanLook(kind, {for (final k in d.layout) k: layout[k], for (final k in d.card) k: deepCopy(card[k])})!;
}
