import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engine/model.dart';
import '../engine/scenes.dart' as sc;
import 'providers.dart';

/// Makes a change and saves it; a short note confirms it ("✓ Bible Study is live"), a problem is said in words.
Future<bool> act(WidgetRef ref, BuildContext context, void Function(Json n) fn, [String? done]) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  try {
    await ref.read(backendProvider).update(fn);
    if (done != null) toast(messenger, '✓ $done');
    return true;
  } catch (e) {
    toast(messenger, e.toString().replaceFirst(RegExp(r'^\w*Exception:\s*'), ''), bad: true);
    return false;
  }
}

void toast(ScaffoldMessengerState? m, String text, {bool bad = false}) {
  if (m == null) return;
  m
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(text, style: TextStyle(color: bad ? const Color(0xFFF26363) : null)),
        duration: Duration(milliseconds: bad ? 3500 : 1500),
        width: 420,
      ),
    );
}

/// A copy of a Frame with new ids (its Content and list items too), named "… copy". Like the Windows Duplicate.
Json duplicateScene(Json st, Json src, {bool template = false, String? name}) {
  final c = deepCopy(src);
  final now = sc.nowMs();
  c['id'] = rid('sc_');
  c['name'] = name ?? sc.uniqueName(st, src['name'] as String);
  c['tpl'] = template;
  c['fav'] = false;
  c['created'] = now;
  c['modified'] = now;
  c['version'] = 1;
  c['parent'] = src['id'];
  for (final l in sc.layersOf(c)) {
    l['id'] = rid();
    final its = sc.cOf(l)['items'];
    if (its is List) {
      final kind = l['kind'] == 'question' ? 'question' : 'verse';
      final map = <Object?, String>{};
      for (final it in its.cast<Json>()) {
        final id = sc.newItemId(kind);
        map[it['id']] = id;
        it['id'] = id;
      }
      sc.cOf(l)['itemId'] = map[sc.cOf(l)['itemId']] ?? '';
    }
  }
  sc.insertScene(st, c, src['id']);
  return c;
}

/// One Frame per question: the Frame's questions each get a Frame of their own (in order, after it).
int framePerQuestion(Json st, Json src) {
  final q = sc.firstOf(src, 'question');
  final its = q == null ? const <Json>[] : (sc.cOf(q)['items'] as List).cast<Json>();
  if (its.length < 2) return 0;
  var after = src['id'];
  for (var i = 0; i < its.length; i++) {
    final c = duplicateScene(st, src, name: sc.uniqueName(st, '${src['name']} · Q${i + 1}'));
    final cq = sc.firstOf(c, 'question')!;
    final mine = (sc.cOf(cq)['items'] as List).cast<Json>()[i];
    sc.cOf(cq)['items'] = [mine];
    sc.cOf(cq)['itemId'] = mine['id'];
    (st['scenes'] as List).remove(c);
    sc.insertScene(st, c, after);
    after = c['id'];
  }
  return its.length;
}

/// What a Content row says under its name ("1 of 3 · Psalm 119:105", "Starting in · 5 min").
String layerDetail(Json st, Json scene, Json l) {
  final c = sc.cOf(l);
  final kind = l['kind'] as String;
  if (kind == 'question' || kind == 'scripture') {
    final its = (c['items'] as List? ?? const []).cast<Json>();
    if (its.isEmpty) return 'Empty list';
    var i = its.indexWhere((x) => x['id'] == c['itemId']);
    if (i < 0) i = 0;
    final it = its[i];
    final what = kind == 'scripture' ? (it['ref'] ?? '').toString() : (it['text'] ?? '').toString();
    return '${i + 1} of ${its.length}${what.isEmpty ? '' : ' · $what'}';
  }
  if (kind == 'birthday') {
    final b = st['birthday'] as Json;
    return (b['greeting'] ?? '').toString().isEmpty ? 'No greeting yet' : b['greeting'].toString();
  }
  if (kind == 'countdown') return c['mode'] == 'until' ? 'Until ${c['until']}' : '${c['minutes']} min';
  if (kind == 'brand') {
    final b = st['brand'] as Json;
    return [
      if (c['logo'] == true) 'Logo',
      if (c['name'] == true) b['meeting'],
      if (c['org'] == true) b['org'],
    ].where((x) => (x ?? '') != '').join(' · ');
  }
  if (kind == 'image' || kind == 'video') {
    final f = (c['file'] ?? '').toString();
    return f.isEmpty ? 'No file yet' : f;
  }
  if (sc.isText(kind)) {
    final t = sc.brandText(st, c['text']).trim();
    return t.isEmpty ? sc.brandText(st, c['title']) : t;
  }
  return kindInfo[kind]?.name ?? kind;
}
