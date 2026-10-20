/// Where the state lives, and how a change is saved. The same two ways the Windows app's store.js works:
///
/// - [LocalBackend]: this device's own file (kc-saved-content.json, the Windows app's format). Used on a Mac, and on
///   a Windows PC without the Kingdom Connect program running.
/// - [EngineBackend]: a running Kingdom Connect program (server.py) on this PC (127.0.0.1) or, with its PIN, on the
///   network: the phone remote. Changes are sent the way store.js sends them (the whole state, with the revision it
///   was based on); when someone else saved first the program answers 409 with the latest state, and the change is
///   made again on top of it.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'model.dart';
import 'normalize.dart';

enum Link { connecting, online, offline, needsPin }

abstract class StateBackend {
  /// The latest state (always complete: normalized).
  Json get state;

  /// Every new state, in order.
  Stream<Json> get changes;

  Link get link;
  Stream<Link> get linkChanges;

  /// "This Mac", "Kingdom Connect on this PC", "Kingdom Connect at 192.168.1.20"…
  String get label;

  Future<void> start();

  /// Makes a change (fn edits a copy of the state) and saves it. Returns the saved state.
  Future<Json> update(void Function(Json n) fn);

  Future<void> dispose();
}

class _Base {
  final _changes = StreamController<Json>.broadcast();
  final _links = StreamController<Link>.broadcast();
  Json _state = normalize(null);
  Link _link = Link.connecting;

  void setState(Json s) {
    _state = s;
    _changes.add(s);
  }

  void setLink(Link l) {
    if (_link == l) return;
    _link = l;
    _links.add(l);
  }

  Future<void> close() async {
    await _changes.close();
    await _links.close();
  }
}

class LocalBackend extends _Base implements StateBackend {
  LocalBackend(this.file, {this.label = 'This device'});

  final File file;

  @override
  final String label;

  @override
  Json get state => _state;
  @override
  Stream<Json> get changes => _changes.stream;
  @override
  Link get link => _link;
  @override
  Stream<Link> get linkChanges => _links.stream;

  @override
  Future<void> start() async {
    if (file.existsSync()) {
      try {
        setState(normalize(jsonDecode(await file.readAsString())));
      } on FormatException {
        // a damaged file: keep it aside (never overwrite what someone might recover) and start fresh
        await file.copy('${file.path}.damaged-${DateTime.now().millisecondsSinceEpoch}');
        setState(normalize(null));
      }
    } else {
      setState(normalize(null));
    }
    setLink(Link.online);
  }

  @override
  Future<Json> update(void Function(Json n) fn) async {
    final next = deepCopy(_state);
    fn(next);
    next['rev'] = ((_state['rev'] as num?) ?? 0) + 1;
    await file.parent.create(recursive: true);
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsString(const JsonEncoder.withIndent('  ').convert(next), flush: true);
    await tmp.rename(file.path); // atomic, like server.py save_state
    setState(next);
    return next;
  }

  @override
  Future<void> dispose() => close();
}

class EngineBackend extends _Base implements StateBackend {
  EngineBackend(this.base, {http.Client? client, String? cookie, this.isRemote = false})
    : _client = client ?? http.Client(),
      _cookie = cookie; // ignore: prefer_initializing_formals

  /// http://127.0.0.1:8750/ or http://192.168.1.20:8750/
  final Uri base;
  final http.Client _client;

  /// A phone or tablet on the network (needs the PIN) rather than this PC.
  final bool isRemote;
  String? _cookie;
  var _running = false;

  String? get cookie => _cookie;

  @override
  String get label => isRemote ? 'Kingdom Connect at ${base.host}' : 'Kingdom Connect on this PC';
  @override
  Json get state => _state;
  @override
  Stream<Json> get changes => _changes.stream;
  @override
  Link get link => _link;
  @override
  Stream<Link> get linkChanges => _links.stream;

  Map<String, String> get _headers => {'Content-Type': 'application/json', 'Cookie': ?_cookie};

