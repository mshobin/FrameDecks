// The cloud link (lib/engine/cloud_client.dart) against a small fake cloud on localhost that follows
// docs/architecture/cloud-api.md §1–§2: email codes, the browser sign-in session, refresh tokens that work once (a
// reused one revokes the sign-in), and 401 for an access token the cloud no longer accepts.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/cloud_client.dart';

class FakeAuth {
  late HttpServer server;
  var n = 0, refreshes = 0, polls = 0, pendingPolls = 2;
  final access = <String>{}, liveRefresh = <String>{}, spent = <String>{};
  final requests = <String>[];
  Map<String, dynamic>? lastClient;
  var loggedOut = false;

  String get url => 'http://127.0.0.1:${server.port}';

  Map<String, dynamic> session() {
    n++;
    access.add('a$n');
    liveRefresh.add('r$n');
    return {
      'access': 'a$n',
      'accessExpiresAt': DateTime.now().add(const Duration(minutes: 10)).millisecondsSinceEpoch,
      'refresh': 'r$n',
      'user': {'id': 'u_1', 'email': 'ann@example.org', 'name': 'Ann'},
      'workspace': {'id': 'w_1', 'name': "Ann's ministry", 'role': 'admin'},
      'runtime': {'id': 'r_1', 'name': 'Home Mac'},
    };
  }

  Future<void> start() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((req) async {
      final raw = await utf8.decodeStream(req);
      final body = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map<String, dynamic>;
      requests.add('${req.method} ${req.uri.path}');
      void answer(int status, [Object? data]) {
        req.response.statusCode = status;
        req.response.headers.contentType = ContentType.json;
        if (data != null) req.response.write(jsonEncode(data));
        req.response.close();
      }

      void err(int status, String code) => answer(status, {
        'error': {'code': code, 'message': 'Error $code'},
      });

      switch ('${req.method} ${req.uri.path}') {
        case 'POST /v1/auth/email/start':
          return answer(202, {'sent': true, 'devCode': '123456'});
        case 'POST /v1/auth/email/verify':
          if (body['code'] != '123456') return err(400, 'code_wrong');
          lastClient = body['client'] as Map<String, dynamic>;
          return answer(200, session());
        case 'POST /v1/auth/session':
          lastClient = body['client'] as Map<String, dynamic>;
          return answer(201, {'id': 's_1', 'url': '$url/signin/s_1', 'pollToken': 'p_1', 'expiresAt': 0});
        case 'POST /v1/auth/session/poll':
          polls++;
          if (body['pollToken'] != 'p_1') return err(410, 'session_expired');
          if (polls <= pendingPolls) return answer(202, {'pending': true});
          if (polls == pendingPolls + 1) return answer(200, session());
          return err(410, 'session_expired');
        case 'POST /v1/auth/refresh':
          refreshes++;
          final r = body['refresh'];
          if (spent.contains(r)) {
            liveRefresh.clear(); // a reused token revokes the whole family
            access.clear();
            return err(401, 'token_reused');
          }
          if (!liveRefresh.remove(r)) return err(401, 'unauthorized');
          spent.add(r as String);
          final s = session();
          return answer(200, {'access': s['access'], 'accessExpiresAt': s['accessExpiresAt'], 'refresh': s['refresh']});
        case 'POST /v1/auth/logout':
          loggedOut = true;
          liveRefresh.remove(body['refresh']);
          return answer(204);
        case 'GET /v1/sync':
          final auth = req.headers.value('authorization') ?? '';
          if (!access.contains(auth.replaceFirst('Bearer ', ''))) return err(401, 'unauthorized');
          return answer(200, {'entities': [], 'seq': int.parse(req.uri.queryParameters['since'] ?? '0'), 'more': false});
      }
      err(404, 'not_found');
    });
  }
}

