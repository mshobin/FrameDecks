/// The Wi-Fi remote's PIN and sign-ins, as server.py keeps them (runtime-protocol.md §2):
///
/// - the PIN: 6 digits in kc-remote-pin.txt, made when missing or not 6 digits;
/// - sessions: the `kc_remote` cookie, 30 days, kept in kc-remote-sessions.json ({token: expiry in epoch seconds});
/// - 5 wrong PINs from one address, then that address waits 60 seconds.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:math';

const cookieName = 'kc_remote';
const sessionDays = 30;
final _cookieToken = RegExp('$cookieName=([A-Za-z0-9_\\-]{20,100})');

/// The outcome of one sign-in: 200 with a token, 401 (wrong PIN) or 429 (wait [wait] seconds).
typedef LoginResult = ({int status, String? token, int wait});

class RemoteAccess {
  RemoteAccess(this.dir, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now {
    _sessions = _load();
  }

  final Directory dir;
  final DateTime Function() _clock;
  final _random = Random.secure();
  late Map<String, double> _sessions;

  /// address -> (wrong tries, locked until in epoch seconds)
  final _failures = <String, (int, double)>{};

  File get pinFile => File('${dir.path}${Platform.pathSeparator}kc-remote-pin.txt');
  File get sessionsFile => File('${dir.path}${Platform.pathSeparator}kc-remote-sessions.json');

  double get _now => _clock().microsecondsSinceEpoch / 1e6;

  /// The PIN, made (and saved) when there is none yet.
  String pin() {
    try {
      final p = pinFile.readAsStringSync().trim();
      if (RegExp(r'^\d{6}$').hasMatch(p)) return p;
    } on FileSystemException {
      // made below
    }
    final p = _random.nextInt(1000000).toString().padLeft(6, '0');
    dir.createSync(recursive: true);
    pinFile.writeAsStringSync('$p\n');
    return p;
  }

  Map<String, double> _load() {
    try {
      final d = jsonDecode(sessionsFile.readAsStringSync());
      if (d is! Map) return {};
      final now = _now;
      return {
        for (final e in d.entries)
          if (e.value is num && (e.value as num) > now) e.key.toString(): (e.value as num).toDouble(),
      };
    } on Object {
      return {};
    }
  }

  void _save() {
    try {
      sessionsFile.writeAsStringSync(jsonEncode(_sessions));
    } on FileSystemException {
      // like server.py: a session that cannot be kept lasts until the program closes
    }
  }

  /// The session token in a Cookie header, if any.
  static String? tokenIn(String cookieHeader) => _cookieToken.firstMatch(cookieHeader)?.group(1);

  bool signedIn(String cookieHeader) {
    final t = tokenIn(cookieHeader);
    if (t == null) return false;
    final exp = _sessions[t];
    return exp != null && exp > _now;
  }

  /// One sign-in try from [address] with what the phone sent as `pin`.
  LoginResult login(String address, String given) {
    final now = _now;
    final (count, until) = _failures[address] ?? (0, 0.0);
    if (until > now) return (status: 429, token: null, wait: (until - now).toInt() + 1);
    if (!_same(utf8.encode(given), utf8.encode(pin()))) {
      final n = count + 1;
      _failures[address] = n >= 5 ? (0, now + 60) : (n, 0.0);
      return (status: 401, token: null, wait: 0);
    }
    _failures.remove(address);
    final token = base64Url.encode([for (var i = 0; i < 32; i++) _random.nextInt(256)]).replaceAll('=', '');
    _sessions[token] = now + sessionDays * 86400;
    _save();
    return (status: 200, token: token, wait: 0);
  }

  void logout(String cookieHeader) {
    final t = tokenIn(cookieHeader);
    if (t == null) return;
    _sessions.remove(t);
    _save();
  }

  /// A new PIN: every phone signs in again. Returns nothing; the next [pin] makes the new one.
  void reset() {
    _sessions.clear();
    _save();
    try {
      pinFile.deleteSync();
    } on FileSystemException {
      // there was none
    }
  }

  /// How many phones are signed in now.
  int get sessionCount => _sessions.values.where((e) => e > _now).length;

  /// Compares in constant time (like secrets.compare_digest).
  static bool _same(List<int> a, List<int> b) {
    var diff = a.length ^ b.length;
    for (var i = 0; i < a.length; i++) {
      diff |= a[i] ^ (i < b.length ? b[i] : 0);
    }
    return diff == 0;
  }
}

String setCookie(String token) => '$cookieName=$token; Path=/; Max-Age=${sessionDays * 86400}; HttpOnly; SameSite=Strict';
const clearCookie = '$cookieName=; Path=/; Max-Age=0';
