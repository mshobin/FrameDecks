import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:window_manager/window_manager.dart';

import 'engine/backend.dart';
import 'engine/cloud_client.dart';
import 'ui/providers.dart';
import 'ui/remote/remote_app.dart';
import 'ui/settings_screen.dart' show appVersion;
import 'ui/studio/share_window.dart' show isDesktop;
import 'ui/studio/studio_screen.dart';
import 'ui/theme.dart';

/// FrameDecks.
///
/// - Windows, macOS, Linux: the Studio, the same as the Windows app. When FrameDecks (the Windows program) is
///   running on this PC, this window works on its Frames; otherwise the Frames are kept in this computer's own
///   kc-saved-content.json.
/// - iPhone, iPad, Android: the remote control for FrameDecks on the PC.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!isDesktop) return runApp(const RemoteApp());

  await windowManager.ensureInitialized();
  await windowManager.waitUntilReadyToShow(
    const WindowOptions(title: 'FrameDecks', minimumSize: Size(1100, 700), size: Size(1440, 900), center: true),
    () async {
      await windowManager.show();
      await windowManager.focus();
    },
  );
  final backend = await chooseBackend();
  await backend.start();
  // The FrameDecks account (optional): sync runs only for this computer's own file, while signed in
  CloudLink? cloud;
  if (backend is LocalBackend) {
    cloud = CloudLink(CloudClient(dir: backend.file.parent, appVersion: appVersion), backend);
    await cloud.start();
  }
  runApp(
    ProviderScope(
      overrides: [backendProvider.overrideWithValue(backend), cloudProvider.overrideWithValue(cloud)],
      child: const StudioApp(),
    ),
  );
}

/// The program on this PC when it is running, else this computer's own file.
Future<StateBackend> chooseBackend() async {
  final engine = Uri.parse('http://127.0.0.1:8750/');
  if (await EngineBackend.isFrameDecks(engine)) return EngineBackend(engine);
  final dir = await getApplicationSupportDirectory();
  return LocalBackend(File('${dir.path}${Platform.pathSeparator}kc-saved-content.json'), label: Platform.isMacOS ? 'This Mac' : 'This computer');
}

class StudioApp extends StatelessWidget {
  const StudioApp({super.key});

  @override
  Widget build(BuildContext context) =>
      MaterialApp(title: 'FrameDecks', debugShowCheckedModeBanner: false, theme: kcTheme(), home: const StudioScreen());
}
