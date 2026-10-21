// The saved document as sync entities (lib/engine/entities.dart) must split and join exactly like the Windows app's
// app/js/entities.js. tools/make_entity_fixtures.js wrote tests/fixtures/entities/*.json with the JavaScript; here the
// Dart port replays every case, and the sync rules of tests/entities.test.js §3.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/entities.dart';
import 'package:framedecks/engine/model.dart';
import 'package:framedecks/engine/normalize.dart';
import 'package:framedecks/engine/scenes.dart' as sc;

/// tests/fixtures/entities, from the repository root (flutter test runs in framedecks_app/).
Directory fixtureDir() {
  for (final base in [Directory.current, Directory.current.parent]) {
    final d = Directory('${base.path}/tests/fixtures/entities');
    if (d.existsSync()) return d;
  }
  throw StateError('tests/fixtures/entities not found from ${Directory.current.path}');
}

Json copy(Json j) => jsonDecode(jsonEncode(j)) as Json;

void main() {
  final files = fixtureDir().listSync().whereType<File>().where((f) => f.path.endsWith('.json')).toList()..sort((a, b) => a.path.compareTo(b.path));

  test('the shared fixtures are there', () => expect(files.length, greaterThanOrEqualTo(3)));

  for (final f in files) {
    final name = f.uri.pathSegments.last;
    final fx = jsonDecode(f.readAsStringSync()) as Json;
    final normalized = fx['normalized'] as Json;

    test('$name: Dart normalize gives the same document as store.js', () {
      expect(canon(normalize(copy(fx['input'] as Json))), canon(normalized));
    });

    test('$name: split gives the same entities, and join gives the document back', () {
      final s = split(normalized);
      final expected = fx['split'] as Json;
      expect(canon(s.entities.map((e) => e.toJson()).toList()), canon(expected['entities']));
      expect(canon(s.local), canon(expected['local']));
      expect(canon(join(s.entities, s.local)), canon(normalized));
      expect(canon(join(s.entities.reversed.toList(), s.local)), canon(normalized), reason: 'the order of entities does not matter');
      for (final e in s.entities) {
        expect(kKinds, contains(e.kind));
      }
      // the JavaScript entities join in Dart too
      final js = (expected['entities'] as List).map((e) => Entity.fromJson(e as Json)).toList();
      expect(canon(join(js, expected['local'] as Json)), canon(normalized));
    });
  }

  group('what a sync push sends', () {
    final dk = (jsonDecode(File('${fixtureDir().path}/decks.json').readAsStringSync()) as Json)['normalized'] as Json;
    final base = split(dk).entities;
    List<Entity> after(void Function(Json n) change) {
      final n = copy(dk);
      change(n);
      return split(n).entities;
    }

    List<String> keys(List<Entity> l) => [for (final e in l) '${e.kind}/${e.id}'];

    test('what is live is never synced', () {
      final c = changes(
        base,
        after((n) {
          sc.take(n, 'sc_e', 'cut');
          sc.step(n, -1, 'cut');
          sc.hideAll(n);
        }),
      );
      expect(c.upserts, isEmpty);
      expect(c.deletes, isEmpty);
    });

    test('Deck edits change only that Frame', () {
      final c = changes(
        base,
        after((n) {
          final s = sc.findScene(n, 'sc_d')!;
          sc.addDeck(s, 'Sing');
          sc.renameDeck(s, 'd1', 'Read aloud');
          sc.moveToDeck(n, s, ['C'], 'd1');
        }),
      );
      expect(keys(c.upserts), ['frame/sc_d']);
      expect(c.deletes, isEmpty);
    });

    test('a new Frame in the middle: that Frame and the order', () {
      final c = changes(
        base,
        after((n) {
          final s = sc.createScene(n, 'blank', name: 'Inserted', after: 'sc_d');
          s['id'] = 'sc_new';
        }),
      );
      expect(keys(c.upserts)..sort(), ['frame/sc_new', 'order/order']);
      expect(c.deletes, isEmpty);
    });

    test('a deleted Frame: a delete and the order', () {
      final c = changes(base, after((n) => (n['scenes'] as List).removeWhere((s) => (s as Json)['id'] == 'sc_e')));
      expect([for (final d in c.deletes) '${d.kind}/${d.id}'], ['frame/sc_e']);
      expect([for (final e in c.upserts) e.kind], ['order']);
    });

    test("a card's look is the theme; what it shows is not sent", () {
      final c = changes(
        base,
        after((n) {
          (n['question'] as Json)['transition'] = 'rise';
          (n['question'] as Json)['text'] = 'Live text';
          (n['question'] as Json)['visible'] = true;
        }),
      );
      expect(keys(c.upserts), ['theme/cards']);
      expect(jsonEncode([for (final e in c.upserts) e.toJson()]), isNot(contains('Live text')));
    });

    test('a Frame the order does not list yet is kept, at the end', () {
      final s = split(dk);
      final far = Entity('frame', 'sc_far', {...(s.entities.firstWhere((e) => e.id == 'sc_e').body as Json), 'id': 'sc_far', 'name': 'From the Mac'});
      final joined = join([...s.entities, far], s.local);
      expect([for (final f in joined['scenes'] as List) (f as Json)['id']], ['sc_d', 'sc_e', 'sc_far']);
    });
  });
}