void main() {
  late Directory dir;
  late FakeAuth cloud;
  late FileTokenStore secret;

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('fd-cloud-client');
    secret = FileTokenStore(File('${dir.path}/kc-cloud-token'));
    cloud = FakeAuth();
    await cloud.start();
  });
  tearDown(() async {
    await cloud.server.close(force: true);
    dir.deleteSync(recursive: true);
  });

  CloudClient make({String? api, String platform = 'macos'}) => CloudClient(
    dir: dir,
    appVersion: '6.10',
    platform: platform,
    secret: secret,
    api: api,
    environment: const {},
    pollEvery: const Duration(milliseconds: 10),
  );

  Future<CloudClient> signedIn() async {
    final c = make(api: cloud.url);
    expect((await c.emailStart('ann@example.org'))['devCode'], '123456');
    await c.emailVerify('ann@example.org', '123456');
    return c;
  }

  test('with no cloud address nothing touches the network', () async {
    final c = make();
    await c.start();
    expect(c.configured, isFalse);
    expect(c.signedIn, isFalse);
    await expectLater(c.emailStart('ann@example.org'), throwsA(isA<CloudError>().having((e) => e.code, 'code', 'not_configured')));
    expect(cloud.requests, isEmpty);
  });

  test('email sign-in: a runtime with its platform; the refresh token is kept privately', () async {
    await expectLater(make(api: cloud.url).emailVerify('ann@example.org', '000000'), throwsA(isA<CloudError>().having((e) => e.code, 'code', 'code_wrong')));
    final c = await signedIn();
    expect(c.signedIn, isTrue);
    expect(cloud.lastClient, {'type': 'runtime', 'name': c.computerName, 'platform': 'macos', 'appVersion': '6.10'});
    expect(await secret.read(), 'r1');
    if (!Platform.isWindows) expect(secret.file.statSync().modeString(), 'rw-------');
    expect(c.workspace?['name'], "Ann's ministry");
    // the next sign-in keeps the same computer entry; anything but windows / macos signs in as linux
    final again = make(api: cloud.url, platform: 'android');
    await again.emailVerify('ann@example.org', '123456');
    expect(cloud.lastClient?['runtimeId'], 'r_1');
    expect(cloud.lastClient?['platform'], 'linux');
    // a new start of the app finds the sign-in
    final later = make(api: cloud.url);
    await later.start();
    expect(later.signedIn, isTrue);
  });

  test('401: one refresh (the new refresh token kept), then the call again', () async {
    final c = await signedIn();
    expect((await c.syncGet(0))['more'], isFalse);
    cloud.access.clear(); // the cloud stops accepting this access token
    expect((await c.syncGet(5))['seq'], 5);
    expect(cloud.refreshes, 1);
    expect(await secret.read(), 'r2', reason: 'a refresh token works once: the new one is kept');
    // two calls at once after another 401 share one refresh (two would spend the same token twice)
    cloud.access.clear();
    await Future.wait([c.syncGet(1), c.syncGet(2)]);
    expect(cloud.refreshes, 2);
    expect(c.signedIn, isTrue);
  });

  test('a reused refresh token signs this computer out', () async {
    final c = await signedIn();
    cloud.spent.add('r1'); // someone used this sign-in's refresh token already
    cloud.liveRefresh.remove('r1');
    cloud.access.clear();
    await expectLater(c.syncGet(0), throwsA(isA<CloudError>().having((e) => e.code, 'code', 'token_reused')));
    expect(c.signedIn, isFalse);
    expect(await secret.read(), isNull);
    expect(c.user, isNull);
  });

  test('the browser sign-in: 201, then waiting (202) until the session arrives (200)', () async {
    final c = make(api: cloud.url);
    final url = await c.browserStart();
    expect(url, '${cloud.url}/signin/s_1');
    expect(c.browserSignIn, isTrue);
    await c.changes.firstWhere((_) => c.signedIn).timeout(const Duration(seconds: 5));
    expect(cloud.polls, 3);
    expect(c.browserSignIn, isFalse);
    expect(await secret.read(), 'r1');
  });

  test('an expired browser sign-in (410) stops waiting', () async {
    cloud.pendingPolls = 0;
    cloud.polls = 1; // the session was already taken
    final c = make(api: cloud.url);
    await c.browserStart();
    await c.changes.firstWhere((_) => !c.browserSignIn).timeout(const Duration(seconds: 5));
    expect(c.signedIn, isFalse);
    expect(c.lastError, isNotEmpty);
  });

  test('signing out tells the cloud and forgets the sign-in and the sync state', () async {
    final c = await signedIn();
    await c.saveSyncState({'seq': 3, 'revs': {}, 'snapshot': {}});
    await c.logout();
    expect(cloud.loggedOut, isTrue);
    expect(c.signedIn, isFalse);
    expect(await secret.read(), isNull);
    expect((await c.syncState())['seq'], 0);
  });
}
