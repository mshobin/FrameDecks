// Cloud sync (lib/engine/cloud_sync.dart) with two computers and a fake cloud that follows
// docs/architecture/cloud-api.md §4: per-record rev, workspace seq, conflicts. The same ten scenarios as
// tests/cloud-sync.test.js, so the Studio on Windows and this app merge the same way.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/backend.dart';
import 'package:framedecks/engine/cloud_sync.dart';
import 'package:framedecks/engine/entities.dart' as ent;
import 'package:framedecks/engine/model.dart';
import 'package:framedecks/engine/normalize.dart';
import 'package:framedecks/engine/scenes.dart' as sc;

T _copy<T>(T v) => jsonDecode(jsonEncode(v)) as T;
void same(Object? a, Object? b, [String? reason]) => expect(ent.canon(a), ent.canon(b), reason: reason);

/// The cloud: one workspace.
class FakeCloud {
  FakeCloud([this.pageSize = 500]);

  final int pageSize;
  final rows = <String, Json>{};
  var seq = 0, pushes = 0, pulls = 0;

  Future<Json> pull(int since) async {
    pulls++;
    final list = rows.values.where((r) => (r['seq'] as int) > since).toList()..sort((a, b) => (a['seq'] as int) - (b['seq'] as int));
    final page = list.take(pageSize).toList();
    return _copy({'entities': page, 'seq': page.isEmpty ? since : page.last['seq'], 'more': list.length > page.length});
  }

  Future<Json> push(List<Json> changes) async {
    pushes++;
    final results = [
      for (final c in changes)
        () {
          final k = '${c['kind']}/${c['id']}', cur = rows[k];
          if ((cur?['rev'] ?? 0) != c['baseRev']) {
            return {
              'kind': c['kind'],
              'id': c['id'],
              'status': 'conflict',
              'current': cur != null
                  ? {'rev': cur['rev'], 'deleted': cur['deleted'], 'body': cur['body']}
                  : {'rev': 0, 'deleted': true, 'body': null},
            };
          }
          final r = rows[k] = {
            'kind': c['kind'],
            'id': c['id'],
            'rev': ((cur?['rev'] as int?) ?? 0) + 1,
            'seq': ++seq,
            'deleted': c['deleted'] == true,
            'body': c['deleted'] == true ? null : _copy(c['body']),
          };
          return {'kind': c['kind'], 'id': c['id'], 'status': 'ok', 'rev': r['rev'], 'seq': r['seq']};
        }(),
    ];
    return _copy({'results': results, 'seq': seq});
  }
}

class _Net implements CloudNet {
  _Net(this.cloud);

  final FakeCloud cloud;
  Json saved = {'seq': 0, 'revs': {}, 'snapshot': {}};

  @override
  Future<Json?> getState() async => _copy(saved);
  @override
  Future<void> saveState(Json state) async => saved = _copy(state);
  @override
  Future<Json> pull(int since) => cloud.pull(since);
  @override
  Future<Json> push(List<Json> changes) => cloud.push(changes);
}

/// A computer: its own file, its own sync state, sharing the cloud.
class Computer {
  Computer(this.name, this.cloud, this.store) : prefs = SyncPrefs() {
    engine = CloudSync(net: _Net(cloud), store: store, prefs: () => prefs, computer: () => name);
  }

  static var _files = 0;

  static Future<Computer> make(String name, FakeCloud cloud, Directory dir, [Json? doc]) async {
    final store = LocalBackend(File('${dir.path}/computer-${_files++}.json'));
    await store.start();
    if (doc != null) {
      await store.update((n) {
        n
          ..clear()
          ..addAll(normalize(_copy(doc)));
      });
    }
    return Computer(name, cloud, store);
  }

  final String name;
  final FakeCloud cloud;
  final LocalBackend store;
  final SyncPrefs prefs;
  late final CloudSync engine;

  Future<SyncInfo> sync() => engine.syncOnce();
  Json get() => store.state;
  Future<void> edit(void Function(Json n) fn) => store.update(fn);
  SyncInfo info() => engine.info;
  List<String> names() => [for (final s in sc.scenesOf(store.state)) s['name'] as String];
}

List<Object?> frames(Json st) => [
  for (final e in ent.split(st).entities)
    if (e.kind == 'frame' || e.kind == 'template' || e.kind == 'order') [e.kind, e.id, e.body],
];

