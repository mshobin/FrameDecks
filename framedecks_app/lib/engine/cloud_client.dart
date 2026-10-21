/// The link to the FrameDecks cloud (SaaS Phase 2: accounts and sync): the Dart side of docs/architecture/cloud-api.md,
/// doing what cloud_link.py does for the Windows program. It holds this computer's sign-in and carries the requests;
/// cloud_sync.dart decides what to sync.
///
/// - The refresh token is kept in the system's secure storage (the macOS Keychain, libsecret on Linux), or, where that
///   is not available, in a file only this user can read. Access tokens live in memory only.
/// - A refresh token can be used only once: every refresh stores the new one. Presenting a used one again signs every
///   computer of that sign-in out (401 token_reused), so this computer forgets its sign-in.
/// - Everything here is optional: signed out, or with no cloud address set (FRAMEDECKS_API or the "api" setting),
///   FrameDecks works exactly as before, and no request ever leaves the computer.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'backend.dart';
import 'cloud_sync.dart';
import 'model.dart';

const _timeout = Duration(seconds: 15);

/// An answer from the cloud (or no answer), in words for people.
class CloudError implements Exception {
  CloudError(this.status, this.code, this.message);

  final int status;
  final String code, message;

  @override
  String toString() => message;
}

// ---------------------------------------------------------------- where the sign-in is kept

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> delete();
}

/// A secret in a file only this user can read (0600): where secure storage is not available, and in tests.
class FileTokenStore implements TokenStore {
  FileTokenStore(this.file);

  final File file;

  @override
  Future<String?> read() async {
    try {
      final v = (await file.readAsString()).trim();
      return v.isEmpty ? null : v;
    } on FileSystemException {
      return null;
    }
  }

  @override
  Future<void> write(String value) async {
    await file.parent.create(recursive: true);
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsString('', flush: true); // created empty, then made private before the secret goes in
    if (!Platform.isWindows) {
      try {
        await Process.run('chmod', ['600', tmp.path]);
      } on Object {
        // no chmod here (a sandbox): the folder is this user's own
      }
    }
    await tmp.writeAsString(value, flush: true);
    await tmp.rename(file.path);
  }

  @override
  Future<void> delete() async {
    try {
      await file.delete();
    } on FileSystemException {
      // already gone
    }
  }
}

/// The system's secure storage (Keychain, libsecret, Credential Manager); the private file when it cannot be used.
class SecureTokenStore implements TokenStore {
  SecureTokenStore(this.fallback, {this.storage = const FlutterSecureStorage()});

  static const _key = 'framedecks-cloud-refresh';
  final FlutterSecureStorage storage;
  final FileTokenStore fallback;
  var _useFile = false;

  Future<T> _try<T>(Future<T> Function() secure, Future<T> Function() file) async {
    if (_useFile) return file();
    try {
      return await secure();
    } catch (_) {
      _useFile = true; // no keychain here (a Linux without libsecret, a sandbox without the entitlement)
      return file();
    }
  }

  @override
  Future<String?> read() => _try(() async => await storage.read(key: _key) ?? await fallback.read(), fallback.read);

  @override
  Future<void> write(String value) => _try(() async {
    await storage.write(key: _key, value: value);
    await fallback.delete();
  }, () => fallback.write(value));

  @override
  Future<void> delete() async {
    await fallback.delete();
    if (!_useFile) {
      try {
        await storage.delete(key: _key);
      } catch (_) {}
    }
  }
}

// ---------------------------------------------------------------- the link

/// This computer's account link. Every method answers or throws a [CloudError].
class CloudClient {
  CloudClient({
    required this.dir,
    required this.appVersion,
    String? platform,
    TokenStore? secret,
    http.Client? client,
    String? api,
    Map<String, String>? environment,
    this.pollEvery = const Duration(seconds: 2),
  }) : platform = platform ?? (Platform.isWindows ? 'windows' : Platform.isMacOS ? 'macos' : 'linux'),
       secret = secret ?? SecureTokenStore(FileTokenStore(File('${dir.path}${Platform.pathSeparator}kc-cloud-token'))),
       _client = client ?? http.Client(),
       _env = environment ?? Platform.environment {
    prefs = _load(_prefsFile);
    if (api != null) prefs['api'] = api;
  }

  /// The app's support folder: kc-cloud.json (the settings and who is signed in) and kc-cloud-sync.json (the sync
  /// state), as the Windows program keeps them.
  final Directory dir;
  final String appVersion;

