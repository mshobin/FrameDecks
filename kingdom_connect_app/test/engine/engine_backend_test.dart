// The engine connection against a real Kingdom Connect program (server.py). Runs when KC_ENGINE_URL is set, e.g.
//   KC_ENGINE_URL=http://127.0.0.1:8750/ KC_ENGINE_PIN=1234 flutter test test/engine/engine_backend_test.dart
// Without it, the test is skipped (CI has no running program).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/engine/backend.dart';
import 'package:kingdom_connect/engine/scenes.dart' as sc;

void main() {
  final url = Platform.environment['KC_ENGINE_URL'];
  final pin = Platform.environment['KC_ENGINE_PIN'];

  test(
    'reads, takes a Frame live, survives a conflict, and signs in with the PIN',
    () async {
      final base = Uri.parse(url!);
      expect(await EngineBackend.isKingdomConnect(base), isTrue);
      final a = EngineBackend(base), b = EngineBackend(base);
      await a.start();
      await b.start();
      await a.changes.first.timeout(const Duration(seconds: 5));
      await b.changes.first.timeout(const Duration(seconds: 5));
      expect(sc.order(a.state), isNotEmpty, reason: 'the demo data has Frames');

      final first = sc.order(a.state).first['id'], second = sc.order(a.state)[1]['id'];
      await a.update((n) => sc.take(n, first));
      expect(a.state['live']['scene'], first);
      // b still has the old revision: its change must be made again on top of a's (409, then retry)
      await b.update((n) => sc.take(n, second));
      expect(b.state['live']['scene'], second);
      await a.changes.firstWhere((s) => s['live']['scene'] == second).timeout(const Duration(seconds: 30));

      if (pin != null) {
        final remote = EngineBackend(base, isRemote: true);
        expect(await remote.signIn('0000x'), contains('not right'));
        expect(await remote.signIn(pin), isNull);
        expect(remote.cookie, startsWith('kc_remote='));
        await remote.dispose();
      }
      await a.dispose();
      await b.dispose();
    },
    skip: url == null ? 'set KC_ENGINE_URL to run against a Kingdom Connect program' : false,
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
