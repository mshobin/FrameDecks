import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kingdom_connect/services/engine/engine_client.dart';

void main() {
  test('finds the engine on its port and reads the meeting, Frames and what is live', () async {
    final client = MockClient((r) async {
      if (r.url.port != 8751) throw http.ClientException('refused');
      if (r.url.path == '/api/app/ping') {
        return http.Response(jsonEncode({'app': 'Kingdom Connect', 'version': '6.10', 'installedApp': true}), 200);
      }
      return http.Response(
          jsonEncode({
            'meeting': {'title': 'Romans'},
            'scenes': [
              {'id': 'a', 'name': 'Welcome'},
              {'id': 't', 'name': 'Template', 'tpl': true},
              {'id': 'b', 'name': 'Questions'},
            ],
            'live': {'scene': 'b'},
          }),
          200);
    });
    final s = await EngineClient(client: client, ports: [8750, 8751]).status();
    expect(s.running, isTrue);
    expect(s.port, 8751);
    expect(s.version, '6.10');
    expect(s.frames, ['Welcome', 'Questions']);
    expect(s.liveFrame, 'Questions');
    expect(s.meetingTitle, 'Romans');
    expect(s.studioUrl.toString(), 'http://127.0.0.1:8751/');
  });

  test('another program on the port is not the engine', () async {
    final client = MockClient((r) async => http.Response(jsonEncode({'app': 'Something else'}), 200));
    expect((await EngineClient(client: client, ports: [8750]).status()).running, isFalse);
  });
}