  /// windows, macos or linux: what the cloud accepts for a computer (anything else signs in as linux).
  final String platform;
  final TokenStore secret;
  final Duration pollEvery;
  final http.Client _client;
  final Map<String, String> _env;
  late Json prefs;

  String? _access;
  var _accessExp = 0; // ms since 1970
  Future<String>? _refreshing;
  ({String token, DateTime until})? _poll;
  var lastError = '';
  var _signedIn = false;

  final _changes = StreamController<void>.broadcast();

  /// Something the account panel shows changed (signed in or out, a browser sign-in started or ended…).
  Stream<void> get changes => _changes.stream;
  void _changed() {
    if (!_changes.isClosed) _changes.add(null);
  }

  File get _prefsFile => File('${dir.path}${Platform.pathSeparator}kc-cloud.json');
  File get _stateFile => File('${dir.path}${Platform.pathSeparator}kc-cloud-sync.json');

  /// Reads whether a sign-in is kept (call once at start; the token store is asynchronous).
  Future<void> start() async {
    _signedIn = prefs['account'] is Map && await secret.read() != null;
    _changed();
  }

  // ---- small files
  static Json _load(File f) {
    try {
      final d = jsonDecode(f.readAsStringSync());
      return d is Map ? Map<String, dynamic>.from(d) : {};
    } on Object {
      return {};
    }
  }

  Future<void> _write(File f, Object data) async {
    await f.parent.create(recursive: true);
    final tmp = File('${f.path}.tmp');
    await tmp.writeAsString(jsonEncode(data), flush: true);
    await tmp.rename(f.path);
  }

  Future<void> _savePrefs() => _write(_prefsFile, prefs);

  // ---- settings people can change
  String get api => ((_env['FRAMEDECKS_API'] ?? '').isNotEmpty ? _env['FRAMEDECKS_API']! : (prefs['api'] ?? '').toString()).replaceFirst(RegExp(r'/+$'), '');

  /// Is a cloud address set? Without one nothing here touches the network.
  bool get configured => api.isNotEmpty;
  bool get signedIn => _signedIn;
  bool get browserSignIn => _poll != null;
  bool get syncMeeting => prefs['syncMeeting'] == true; // D6: off by default
  bool get pauseLive => prefs['pauseLive'] == true;
  String get computerName {
    final n = (prefs['computerName'] ?? '').toString();
    if (n.isNotEmpty) return n;
    try {
      return Platform.localHostname.isEmpty ? 'This computer' : Platform.localHostname;
    } on Object {
      return 'This computer';
    }
  }

  Json? get user => (prefs['account'] as Map?)?['user'] as Json?;
  Json? get workspace => (prefs['account'] as Map?)?['workspace'] as Json?;
  Json? get runtime => (prefs['account'] as Map?)?['runtime'] as Json?;
  SyncPrefs syncPrefs() => SyncPrefs(syncMeeting: syncMeeting, pauseLive: pauseLive);

  Future<void> setSettings({String? api, bool? syncMeeting, bool? pauseLive, String? computerName}) async {
    if (api != null && (_env['FRAMEDECKS_API'] ?? '').isEmpty) {
      final a = api.trim().replaceFirst(RegExp(r'/+$'), '');
      if (a.isNotEmpty && !a.startsWith('https://') && !a.startsWith('http://127.0.0.1') && !a.startsWith('http://localhost')) {
        throw CloudError(400, 'api_not_https', 'The cloud address must start with https://');
      }
      prefs['api'] = a;
    }
    if (syncMeeting != null) prefs['syncMeeting'] = syncMeeting;
    if (pauseLive != null) prefs['pauseLive'] = pauseLive;
    if (computerName != null) {
      final n = computerName.trim();
      prefs['computerName'] = n.length > 60 ? n.substring(0, 60) : n;
    }
    await _savePrefs();
    _changed();
  }

  // ---- HTTP
  Future<(int, Json)> _http(String method, String path, [Object? body, String? token]) async {
    if (!configured) throw CloudError(503, 'not_configured', 'The FrameDecks cloud address is not set yet.');
    final req = http.Request(method, Uri.parse('$api/v1$path'))
      ..headers.addAll({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'FrameDecks/$appVersion ($platform)',
        'Authorization': ?(token == null ? null : 'Bearer $token'),
      });
    if (body != null) req.body = jsonEncode(body);
    http.Response r;
    try {
      r = await http.Response.fromStream(await _client.send(req).timeout(_timeout)).timeout(_timeout);
    } on Exception {
      throw CloudError(0, 'offline', 'The FrameDecks cloud cannot be reached. Presenting is not affected.');
    }
    Object? data;
    try {
      data = r.bodyBytes.isEmpty ? <String, dynamic>{} : jsonDecode(utf8.decode(r.bodyBytes));
    } on FormatException {
      data = null;
    }
    if (r.statusCode >= 200 && r.statusCode < 300) {
      if (data is! Map) throw CloudError(r.statusCode, 'bad_answer', 'The FrameDecks cloud gave an answer FrameDecks cannot read.');
      return (r.statusCode, Map<String, dynamic>.from(data));
    }
    final err = data is Map && data['error'] is Map ? data['error'] as Map : const {};
    throw CloudError(
      r.statusCode,
      (err['code'] ?? 'http_${r.statusCode}').toString(),
      (err['message'] ?? 'The FrameDecks cloud answered ${r.statusCode}.').toString(),
    );
  }

