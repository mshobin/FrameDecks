import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/backend.dart';
import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../camera/mac_camera.dart';
import '../providers.dart';
import '../settings_screen.dart';
import '../theme.dart';
import 'canvas.dart';
import 'content_panel.dart';
import 'frames_panel.dart';
import 'inspector.dart';
import 'share_window.dart';
import 'top_bar.dart';

/// The desktop app: the top bar, then the Studio (Frames · Content | canvas · inspector) or Settings.
class StudioScreen extends ConsumerStatefulWidget {
  const StudioScreen({super.key});

  @override
  ConsumerState<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends ConsumerState<StudioScreen> {
  Timer? _auto;

  @override
  void initState() {
    super.initState();
    // Auto advance is run by whoever owns the file: here when this app keeps the state itself (the Windows
    // program runs it when it is the one serving the state).
    if (ref.read(backendProvider) is LocalBackend) _auto = Timer.periodic(const Duration(seconds: 1), (_) => _autoAdvance());
  }

  void _autoAdvance() {
    final st = ref.read(stateProvider).value;
    if (st == null) return;
    final live = sc.liveOf(st);
    final ls = sc.liveScene(st);
    if (ls == null || live['auto'] != true || (ls['auto'] as Json)['on'] != true) return;
    final due = ((live['at'] as num?) ?? 0) + ((ls['auto'] as Json)['sec'] as num) * 1000;
    if (sc.nowMs() < due) return;
    final nx = sc.neighbour(st, ls['id'], 1);
    if (nx == null) return;
    act(ref, context, (n) {
      if (sc.liveOf(n)['scene'] == ls['id']) sc.take(n, nx['id']);
    });
  }

  @override
  void dispose() {
    _auto?.cancel();
    super.dispose();
  }

  /// T = Go Live, Esc = Hide All (not while typing).
  KeyEventResult _key(FocusNode _, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final typing = FocusManager.instance.primaryFocus?.context?.widget is EditableText;
    final st = ref.read(stateProvider).value;
    if (typing || st == null || ModalRoute.of(context)?.isCurrent != true) return KeyEventResult.ignored;
    if (e.logicalKey == LogicalKeyboardKey.keyT) {
      goLive(ref, context, st);
      return KeyEventResult.handled;
    }
    if (e.logicalKey == LogicalKeyboardKey.escape) {
      hideAll(ref, context);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(stateProvider);
    final st = async.value;
    if (st == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: K.accent)),
      );
    }
    final page = ref.watch(pageProvider);
    final sel = ref.watch(selectionProvider);
    final scene = sc.findScene(st, sel.scene) ?? sc.liveScene(st) ?? (sc.scenesOf(st).isEmpty ? null : sc.scenesOf(st).first);

    final studio = Focus(
      autofocus: true,
      onKeyEvent: _key,
      child: Column(
        children: [
          TopBar(state: st),
          Expanded(
            child: page == AppPage.settings
                ? SettingsScreen(state: st)
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        width: 300,
                        decoration: const BoxDecoration(
                          color: K.panel,
                          border: Border(right: BorderSide(color: K.line)),
                        ),
                        child: Column(
                          children: [
                            Expanded(flex: 3, child: FramesPanel(state: st)),
                            const Divider(),
                            Expanded(
                              flex: 2,
                              child: ContentPanel(state: st, scene: scene),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Expanded(
                              flex: 11,
                              child: StudioCanvas(state: st, scene: scene, onShare: () => ShareWindow.open(context)),
                            ),
                            const Divider(),
                            Expanded(
                              flex: 9,
                              child: scene == null
                                  ? const Center(
                                      child: Text('Make your first Frame with + in FRAMES.', style: TextStyle(color: K.muted)),
                                    )
                                  : Inspector(state: st, scene: scene),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
    return Scaffold(
      // on the Mac the KingdomConnect camera gets the program from here (only while an app is receiving it)
      body: MacCamera.available
          ? Stack(
              children: [
                Positioned.fill(child: studio),
                const CameraFeeder(),
              ],
            )
          : studio,
    );
  }
}
