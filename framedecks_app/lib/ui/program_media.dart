import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../engine/media.dart';
import '../engine/model.dart';
import '../engine/scenes.dart' as sc;

/// A video on the program. [playerVideo] plays it with package:video_player; tests give the program a stand-in.
abstract class ProgramVideo extends ChangeNotifier {
  /// Opens the file and starts playing (from the start, once or looping).
  Future<void> start({required bool loop, required double volume});

  Future<void> setLooping(bool loop);

  Future<void> setVolume(double volume);

  /// True once the first picture can be drawn.
  bool get ready;

  /// Width / height of the video's picture.
  double get aspectRatio;

  /// The picture.
  Widget view();
}

typedef ProgramVideoFactory = ProgramVideo? Function(File file);

/// package:video_player plays on macOS, iOS and Android (and the web). Elsewhere (Linux, Windows) a video Content
/// shows nothing here; on Windows the FrameDecks program draws it.
bool get videoSupported => kIsWeb || Platform.isMacOS || Platform.isIOS || Platform.isAndroid;

/// The default [ProgramVideoFactory]: null where video_player has no player.
ProgramVideo? playerVideo(File file) => videoSupported ? _PlayerVideo(file) : null;

class _PlayerVideo extends ProgramVideo {
  _PlayerVideo(File file) : _c = VideoPlayerController.file(file, videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true)) {
    _c.addListener(notifyListeners);
  }

  final VideoPlayerController _c;
  var _gone = false;

  @override
  Future<void> start({required bool loop, required double volume}) async {
    try {
      await _c.initialize();
      if (_gone) return;
      await _c.setLooping(loop);
      await _c.setVolume(volume);
      await _c.play();
    } catch (e) {
      logMediaOnce('play:${_c.dataSource}', 'FrameDecks: the video could not be played (${_c.dataSource}): $e');
    }
  }

  @override
  Future<void> setLooping(bool loop) => _c.value.isInitialized ? _c.setLooping(loop) : Future.value();

  @override
  Future<void> setVolume(double volume) => _c.value.isInitialized ? _c.setVolume(volume) : Future.value();

  @override
  bool get ready => _c.value.isInitialized && _c.value.size.width > 0;

  @override
  double get aspectRatio => _c.value.aspectRatio;

  @override
  Widget view() => VideoPlayer(_c);

  @override
  void dispose() {
    _gone = true;
    _c.removeListener(notifyListeners);
    _c.dispose();
    super.dispose();
  }
}

final _logged = <String>{};

/// Says a media problem once per file (the program redraws often; one line is enough), like the Windows camera keeps
/// one error per Content.
void logMediaOnce(String key, String message) {
  if (_logged.add(key)) debugPrint(message);
}

/// One image or video Content on the program, placed the way the Windows camera draws it (vcam/layers.py
/// `_transform`): its box is w of the picture's width wide and h of its height high (h = 0: the picture's own
/// shape), centred at (x, y); its corners rounded by radius x the picture's height; rotated about its centre; faded
/// by its opacity. A video keeps one player for as long as this Content is on the program (a new state with the same
/// file never restarts it), like LayerManager.set_layers keeps a source while its file is unchanged.
class ProgramMediaLayer extends StatefulWidget {
  const ProgramMediaLayer({
    super.key,
    required this.layer,
    required this.dataDir,
    required this.width,
    required this.height,
    required this.videoFactory,
    this.volume = 0,
  });

  final Json layer;
  final String dataDir;

  /// The picture's size.
  final double width, height;
  final ProgramVideoFactory videoFactory;
  final double volume;

  @override
  State<ProgramMediaLayer> createState() => _ProgramMediaLayerState();
}

class _ProgramMediaLayerState extends State<ProgramMediaLayer> {
  File? _file;
  String _kind = '';
  var _exists = false;
  ProgramVideo? _video;

  @override
  void initState() {
    super.initState();
    _open();
  }

  String get _name => (sc.cOf(widget.layer)['file'] ?? '').toString();

  void _open() {
    _kind = widget.layer['kind'] as String;
    _file = mediaFile(widget.dataDir, _name);
    _exists = _file?.existsSync() ?? false;
    if (!_exists) {
      logMediaOnce('missing:${_file?.path ?? _name}', 'FrameDecks: the file is missing: $_name');
      return;
    }
    if (_kind != 'video') return;
    final v = widget.videoFactory(_file!);
    if (v == null) {
      logMediaOnce('player', 'FrameDecks: videos play on a Mac; this computer shows the video Content as nothing.');
      return;
    }
    _video = v..addListener(_changed);
    v.start(loop: mediaBox(widget.layer).loop, volume: widget.volume);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  void _close() {
    _video?.removeListener(_changed);
    _video?.dispose();
    _video = null;
  }

  @override
  void didUpdateWidget(ProgramMediaLayer old) {
    super.didUpdateWidget(old);
    final file = mediaFile(widget.dataDir, _name);
    if (widget.layer['kind'] != _kind || file?.path != _file?.path || (!_exists && (file?.existsSync() ?? false))) {
      _close(); // another file (or the missing one has arrived): a new player
      _open();
      return;
    }
    final loop = mediaBox(widget.layer).loop;
    if (loop != mediaBox(old.layer).loop) _video?.setLooping(loop);
    if (widget.volume != old.volume) _video?.setVolume(widget.volume);
  }

  @override
  void dispose() {
    _close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_exists) return const SizedBox.shrink();
    final W = widget.width, H = widget.height;
    final b = mediaBox(widget.layer);
    final bw = max(2.0, b.w * W);
    double? bh = b.h > 0 ? max(2.0, b.h * H) : null;
    final Widget picture;
    if (_kind == 'video') {
      final v = _video;
      if (v == null || !v.ready) return const SizedBox.shrink();
      bh ??= max(2.0, bw / v.aspectRatio);
      picture = b.h > 0 ? _fit(v.view(), v.aspectRatio, b.fit) : v.view();
    } else {
      picture = Image.file(
        _file!,
        width: bw,
        height: bh,
        fit: b.h > 0 ? (b.fit == 'cover' ? BoxFit.cover : BoxFit.contain) : BoxFit.fill,
        gaplessPlayback: true,
        errorBuilder: (_, e, _) {
          logMediaOnce('read:${_file!.path}', 'FrameDecks: the picture could not be read: $_name');
          return const SizedBox.shrink();
        },
      );
    }
    Widget box = SizedBox(width: bw, height: bh, child: picture);
    if (b.radius > 0) box = ClipRRect(borderRadius: BorderRadius.circular(b.radius * H), child: box);
    if (b.rotation.abs() > .01) box = Transform.rotate(angle: b.rotation * pi / 180, child: box);
    box = Opacity(opacity: mediaOpacity(widget.layer), child: box);
    final shown = Offstage(offstage: !mediaShown(widget.layer), child: IgnorePointer(child: box));
    if (bh != null) return Positioned(left: b.x * W - bw / 2, top: b.y * H - bh / 2, width: bw, height: bh, child: shown);
    // an image's height comes from the picture once it is read: centre it on y whatever its height
    return Positioned(
      left: b.x * W - bw / 2,
      top: b.y * H,
      width: bw,
      child: FractionalTranslation(translation: const Offset(0, -.5), child: shown),
    );
  }

  /// A video in a box of its own shape: contained (letterboxed, the rest see-through) or covering (cropped).
  Widget _fit(Widget view, double aspect, String fit) => ClipRect(
    child: FittedBox(
      fit: fit == 'cover' ? BoxFit.cover : BoxFit.contain,
      child: SizedBox(width: 1000 * aspect, height: 1000, child: view),
    ),
  );
}
