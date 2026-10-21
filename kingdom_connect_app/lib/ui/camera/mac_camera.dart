import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../program_view.dart';
import '../providers.dart';

/// The FrameCast camera on the Mac (macos/KingdomConnectCamera, macos/Runner/CameraBridge.swift).
class MacCamera {
  MacCamera({MethodChannel? channel}) : _channel = channel ?? const MethodChannel('kingdom_connect/camera');

  final MethodChannel _channel;

  /// The camera's picture size (the camera extension's stream format).
  static const width = 1280, height = 720;

  static bool get available => !kIsWeb && Platform.isMacOS;

  Future<CameraStatus> status() async {
    try {
      final m = await _channel.invokeMapMethod<String, Object?>('status') ?? const {};
      return CameraStatus(
        supported: m['supported'] == true,
        installed: m['installed'] == true,
        watched: m['watched'] == true,
        message: (m['message'] ?? '').toString(),
      );
    } on MissingPluginException {
      return const CameraStatus(supported: false, installed: false, watched: false, message: '');
    } on PlatformException catch (e) {
      return CameraStatus(supported: false, installed: false, watched: false, message: e.message ?? '');
    }
  }

  Future<void> install() => _channel.invokeMethod<void>('install');
  Future<void> uninstall() => _channel.invokeMethod<void>('uninstall');

  /// One picture: width x height, RGBA. True when the camera took it (false while it is busy or not installed).
  Future<bool> send(Uint8List rgba, int width, int height) async {
    try {
      return await _channel.invokeMethod<bool>('send', {'rgba': rgba, 'width': width, 'height': height}) ?? false;
    } on PlatformException {
      return false;
    }
  }
}

@immutable
class CameraStatus {
  const CameraStatus({required this.supported, required this.installed, required this.watched, required this.message});

  final bool supported, installed, watched;
  final String message;
}

/// Draws the program off screen and gives it to the FrameCast camera, only while an app (Zoom, Teams, FaceTime…)
/// is receiving the camera. Put it once in the Studio; it shows nothing.
class CameraFeeder extends ConsumerStatefulWidget {
  const CameraFeeder({super.key, this.camera});

  final MacCamera? camera;

  @override
  ConsumerState<CameraFeeder> createState() => _CameraFeederState();
}

class _CameraFeederState extends ConsumerState<CameraFeeder> {
  late final MacCamera _camera = widget.camera ?? MacCamera();
  final _boundary = GlobalKey();
  Timer? _poll, _frames;
  var _watched = false;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _poll = Timer.periodic(const Duration(seconds: 2), (_) => _check());
    _check();
  }

  Future<void> _check() async {
    final s = await _camera.status();
    if (!mounted || s.watched == _watched) return;
    setState(() => _watched = s.watched);
    _frames?.cancel();
    _frames = s.watched ? Timer.periodic(const Duration(milliseconds: 33), (_) => _sendFrame()) : null;
  }

  Future<void> _sendFrame() async {
    if (_busy) return; // the previous picture is still on its way: skip this one
    final ro = _boundary.currentContext?.findRenderObject();
    if (ro is! RenderRepaintBoundary || ro.debugNeedsPaint) return;
    _busy = true;
    try {
      final logical = ro.size.width;
      final image = await ro.toImage(pixelRatio: MacCamera.width / logical);
      try {
        final bytes = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
        if (bytes != null && image.width == MacCamera.width && image.height == MacCamera.height) {
          await _camera.send(bytes.buffer.asUint8List(), image.width, image.height);
        }
      } finally {
        image.dispose();
      }
    } finally {
      _busy = false;
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _frames?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(stateProvider).value;
    if (!_watched || st == null) return const SizedBox.shrink();
    // far outside the window: drawn, never seen
    return Positioned(
      left: -100000,
      top: 0,
      width: MacCamera.width / 2,
      height: MacCamera.height / 2,
      child: IgnorePointer(
        child: RepaintBoundary(
          key: _boundary,
          child: ProgramView(state: st, background: ProgramBackground.dark),
        ),
      ),
    );
  }
}