final start = {
  'v6': true,
  'scenes': [
    {
      'id': 'sc_a',
      'name': 'Welcome',
      'decks': [
        {'id': 'd1', 'name': 'Arrive'},
        {'id': 'd2', 'name': 'Announce'},
      ],
      'layers': [
        {
          'id': 'L1',
          'kind': 'announcement',
          'deck': 'd1',
          'c': {'title': 'Welcome', 'text': 'Hi'},
        },
        {
          'id': 'L2',
          'kind': 'prayer',
          'deck': 'd2',
          'c': {'title': 'Pray', 'text': 'x'},
        },
      ],
    },
    {
      'id': 'sc_b',
      'name': 'Study',
      'layers': [
        {
          'id': 'L3',
          'kind': 'question',
          'c': {
            'items': [
              {'id': 'q1', 'text': 'Why?'},
            ],
          },
        },
      ],
    },
  ],
  'brand': {'meeting': 'Tuesday Study'},
  'meeting': {'title': 'Romans', 'presenter': 'Sam'},
};

void main() {
  late Directory dir;
  setUpAll(() => dir = Directory.systemTemp.createTempSync('fd-cloud-sync'));
  tearDownAll(() => dir.deleteSync(recursive: true));

  test('two computers and a cloud: the ten scenarios of tests/cloud-sync.test.js', () async {
    // 1. The first computer sends everything; the second gets the same Frames
    final cloud = FakeCloud();
    final a = await Computer.make('Church PC', cloud, dir, start), b = await Computer.make('Home Mac', cloud, dir);
    await a.sync();
    expect(a.info().error, '');
    expect(cloud.rows['frame/sc_a'] != null && cloud.rows['order/order'] != null && cloud.rows['brand/brand'] != null, isTrue);
    expect(cloud.rows['meeting/meeting'], isNull, reason: 'meeting details are not sent unless switched on (D6)');
    await b.sync();
    same(frames(b.get()), frames(a.get()), 'B has the same Frames, Decks and order');
    expect(b.get()['brand']['meeting'], 'Tuesday Study');
    expect(b.get()['meeting']['presenter'], isNot('Sam'), reason: 'meeting details stayed on the first computer');

    // 2. An edit travels; a second sync with nothing new sends nothing
    await a.edit((n) => sc.renameDeck(sc.findScene(n, 'sc_a')!, 'd2', 'News'));
    await a.sync();
    await b.sync();
    same([for (final d in sc.decksOf(sc.findScene(b.get(), 'sc_a')!)) d['name']], ['Arrive', 'News']);
    var before = cloud.pushes;
    await b.sync();
    await a.sync();
    expect(cloud.pushes, before, reason: 'nothing changed: nothing sent');

    // 3. Going live, stepping Decks, hiding: nothing is sent
    await a.edit((n) {
      sc.take(n, 'sc_a', 'cut');
      sc.step(n, 1, 'cut');
      sc.hideAll(n);
    });
    before = cloud.pushes;
    await a.sync();
    expect(cloud.pushes, before, reason: 'what is live is never synced');

    // 4. The same Frame changed on both computers: neither change is lost
    await a.edit((n) => sc.findScene(n, 'sc_b')!['name'] = 'Study (A)');
    await b.edit((n) => sc.findScene(n, 'sc_b')!['name'] = 'Study (B)');
    await a.sync(); // A is first: the cloud has A's
    await b.sync(); // B: the cloud's stays, B's becomes a copy
    expect(b.names(), contains('Study (A)'), reason: 'B took the cloud version');
    expect(b.names(), contains('Study (B) (from Home Mac)'), reason: "B's version kept as a copy");
    expect(b.info().conflicts, greaterThanOrEqualTo(1));
    await a.sync();
    same([...a.names()]..sort(), [...b.names()]..sort(), 'both computers end with the same Frames');
    Json copyOf(Computer c) => sc.scenesOf(c.get()).firstWhere((s) => (s['name'] as String).contains('from Home Mac'));
    same(copyOf(a), copyOf(b), 'the copy is the same on both');
    expect(copyOf(b)['id'], isNot('sc_b'));
    expect(sc.layersOf(copyOf(b))[0]['id'], isNot('L3'), reason: 'the copy has fresh ids');

    // 5. A setting changed on both: the later computer's version wins everywhere
    await a.edit((n) => n['brand']['org'] = 'Grace (A)');
    await b.edit((n) => n['brand']['org'] = 'Grace (B)');
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.get()['brand']['org'], 'Grace (B)');
    expect(b.get()['brand']['org'], 'Grace (B)');

    // 6. A deleted Frame goes everywhere; deleted here but changed there comes back
    await a.edit((n) => (n['scenes'] as List).removeWhere((s) => (s['name'] as String).contains('from Home Mac')));
    await a.sync();
    await b.sync();
    expect(b.names().any((x) => x.contains('from Home Mac')), isFalse, reason: 'the delete reached B');
    await a.edit((n) => (n['scenes'] as List).removeWhere((s) => s['id'] == 'sc_a'));
    await b.edit((n) => sc.findScene(n, 'sc_a')!['name'] = 'Welcome (edited on B)');
    await b.sync();
    await a.sync();
    await b.sync();
    expect(a.names(), contains('Welcome (edited on B)'), reason: 'deleted on A, edited on B: the Frame comes back');
    same([...a.names()]..sort(), [...b.names()]..sort());

    // 7. Meeting details sync only when switched on (D6)
    a.prefs.syncMeeting = true;
    b.prefs.syncMeeting = true;
    await a.sync();
    await b.sync();
    expect(b.get()['meeting']['presenter'], 'Sam', reason: 'switched on: the meeting details arrive');

    // 8. "Pause sync while something is on screen": nothing while something is live
    a.prefs.pauseLive = true;
    await a.edit((n) {
      sc.take(n, sc.order(n)[0]['id'], 'cut');
      n['brand']['color'] = '#123456';
    });
    before = cloud.pushes;
    await a.sync();
    expect(cloud.pushes, before, reason: 'paused while live');
    a.prefs.pauseLive = false;
    await a.sync();
    await b.sync();
    expect(b.get()['brand']['color'], '#123456', reason: 'sent once unpaused');

    // 9. Paging: a third computer pulls through small pages
    final small = FakeCloud(2)..rows.addAll(_copy<Json>(cloud.rows).cast<String, Json>());
    final d = await Computer.make('Laptop', small, dir);
    await d.sync();
    same([...d.names()]..sort(), [...a.names()]..sort(), 'every page arrives');
    expect(small.pulls, greaterThan(3), reason: 'several pages');

    // 10. Joining an account: a Frame the account already has (the same content under other ids, like the starter
    //     Frames every computer makes) is not added twice; one that differs at all is kept
    final study = _copy(sc.findScene(a.get(), 'sc_b')!);
    final twin = {..._copy(study), 'id': 'sc_twin', 'created': 1, 'modified': 2, 'creator': 'Laptop'};
    final twinLayers = twin['layers'] as List;
    for (var i = 0; i < twinLayers.length; i++) {
      final l = twinLayers[i] as Json;
      l['id'] = 'T$i';
      final its = (l['c'] as Json)['items'] as List? ?? const [];
      for (var j = 0; j < its.length; j++) {
        (its[j] as Json)['id'] = 't$i$j';
      }
    }
    final own = {..._copy(study), 'id': 'sc_own', 'name': '${study['name']} (laptop notes)'};
    final f = await Computer.make(
      'Laptop',
      cloud,
      dir,
      {
        'v6': true,
        'scenes': [twin, own],
      },
    );
    await f.sync();
    expect(sc.scenesOf(f.get()).any((x) => x['id'] == 'sc_twin'), isFalse, reason: 'the same Frame is not added twice: ${f.names()}');
    expect(sc.scenesOf(f.get()).any((x) => x['id'] == 'sc_own'), isTrue, reason: 'a Frame that differs is kept');
    expect(cloud.rows['frame/sc_twin'] == null && cloud.rows['frame/sc_own'] != null, isTrue, reason: 'only the different one reaches the account');
    expect(f.names().where((n) => n == study['name']).length, 1);
  });

  test('never two rounds at once: a round asked for meanwhile runs right after', () async {
    final cloud = FakeCloud();
    final a = await Computer.make('Church PC', cloud, dir, start);
    final first = a.sync(), second = a.sync();
    await second; // answers at once, while the first is still running
    await first;
    expect(cloud.pulls, 2, reason: 'the second round ran after the first, not beside it');
  });
}
