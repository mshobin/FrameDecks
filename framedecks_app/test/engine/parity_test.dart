// The Dart engine must do exactly what the Windows app's store.js does. tool/parity/make_fixtures.js ran the
// JavaScript on these scenarios; here the Dart port replays them and every resulting state must be identical.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/model.dart';
import 'package:framedecks/engine/normalize.dart';
import 'package:framedecks/engine/scenes.dart' as sc;

/// Where two JSON values differ (numbers compare by value: 1 == 1.0), or null when they are the same.
String? diff(Object? a, Object? b, [String at = r'$']) {
  if (a is num && b is num) return a == b ? null : '$at: $a != $b';
  if (a is Map && b is Map) {
    final keys = {...a.keys, ...b.keys};
    for (final k in keys) {
      if (!a.containsKey(k)) return '$at.$k: missing in Dart (JS has ${jsonEncode(b[k])})';
      if (!b.containsKey(k)) return '$at.$k: extra in Dart (${jsonEncode(a[k])})';
      final d = diff(a[k], b[k], '$at.$k');
      if (d != null) return d;
    }
    return null;
  }
  if (a is List && b is List) {
    if (a.length != b.length) return '$at: length ${a.length} != ${b.length}';
    for (var i = 0; i < a.length; i++) {
      final d = diff(a[i], b[i], '$at[$i]');
      if (d != null) return d;
    }
    return null;
  }
  return a == b ? null : '$at: ${jsonEncode(a)} != ${jsonEncode(b)}';
}

void main() {
  final fx = jsonDecode(File('test/engine/fixtures.json').readAsStringSync()) as Json;
  final steps = (fx['steps'] as List).cast<Json>();

  test('Go Live, the item stepper, Hide All, the eye and Question / Scripture / Both match the Windows app', () {
    var clock = fx['clockStart'] as int;
    sc.nowMs = () => clock;
    final n = deepCopy(fx['initial'] as Json);
    final ids = {for (final s in sc.scenesOf(n)) s['name']: s['id']};
    final bs = ids['Bible Study'], welcome = ids['Welcome'], qo = ids['Questions only'];
    Json decks(Json s) => sc.findScene(s, 'sc_decks')!;
    final added = steps.firstWhere((x) => x['name'] == 'deck: add a deck')['state'] as Json;
    final jsDeckId = (sc.findScene(added, 'sc_decks')!['decks'] as List)[2]['id'];
    final ops = <String, void Function(Json)>{
      'take bible study': (s) => sc.take(s, bs),
      'next question': (s) => sc.showItem(s, 'question', 'qb'),
      'next scripture': (s) => sc.showItem(s, 'verse', 'vb'),
      'hide all': sc.hideAll,
      'take welcome with dip to black': (s) => sc.take(s, welcome, 'dip-black'),
      'countdown off': (s) => sc.setOn(s, welcome, 'cd1', false),
      'eye on countdown': (s) => sc.toggleVisible(s, welcome, 'cd1'),
      'take bible study again (cut)': (s) => sc.take(s, bs, 'cut'),
      'scripture only': (s) => sc.setQS(s, bs, 'verse'),
      'both': (s) => sc.setQS(s, bs, 'both'),
      'take questions only': (s) => sc.take(s, qo),
      'profile youth, take welcome': (s) {
        s['profile'] = 'youth';
        sc.take(s, welcome);
      },
      // FrameDecks: Frame -> Deck -> Content
      'deck: take deck study': (s) => sc.take(s, 'sc_decks'),
      'deck: next goes to deck 2': (s) => sc.step(s, 1),
      'deck: next goes to deck 3': (s) => sc.step(s, 1),
      'deck: next goes to the next frame': (s) => sc.step(s, 1),
      'deck: previous comes back to the last deck': (s) => sc.step(s, -1),
      'deck: previous goes to deck 2': (s) => sc.step(s, -1),
      'deck: eye on content in another deck': (s) => sc.toggleVisible(s, 'sc_decks', 'dl4'),
      'deck: setOn content in another deck': (s) => sc.setOn(s, 'sc_decks', 'dl1', false),
      'deck: scripture only on the live deck': (s) => sc.setQS(s, 'sc_decks', 'verse'),
      'deck: move prayer into the live deck': (s) => sc.moveToDeck(s, decks(s), ['dl4'], 'dk2'),
      'deck: take a given deck': (s) => sc.take(s, 'sc_decks', 'cut', 'dk3'),
      'deck: back to deck 2': (s) => sc.take(s, 'sc_decks', null, 'dk2'),
      'deck: remove the live deck': (s) => sc.removeDeck(s, decks(s), 'dk2'),
      'deck: rename and move a deck': (s) {
        sc.renameDeck(decks(s), 'dk3', '  Closing  ');
        sc.moveDeck(decks(s), 'dk3', -1);
      },
      // a new Deck's id is random (rid): take the one the JavaScript made, then everything else must match
      'deck: add a deck': (s) => sc.addDeck(decks(s), '', 'd1')['id'] = jsDeckId,
      'deck: fix decks before saving': (s) {
        sc
            .layersOf(decks(s))
            .add(
              cleanLayer({
                'id': 'dl9',
                'kind': 'countdown',
                'c': {'minutes': 2},
              })!,
            );
        sc.fixDecks(s);
      },
    };
    for (final st in steps) {
      clock += 1000;
      final op = ops[st['name']];
      expect(op, isNotNull, reason: 'no Dart step for "${st['name']}"');
      op!(n);
      final d = diff(n, st['state']);
      expect(d, isNull, reason: 'after "${st['name']}": $d');
    }
  });

  test('normalize turns an old, untidy saved file into exactly what the Windows app makes of it', () {
    final d = diff(normalize(fx['messy']), fx['messyNormalized']);
    expect(d, isNull, reason: d);
  });

  test('the canvas preview of one Deck matches the Windows app', () {
    final clock = fx['previewClock'] as int;
    sc.nowMs = () => clock;
    final d = diff(sc.previewState(deepCopy(fx['previewFrom'] as Json), 'sc_decks', 'd1'), fx['deckPreview']);
    expect(d, isNull, reason: d);
  });

  test('a fresh state is the Windows default state', () {
    final js = deepCopy(fx['initial'] as Json)..['scenes'] = <dynamic>[];
    final mine = normalize(null);
    final d = diff(mine, js);
    expect(d, isNull, reason: d);
  });
}