  Json _clientInfo() => {
    'type': 'runtime',
    'name': computerName,
    'platform': platform == 'windows' || platform == 'macos' ? platform : 'linux',
    'appVersion': appVersion,
    if (runtime?['id'] != null) 'runtimeId': runtime!['id'],
  };

  /// Keeps a session from any sign-in: the refresh token in the token store, the rest in kc-cloud.json.
  Future<void> _keep(Json s) async {
    await secret.write(s['refresh'] as String);
    _access = s['access'] as String?;
    _accessExp = (s['accessExpiresAt'] as num?)?.toInt() ?? 0;
    prefs['account'] = {for (final k in ['user', 'workspace', 'runtime']) k: s[k]};
    await _savePrefs();
    lastError = '';
    _signedIn = true;
    _changed();
  }

  /// stale: the access token the cloud just refused (a newer one from a refresh in the meantime is used instead).
  Future<String> _token({bool force = false, String? stale}) {
    if (force && _access != null && _access != stale) return Future.value(_access);
    if (!force && _access != null && DateTime.now().millisecondsSinceEpoch < _accessExp - 30000) return Future.value(_access);
    // one refresh at a time: a refresh token works once, so two at once would sign this computer out
    return _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
  }

  Future<String> _refresh() async {
    final refresh = await secret.read();
    if (refresh == null) throw CloudError(401, 'signed_out', 'Sign in to your FrameDecks account first.');
    final Json s;
    try {
      s = (await _http('POST', '/auth/refresh', {'refresh': refresh})).$2;
    } on CloudError catch (e) {
      if (e.status == 401) await _forget(); // revoked, reused or expired: this computer is signed out
      rethrow;
    }
    await secret.write(s['refresh'] as String); // the old one is spent: always keep the new one
    _access = s['access'] as String;
    _accessExp = (s['accessExpiresAt'] as num?)?.toInt() ?? 0;
    return _access!;
  }

  Future<void> _forget() async {
    await secret.delete();
    _access = null;
    _accessExp = 0;
    prefs.remove('account');
    await _savePrefs();
    _signedIn = false;
    _changed();
  }

  /// An authorised call: on 401 it refreshes the access token once and tries again.
  Future<Json> call(String method, String path, [Object? body]) async {
    String? used;
    try {
      used = await _token();
      return (await _http(method, path, body, used)).$2;
    } on CloudError catch (e) {
      if (e.status != 401 || e.code == 'signed_out' || e.code == 'token_reused') {
        lastError = e.message;
        rethrow;
      }
    }
    return (await _http(method, path, body, await _token(force: true, stale: used))).$2;
  }

  // ---- signing in
  Future<Json> providers() async => (await _http('GET', '/auth/providers')).$2;

  /// Emails a 6-digit code. In the cloud's dev and test environments the answer has `devCode`.
  Future<Json> emailStart(String email) async {
    final e = email.trim();
    if (!e.contains('@') || e.length > 254) throw CloudError(400, 'email_invalid', 'Enter your email address.');
    return (await _http('POST', '/auth/email/start', {'email': e})).$2;
  }

  Future<void> emailVerify(String email, String code) async {
    final s = (await _http('POST', '/auth/email/verify', {'email': email.trim(), 'code': code.trim(), 'client': _clientInfo()})).$2;
    await _keep(s);
  }

  /// Google / Microsoft / Apple: starts a browser sign-in session and waits for it (polling). Returns the page to open
  /// in the browser.
  Future<String> browserStart() async {
    final s = (await _http('POST', '/auth/session', {'client': _clientInfo()})).$2;
    final token = s['pollToken'] as String;
    _poll = (token: token, until: DateTime.now().add(const Duration(minutes: 10)));
    _changed();
    unawaited(_pollLoop(token));
    return s['url'] as String;
  }

