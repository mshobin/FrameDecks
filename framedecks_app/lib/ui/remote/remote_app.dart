import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../engine/backend.dart';
import '../providers.dart';
import '../theme.dart';
import 'remote_home.dart';

/// "192.168.1.20", "192.168.1.20:8750" or "http://192.168.1.20:8750/remote.html" → http://192.168.1.20:8750/
Uri? pcAddress(String text) {
  var t = text.trim();
  if (t.isEmpty) return null;
  if (!t.contains('://')) t = 'http://$t';
  final u = Uri.tryParse(t);
  if (u == null || u.host.isEmpty) return null;
  return Uri(scheme: u.scheme == 'https' ? 'https' : 'http', host: u.host, port: u.hasPort ? u.port : 8750, path: '/');
}

/// Phones and tablets: a remote control for FrameDecks on the PC. Sign in with the PC's address and its PIN;
/// the sign-in is remembered (in the phone's secure storage) until the PIN changes.
class RemoteApp extends StatefulWidget {
  const RemoteApp({super.key, this.storage = const FlutterSecureStorage()});

  final FlutterSecureStorage storage;

  @override
  State<RemoteApp> createState() => _RemoteAppState();
}

class _RemoteAppState extends State<RemoteApp> {
  ProviderContainer? _container;
  EngineBackend? _backend;
  StreamSubscription<Link>? _links;
  String _address = '';
  String? _message;
  var _starting = true;

  @override
  void initState() {
    super.initState();
    unawaited(_resume());
  }

  Future<void> _resume() async {
    String? addr, cookie;
    try {
      addr = await widget.storage.read(key: 'pc');
      cookie = await widget.storage.read(key: 'cookie');
    } catch (_) {}
    _address = addr ?? '';
    final base = pcAddress(_address);
    if (base != null && cookie != null) await _open(EngineBackend(base, cookie: cookie, isRemote: true));
    if (mounted) setState(() => _starting = false);
  }

  Future<String?> _connect(String address, String pin) async {
    final base = pcAddress(address);
    if (base == null) return 'Enter the PC’s address, like 192.168.1.20.';
    final b = EngineBackend(base, isRemote: true);
    final err = await b.signIn(pin);
    if (err != null) {
      await b.dispose();
      return err;
    }
    try {
      await widget.storage.write(key: 'pc', value: address.trim());
      await widget.storage.write(key: 'cookie', value: b.cookie);
    } catch (_) {}
    _address = address.trim();
    await _open(b);
    return null;
  }

  Future<void> _open(EngineBackend b) async {
    await b.start();
    _backend = b;
    _links = b.linkChanges.listen((l) {
      if (l == Link.needsPin) unawaited(_disconnect('Please enter the PIN again.'));
    });
    setState(() {
      _message = null;
      _container = ProviderContainer(overrides: [backendProvider.overrideWithValue(b)]);
    });
  }

  Future<void> _disconnect([String? why]) async {
    final c = _container, b = _backend;
    await _links?.cancel();
    _links = null;
    setState(() {
      _container = null;
      _backend = null;
      _message = why ?? 'Disconnected. Enter the PIN to connect again.';
    });
    try {
      await widget.storage.delete(key: 'cookie');
    } catch (_) {}
    c?.dispose();
    await b?.dispose();
  }

  @override
  void dispose() {
    _links?.cancel();
    _container?.dispose();
    _backend?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Each state has its own MaterialApp under its provider scope, so pages opened from it (Teleprompter) see the PC.
    MaterialApp app(Widget home) => MaterialApp(title: 'FrameDecks', debugShowCheckedModeBanner: false, theme: kcTheme(), home: home);
    final c = _container;
    if (c != null) {
      return UncontrolledProviderScope(
        container: c,
        child: app(RemoteHome(key: ObjectKey(c), onDisconnect: _disconnect)),
      );
    }
    if (_starting) {
      return app(
        const Scaffold(
          body: Center(child: CircularProgressIndicator(color: K.accent)),
        ),
      );
    }
    return app(ConnectScreen(key: ValueKey(_message), address: _address, message: _message, onConnect: _connect));
  }
}

/// The sign-in card (remote.html #login): the logo, the PC's address, the 6-digit PIN, Connect.
class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key, required this.address, required this.onConnect, this.message});

  final String address;
  final String? message;
  final Future<String?> Function(String address, String pin) onConnect;

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  late final _addr = TextEditingController(text: widget.address);
  final _pin = TextEditingController();
  String? _msg;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _msg = widget.message;
  }

  Future<void> _go() async {
    final pin = _pin.text.replaceAll(RegExp(r'\D'), '');
    if (pin.length != 6) return setState(() => _msg = 'The PIN has 6 digits.');
    setState(() {
      _busy = true;
      _msg = null;
    });
    final err = await widget.onConnect(_addr.text, pin);
    if (!mounted) return;
    _pin.clear();
    setState(() {
      _busy = false;
      _msg = err;
    });
  }

  @override
  void dispose() {
    _addr.dispose();
    _pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: K.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: K.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset('assets/brand/kc-mark.png', height: 64),
                  const SizedBox(height: 14),
                  const Text(
                    'FrameDecks',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Enter the PC’s address and the 6-digit PIN shown on your PC (Settings → Phone & iPad Remote).',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: K.muted, fontSize: 14, height: 1.4),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _addr,
                    keyboardType: TextInputType.url,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'PC address', hintText: '192.168.1.20'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _pin,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 6,
                    obscureText: true,
                    style: const TextStyle(fontSize: 24, letterSpacing: 10, fontWeight: FontWeight.w700),
                    decoration: const InputDecoration(hintText: 'PIN', counterText: ''),
                    onSubmitted: (_) => _go(),
                  ),
                  if (_msg != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _msg!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: K.redText, fontSize: 13.5),
                    ),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: K.accent,
                        foregroundColor: K.accentInk,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _busy ? null : _go,
                      child: _busy
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: K.accentInk))
                          : const Text('Connect', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
