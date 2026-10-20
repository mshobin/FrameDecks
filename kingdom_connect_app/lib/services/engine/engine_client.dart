import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/app_config.dart';

/// What the Windows presentation engine (the existing Kingdom Connect program) reports.
class EngineStatus {
  const EngineStatus({
    required this.running,
    this.port,
    this.version = '',
    this.installedApp = false,
    this.frames = const [],
    this.liveFrame = '',
    this.meetingTitle = '',
  });

  const EngineStatus.notRunning() : this(running: false);

  final bool running;
  final int? port;
  final String version;
  final bool installedApp;
  final List<String> frames;
  final String liveFrame;
  final String meetingTitle;

  /// The Studio page, for "Open Presenter Studio".
  Uri? get studioUrl => port == null ? null : Uri.parse('http://127.0.0.1:$port/');
}

/// The bridge to the presentation engine (Phase 1–2): Frames, Go Live, the virtual camera, overlays and the phone
/// remote stay in the Windows program. This client only reads its local API (127.0.0.1, never the network); the
/// Studio stays the place where the engine is controlled until each control has moved (plan §4, Phase 2).
class EngineClient {
  EngineClient({http.Client? client, this.ports = AppConfig.enginePorts}) : _client = client ?? http.Client();

  final http.Client _client;
  final List<int> ports;

  Future<EngineStatus> status() async {
    for (final port in ports) {
      final ping = await _get(port, 'api/app/ping');
      if (ping == null || ping['app'] != AppConfig.appName) continue;
      final state = await _get(port, 'api/state') ?? const {};
      return EngineStatus(
        running: true,
        port: port,
        version: (ping['version'] ?? '').toString(),
        installedApp: ping['installedApp'] == true,
        frames: framesOf(state),
        liveFrame: liveFrameOf(state),
        meetingTitle: ((state['meeting'] as Map?)?['title'] ?? '').toString(),
      );
    }
    return const EngineStatus.notRunning();
  }

  Future<Map<String, Object?>?> _get(int port, String path) async {
    try {
      final r = await _client
          .get(Uri.parse('http://127.0.0.1:$port/$path'))
          .timeout(const Duration(milliseconds: 1500));
      if (r.statusCode != 200) return null;
      final d = jsonDecode(utf8.decode(r.bodyBytes));
      return d is Map ? d.cast<String, Object?>() : null;
    } catch (_) {
      return null; // not running on this port
    }
  }

  /// The meeting's Frames in order (saved templates left out).
  static List<String> framesOf(Map<String, Object?> state) => [
        for (final s in (state['scenes'] as List<Object?>? ?? const []))
          if (s is Map && s['tpl'] != true) (s['name'] ?? 'Frame').toString(),
      ];

  static String liveFrameOf(Map<String, Object?> state) {
    final live = (state['live'] as Map?)?['scene'];
    if (live == null || live == '') return '';
    for (final s in (state['scenes'] as List<Object?>? ?? const [])) {
      if (s is Map && s['id'] == live) return (s['name'] ?? '').toString();
    }
    return '';
  }

  void close() => _client.close();
}