  Future<void> _pollLoop(String token) async {
    while (true) {
      final p = _poll;
      if (p == null || p.token != token) return; // cancelled, or another sign-in started
      if (DateTime.now().isAfter(p.until)) {
        _poll = null;
        _changed();
        return;
      }
      try {
        final (status, s) = await _http('POST', '/auth/session/poll', {'pollToken': token});
        if (_poll?.token != token) return;
        if (status == 200 && s['refresh'] != null) {
          _poll = null;
          await _keep(s);
          return;
        }
      } on CloudError catch (e) {
        if (e.status == 400 || e.status == 404 || e.status == 410) {
          if (_poll?.token == token) _poll = null;
          lastError = e.message;
          _changed();
          return;
        }
      }
      await Future<void>.delayed(pollEvery);
    }
  }

  void cancelBrowser() {
    _poll = null;
    _changed();
  }

  Future<void> logout() async {
    final refresh = await secret.read();
    if (refresh != null && configured) {
      try {
        await _http('POST', '/auth/logout', {'refresh': refresh});
      } on CloudError {
        // signed out here anyway
      }
    }
    _poll = null;
    await _forget();
    try {
      await _stateFile.delete(); // the next account starts from this computer's Frames
    } on FileSystemException {
      // none yet
    }
  }

  // ---- sync (cloud_sync.dart decides what; this carries it)
  Future<Json> syncGet(int since, {int limit = 500}) => call('GET', '/sync?since=$since&limit=$limit');
  Future<Json> syncPost(List<Json> changes) => call('POST', '/sync', {'changes': changes});
  Future<Json> me() => call('GET', '/me');

  Future<Json> syncState() async {
    final s = _load(_stateFile);
    return s.isEmpty ? {'seq': 0, 'revs': {}, 'snapshot': {}} : s;
  }

  Future<void> saveSyncState(Json state) => _write(_stateFile, state);

  /// The network side of the sync engine.
  CloudNet get net => _Net(this);

  void dispose() {
    _poll = null;
    _client.close();
    _changes.close();
  }
}

class _Net implements CloudNet {
  _Net(this.c);

  final CloudClient c;

  @override
  Future<Json?> getState() => c.syncState();
  @override
  Future<void> saveState(Json state) => c.saveSyncState(state);
  @override
  Future<Json> pull(int since) => c.syncGet(since);
  @override
  Future<Json> push(List<Json> changes) => c.syncPost(changes);
}

/// Runs sync while signed in: a few seconds after a change, every minute, and when asked ("Sync now"). Like start() in
/// cloud-sync.js. Only for this computer's own file (LocalBackend): when FrameDecks on this PC keeps the Frames, the
/// program syncs them itself.
class CloudLink {
  CloudLink(this.client, this.store, {this.debounce = const Duration(seconds: 3), this.every = const Duration(minutes: 1)})
    : engine = CloudSync(net: client.net, store: store, prefs: client.syncPrefs, computer: () => client.computerName);

  final CloudClient client;
  final StateBackend store;
  final CloudSync engine;
  final Duration debounce, every;
  StreamSubscription<Json>? _sub;
  StreamSubscription<void>? _account;
  Timer? _timer, _soon;
  final _changes = StreamController<void>.broadcast();

  /// The panel redraws on this: the sign-in or the last round changed.
  Stream<void> get changes => _changes.stream;
  SyncInfo get info => engine.info;

  void _emit() {
    if (!_changes.isClosed) _changes.add(null);
  }

  Future<void> start() async {
    await client.start();
    var was = client.signedIn;
    _account = client.changes.listen((_) {
      if (!client.signedIn && was) engine.reset(); // signed out (here, or everywhere after a reused token)
      if (client.signedIn && !was) unawaited(syncNow()); // just signed in: your Frames start syncing
      was = client.signedIn;
      _emit();
    });
    _sub = store.changes.listen((_) {
      _soon?.cancel();
      _soon = Timer(debounce, () {
        if (client.signedIn) unawaited(syncNow());
      });
    });
    _timer = Timer.periodic(every, (_) => unawaited(syncNow()));
    _soon = Timer(const Duration(milliseconds: 1500), () => unawaited(syncNow()));
  }

  /// One round now (nothing when signed out or not set up).
  Future<SyncInfo> syncNow() async {
    if (!client.configured || !client.signedIn) return engine.info;
    final i = await engine.syncOnce();
    _emit();
    return i;
  }

  Future<void> dispose() async {
    _timer?.cancel();
    _soon?.cancel();
    await _sub?.cancel();
    await _account?.cancel();
    await _changes.close();
    client.dispose();
  }
}
