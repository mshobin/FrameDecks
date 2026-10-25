import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:window_manager/window_manager.dart';

import '../program_view.dart';
import '../providers.dart';
import '../theme.dart';

bool get isDesktop => Platform.isWindows || Platform.isMacOS || Platform.isLinux;

/// Share Window: the program alone, full screen (for the projector, or to share this window in Zoom / Teams).
/// Esc or a double-click goes back to the Studio.
class ShareWindow extends ConsumerStatefulWidget {
  const ShareWindow({super.key});

  static Future<void> open(BuildContext context) => Navigator.of(context).push(
    PageRouteBuilder<void>(
      pageBuilder: (_, _, _) => const ShareWindow(),
      transitionDuration: const Duration(milliseconds: 200),
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
    ),
  );

  @override
  ConsumerState<ShareWindow> createState() => _ShareWindowState();
}

class _ShareWindowState extends ConsumerState<ShareWindow> {
  var _hint = true;
  Timer? _hide;

  @override
  void initState() {
    super.initState();
    if (isDesktop) unawaited(windowManager.setFullScreen(true));
    _poke();
  }

  void _poke() {
    _hide?.cancel();
    if (!_hint) setState(() => _hint = true);
    _hide = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _hint = false);
    });
  }

  Future<void> _close() async {
    if (isDesktop) await windowManager.setFullScreen(false);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _hide?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(stateProvider).value;
    return Focus(
      autofocus: true,
      onKeyEvent: (_, e) {
        if (e is KeyDownEvent && e.logicalKey == LogicalKeyboardKey.escape) {
          _close();
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: MouseRegion(
        cursor: _hint ? SystemMouseCursors.basic : SystemMouseCursors.none,
        onHover: (_) => _poke(),
        child: GestureDetector(
          onDoubleTap: _close,
          child: ColoredBox(
            color: Colors.black,
            child: Stack(
              children: [
                if (st != null)
                  Center(
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: ProgramView(state: st, background: ProgramBackground.dark, dataDir: ref.watch(dataDirProvider)),
                    ),
                  ),
                Positioned(
                  top: 16,
                  right: 16,
                  child: AnimatedOpacity(
                    opacity: _hint ? 1 : 0,
                    duration: const Duration(milliseconds: 300),
                    child: Material(
                      color: K.raised.withValues(alpha: .9),
                      borderRadius: BorderRadius.circular(8),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: _close,
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Back to the Studio', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              SizedBox(width: 10),
                              Kbd('ESC'),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
