import 'package:flutter/material.dart';

import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../program_view.dart';
import '../theme.dart';

/// What a Frame would look like on screen, without putting it there: the state as if it had just gone live.
/// For a Frame with several Decks, [deck] chooses which one.
Json previewState(Json st, Json scene, [String? deck]) {
  if (sc.isLive(st, scene['id'])) return st;
  final p = deepCopy(st);
  sc.take(p, scene['id'], 'cut', deck);
  final l = sc.liveOf(p);
  l['blackout'] = false;
  l['emergency'] = false;
  return p;
}

/// STUDIO CANVAS: the selected Frame's name, LIVE, its transition, Share Window, and the 16:9 picture.
class StudioCanvas extends StatelessWidget {
  const StudioCanvas({super.key, required this.state, required this.scene, required this.onShare, this.deck});

  final Json state;
  final Json? scene;

  /// The Deck to preview when the Frame is not live (null = its first).
  final String? deck;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final s = scene;
    final live = s != null && sc.isLive(state, s['id']);
    final t = s == null ? null : sc.transitionOf(state, s);
    final shown = s == null ? state : previewState(state, s, deck);
    final decks = s == null ? const <Json>[] : sc.decksOf(s);
    final deckName = decks.length < 2 ? '' : (sc.deckById(s, live ? sc.liveDeckId(state, s) : deck) ?? decks.first)['name'] as String;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: K.line)),
          ),
          child: Row(
            children: [
              const Eyebrow('Studio canvas'),
              const SizedBox(width: 12),
              if (s != null)
                Flexible(
                  child: Text(
                    s['name'] as String,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                ),
              if (deckName.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  '· $deckName',
                  style: const TextStyle(color: K.muted, fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
              if (live) ...[const SizedBox(width: 10), const LiveBadge(small: true)],
              if (t != null) ...[
                const SizedBox(width: 12),
                Text(t.type == 'cut' ? 'Cut' : '${sc.txName(t.type)} ${t.ms} ms', style: const TextStyle(color: K.muted, fontSize: 12.5)),
              ],
              const Spacer(),
              KButton(
                onPressed: onShare,
                tooltip: 'Show the program full screen (put it on the projector or share this window in Zoom / Teams)',
                child: const Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.cast), SizedBox(width: 8), Text('Share Window')]),
              ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
            child: Center(
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: live ? K.live : K.line, width: live ? 2 : 1),
                    boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 18, offset: Offset(0, 6))],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ProgramView(state: shown),
                      Positioned(
                        left: 10,
                        top: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: .55),
                            border: Border.all(color: live ? K.liveText : K.muted),
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Text(
                            live ? 'LIVE · what the screen shows' : 'PREVIEW · not on screen',
                            style: TextStyle(color: live ? K.liveText : K.muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: .6),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