  /// Signs in with the PIN shown in Kingdom Connect (Settings → Phone remote). Returns an error in words, or null.
  Future<String?> signIn(String pin) async {
    try {
      final r = await _client
          .post(base.resolve('api/remote-login'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'pin': pin}))
          .timeout(const Duration(seconds: 8));
      if (r.statusCode == 429) return 'Too many wrong PINs. Wait a minute, then try again.';
      if (r.statusCode == 401) return 'That PIN is not right. It is shown in Kingdom Connect on the PC.';
      if (r.statusCode != 200) return 'The PC answered with an error (${r.statusCode}).';
      final set = r.headers['set-cookie'] ?? '';
      final m = RegExp(r'kc_remote=([A-Za-z0-9_\-]+)').firstMatch(set);
      if (m == null) return 'The PC did not accept the sign-in.';
      _cookie = 'kc_remote=${m.group(1)}';
      return null;
    } on TimeoutException {
      return 'The PC did not answer. Check that the phone and the PC are on the same Wi-Fi.';
    } on Exception catch (e) {
      return 'Could not reach the PC ($e).';
    }
  }

  @override
  Future<void> start() async {
    _running = true;
    unawaited(_loop());
  }

  /// Long-polls api/state, as store.js does: the program answers as soon as something changes (or after 25 s).
  Future<void> _loop() async {
    var failures = 0;
    while (_running) {
      try {
        final since = _link == Link.online ? '?since=${_state['rev']}&wait=25' : '';
        final r = await _client.get(base.resolve('api/state$since'), headers: _headers).timeout(const Duration(seconds: 35));
        if (r.statusCode == 401 || r.statusCode == 403) {
          setLink(Link.needsPin);
          await Future<void>.delayed(const Duration(seconds: 2));
          continue;
        }
        if (r.statusCode != 200) throw HttpException('status ${r.statusCode}');
        _adopt(r.bodyBytes);
        failures = 0;
        setLink(Link.online);
      } catch (_) {
        if (!_running) return;
        failures++;
        setLink(Link.offline);
        await Future<void>.delayed(Duration(milliseconds: failures < 3 ? 600 : 2500));
      }
    }
  }

  void _adopt(List<int> body) {
    final d = jsonDecode(utf8.decode(body));
    if (d is! Map) return;
    final s = Map<String, dynamic>.from(d)
      ..remove('libraryRev')
      ..remove('libraryOmitted');
    if ((s['rev'] as num? ?? -1) == (_state['rev'] as num? ?? -2) && _link == Link.online) return;
    setState(normalize(s));
  }

  @override
  Future<Json> update(void Function(Json n) fn) async {
    for (var attempt = 0; attempt < 3; attempt++) {
      final next = deepCopy(_state);
      fn(next);
      final body = {...next, 'baseRev': _state['rev']}..remove('rev');
      final r = await _client.post(base.resolve('api/state'), headers: _headers, body: jsonEncode(body)).timeout(const Duration(seconds: 10));
      if (r.statusCode == 409) {
        _adopt(r.bodyBytes); // someone else saved first: make the change again on top of theirs
        continue;
      }
      if (r.statusCode == 401 || r.statusCode == 403) {
        setLink(Link.needsPin);
        throw const HttpException('Please enter the PIN again.');
      }
      if (r.statusCode != 200) throw HttpException('The PC answered with an error (${r.statusCode}).');
      _adopt(r.bodyBytes);
      return _state;
    }
    throw const HttpException('Others kept changing things at the same moment. Try again.');
  }

  /// Is a Kingdom Connect program answering here? (api/app/ping)
  static Future<bool> isKingdomConnect(Uri base, {http.Client? client}) async {
    final c = client ?? http.Client();
    try {
      final r = await c.get(base.resolve('api/app/ping')).timeout(const Duration(milliseconds: 1500));
      if (r.statusCode != 200) return false;
      final d = jsonDecode(r.body);
      return d is Map && d['app'] == 'Kingdom Connect';
    } catch (_) {
      return false;
    } finally {
      if (client == null) c.close();
    }
  }

  @override
  Future<void> dispose() async {
    _running = false;
    _client.close();
    await close();
  }
}
