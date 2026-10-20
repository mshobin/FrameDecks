import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/engine/open_url.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// The bridge to the presentation engine: the Windows Kingdom Connect program (Frames, Go Live, the KingdomConnect
/// camera, overlays, Teleprompter and the phone remote). Nothing is duplicated here: the engine keeps doing all of it.
class PresenterScreen extends ConsumerWidget {
  const PresenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(engineStatusProvider);
    final desktop = !kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.windows ||
            defaultTargetPlatform == TargetPlatform.macOS ||
            defaultTargetPlatform == TargetPlatform.linux);
    return Scaffold(
      body: PageBody(maxWidth: 900, children: [
        PageHeader(
          title: 'Presenter Studio',
          subtitle: 'Frames, Go Live, the virtual camera, overlays and the Teleprompter.',
          actions: [
            if (desktop)
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(engineStatusProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Check again'),
              ),
          ],
        ),
        const SizedBox(height: KC.s5),
        if (!desktop)
          const SectionCard(
            child: EmptyState(
              icon: Icons.desktop_windows_outlined,
              title: 'Presenting runs on the meeting PC',
              message: 'Go Live, the KingdomConnect camera and the overlays run in Kingdom Connect for Windows. '
                  'On this device, use the phone remote it shows in its Settings.',
            ),
          )
        else
          status.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(KC.s6), child: CircularProgressIndicator())),
            error: (e, _) => SectionCard(child: Text('Could not check the presentation engine: $e')),
            data: (s) => s.running
                ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    SectionCard(
                      title: 'Connected',
                      trailing: StatusPill('Version ${s.version}', color: KC.success),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (s.meetingTitle.isNotEmpty) Text(s.meetingTitle, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: KC.s2),
                        Text(s.liveFrame.isEmpty ? 'Nothing is live right now.' : 'On screen: ${s.liveFrame}'),
                        const SizedBox(height: KC.s4),
                        FilledButton.icon(
                          onPressed: () async {
                            if (!await openInBrowser(s.studioUrl!) && context.mounted) {
                              showFailure(context, 'Open ${s.studioUrl} in your browser.');
                            }
                          },
                          icon: const Icon(Icons.open_in_new),
                          label: const Text('Open the Studio'),
                        ),
                      ]),
                    ),
                    const SizedBox(height: KC.s4),
                    SectionCard(
                      title: 'Frames in this meeting',
                      child: s.frames.isEmpty
                          ? const Text('No Frames yet. Build them in the Studio.')
                          : Column(children: [
                              for (var i = 0; i < s.frames.length; i++)
                                ListTile(
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  leading: CircleAvatar(radius: 14, child: Text('${i + 1}', style: const TextStyle(fontSize: 12))),
                                  title: Text(s.frames[i]),
                                  trailing: s.frames[i] == s.liveFrame ? const StatusPill('Live', color: KC.danger) : null,
                                ),
                            ]),
                    ),
                  ])
                : const SectionCard(
                    child: EmptyState(
                      icon: Icons.cast_outlined,
                      title: 'Kingdom Connect for Windows is not running',
                      message: 'Start Kingdom Connect (the presentation program) on this PC, then select Check again. '
                          'It keeps running your Frames, camera and overlays exactly as before.',
                    ),
                  ),
          ),
      ]),
    );
  }
}
