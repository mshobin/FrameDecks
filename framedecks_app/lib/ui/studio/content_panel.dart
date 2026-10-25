import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../program_view.dart';
import '../providers.dart';
import '../theme.dart';

/// CONTENT of the selected Frame, under its Decks (FrameDecks: Frame → Deck → Content): each Deck's header (name,
/// how much Content, LIVE, Go Live, ⋯), then its L1, L2… with the kind's icon, what it shows, LIVE, the lock and the eye.
class ContentPanel extends ConsumerWidget {
  const ContentPanel({super.key, required this.state, required this.scene});

  final Json state;
  final Json? scene;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = scene;
    final sel = ref.watch(selectionProvider);
    final deck = selectedDeck(state, s, sel);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 8),
          child: Row(
            children: [
              const Eyebrow('Content'),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  s?['name'] as String? ?? '',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
              if (s != null) ...[_AddDeck(scene: s, after: deck), const SizedBox(width: 6), _AddContent(scene: s, deck: deck)],
            ],
          ),
        ),
        Expanded(
          child: s == null
              ? const Padding(
                  padding: EdgeInsets.all(18),
                  child: Text('Select a Frame.', style: TextStyle(color: K.muted, fontSize: 13)),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                  children: [
                    for (final d in sc.decksOf(s)) ...[
                      _DeckHeader(state: state, scene: s, deck: d, selected: d['id'] == deck),
                      for (final (i, l) in sc.deckLayers(s, d['id']).indexed)
                        _LayerRow(state: state, scene: s, layer: l, number: i + 1, selected: l['id'] == sel.layer),
                      if (sc.deckLayers(s, d['id']).isEmpty)
                        const Padding(
                          padding: EdgeInsets.fromLTRB(12, 2, 12, 10),
                          child: Text('This Deck is empty. Click + Content.', style: TextStyle(color: K.muted, fontSize: 12.5)),
                        ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _LayerRow extends ConsumerWidget {
  const _LayerRow({required this.state, required this.scene, required this.layer, required this.number, required this.selected});

  final Json state, scene, layer;
  final int number;
  final bool selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sid = scene['id'] as String, lid = layer['id'] as String;
    final isLiveFrame = sc.isLive(state, sid);
    final on = isLiveFrame ? sc.layerOn(state, scene, layer) : layer['visible'] == true;
    final locked = layer['locked'] == true;
    final dim = !on;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: selected ? K.raised : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: isLiveFrame && on ? K.live : (selected ? K.accent : Colors.transparent)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () {
            final n = ref.read(selectionProvider.notifier);
            n.layer(selected ? '' : lid);
            n.deck(sc.deckOf(scene, layer)); // new Content goes into the Deck you are working in
          },
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 2, 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: K.field,
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(color: K.line),
                  ),
                  child: Text(
                    'L$number',
                    style: const TextStyle(color: K.muted, fontSize: 10.5, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 10),
                Icon(kindIcon(layer['kind'] as String), size: 18, color: dim ? K.faint : K.accent),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        layer['name'] as String,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: dim ? K.muted : K.ink),
                      ),
                      Text(
                        layerDetail(state, scene, layer),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: K.faint, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (isLiveFrame && on) const LiveBadge(small: true),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: locked ? 'Unlock' : 'Lock (no changes by mistake)',
                  icon: Icon(locked ? Icons.lock : Icons.lock_open, size: 16, color: locked ? K.accent : K.faint),
                  onPressed: () => act(ref, context, (n) {
                    final l = sc.layerOf(sc.findScene(n, sid), lid);
                    if (l != null) l['locked'] = l['locked'] != true;
                  }),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: on ? 'Hide' : 'Show',
                  icon: Icon(on ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18, color: on ? K.liveText : K.faint),
                  onPressed: () => act(ref, context, (n) => sc.toggleVisible(n, sid, lid)),
                ),
                if (sc.decksOf(scene).length > 1)
                  PopupMenuButton<String>(
                    tooltip: 'More',
                    icon: const Icon(Icons.more_horiz, size: 18, color: K.faint),
                    onSelected: (deckId) => act(ref, context, (n) {
                      final s = sc.findScene(n, sid);
                      if (s == null) return;
                      sc.moveToDeck(n, s, [lid], deckId);
                      sc.stamp(s);
                    }, 'Moved to ${sc.deckById(scene, deckId)?['name'] ?? 'the Deck'}'),
                    itemBuilder: (_) => [
                      const PopupMenuItem<String>(
                        enabled: false,
                        height: 28,
                        child: Text(
                          'Move to Deck ▸',
                          style: TextStyle(color: K.muted, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                      for (final d in sc.decksOf(scene))
                        if (d['id'] != sc.deckOf(scene, layer)) PopupMenuItem(value: d['id'] as String, child: Text(d['name'] as String)),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// + Content: the cards, the text Content, and pictures and videos (camera, screen and slides Content are made on
/// the Windows PC).
class _AddContent extends ConsumerWidget {
  const _AddContent({required this.scene, required this.deck});

  final Json scene;

  /// The Deck the new Content goes into.
  final String deck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sid = scene['id'] as String;
    final has = {for (final l in sc.deckLayers(scene, deck)) l['kind']};
    return PopupMenuButton<String>(
      tooltip: 'Add Content to the selected Deck',
      offset: const Offset(0, 36),
      onSelected: (k) => act(ref, context, (n) {
        final s = sc.findScene(n, sid);
        if (s == null) return;
        final l = sc.newLayer(k);
        l['deck'] = sc.deckById(s, deck) != null ? deck : sc.decksOf(s).first['id'];
        if (k == 'brand') {
          (s['layers'] as List).insert(0, l);
        } else {
          (s['layers'] as List).add(l);
        }
        sc.stamp(s);
        WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(selectionProvider.notifier).layer(l['id'] as String));
      }, '${kindInfo[k]!.name} added'),
      itemBuilder: (_) => [
        for (final k in [...cardKinds, ...textKinds, 'image', 'video'])
          PopupMenuItem(
            value: k,
            enabled: !(sc.isCard(k) || k == 'brand') || !has.contains(k),
            child: Row(children: [Icon(kindIcon(k), size: 18), const SizedBox(width: 10), Text(kindInfo[k]!.name)]),
          ),
      ],
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: K.surface,
          border: Border.all(color: K.line),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add, size: 16, color: K.ink),
            SizedBox(width: 4),
            Text('Content', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

/// A Deck's header in CONTENT: its name and how much Content, LIVE when it is on screen, Go Live, and ⋯ (Rename,
/// Move up / down, Delete). Clicking it chooses the Deck new Content goes into.
class _DeckHeader extends ConsumerWidget {
  const _DeckHeader({required this.state, required this.scene, required this.deck, required this.selected});

  final Json state, scene, deck;
  final bool selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sid = scene['id'] as String, did = deck['id'] as String;
    final decks = sc.decksOf(scene);
    final i = sc.deckIndex(scene, did);
    final live = sc.isLive(state, sid) && sc.liveDeckId(state, scene) == did;
    final count = sc.deckLayers(scene, did).length;
    Future<void> edit(void Function(Json n, Json s) fn, [String? done]) => act(ref, context, (n) {
      final s = sc.findScene(n, sid);
      if (s == null) return;
      fn(n, s);
      sc.stamp(s);
    }, done);
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 4),
      child: Material(
        color: selected ? K.surface : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: live ? K.live : (selected ? K.line : Colors.transparent)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => ref.read(selectionProvider.notifier).deck(did),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 2, 0, 2),
            child: Row(
              children: [
                Icon(Icons.layers_outlined, size: 15, color: live ? K.liveText : K.muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: (deck['name'] as String).toUpperCase(),
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, letterSpacing: 1),
                        ),
                        TextSpan(
                          text: '  ·  $count',
                          style: const TextStyle(color: K.faint, fontSize: 11.5, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (live) const LiveBadge(small: true),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Go Live with this Deck',
                  icon: Icon(Icons.play_arrow_rounded, size: 18, color: live ? K.liveText : K.accent),
                  onPressed: () {
                    final tx = ref.read(selectionProvider).tx;
                    act(ref, context, (n) => sc.take(n, sid, tx.isEmpty ? null : tx, did), '${scene['name']} · ${deck['name']} is live');
                  },
                ),
                PopupMenuButton<String>(
                  tooltip: 'Deck',
                  icon: const Icon(Icons.more_horiz, size: 18, color: K.faint),
                  onSelected: (v) async {
                    switch (v) {
                      case 'rename':
                        final name = await _askName(context, deck['name'] as String);
                        if (name != null && context.mounted) await edit((n, s) => sc.renameDeck(s, did, name));
                      case 'up':
                        await edit((n, s) => sc.moveDeck(s, did, -1));
                      case 'down':
                        await edit((n, s) => sc.moveDeck(s, did, 1));
                      case 'delete':
                        final ok = await _confirmDelete(context, deck['name'] as String, count);
                        if (ok && context.mounted) await edit((n, s) => sc.removeDeck(n, s, did), '${deck['name']} deleted');
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'rename', child: Text('Rename')),
                    PopupMenuItem(value: 'up', enabled: i > 0, child: const Text('Move up')),
                    PopupMenuItem(value: 'down', enabled: i < decks.length - 1, child: const Text('Move down')),
                    PopupMenuItem(value: 'delete', enabled: decks.length > 1, child: const Text('Delete Deck')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<String?> _askName(BuildContext context, String current) {
  final ctl = TextEditingController(text: current);
  return showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      backgroundColor: K.raised,
      title: const Text('Rename Deck', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
      content: TextField(controller: ctl, autofocus: true, onSubmitted: (v) => Navigator.pop(c, v)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(c, ctl.text), child: const Text('Rename')),
      ],
    ),
  );
}

Future<bool> _confirmDelete(BuildContext context, String name, int count) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: K.raised,
        title: Text('Delete $name?', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        content: Text(
          count == 0 ? 'The Deck is empty.' : 'Its $count Content ${count == 1 ? 'is' : 'are'} deleted with it.',
          style: const TextStyle(color: K.muted),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: K.red),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    ) ??
    false;

/// + Deck: a new Deck after the selected one, chosen at once so new Content goes into it.
class _AddDeck extends ConsumerWidget {
  const _AddDeck({required this.scene, required this.after});

  final Json scene;
  final String after;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sid = scene['id'] as String;
    return Tooltip(
      message: 'Add a Deck to this Frame',
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {
          String? made;
          act(ref, context, (n) {
            final s = sc.findScene(n, sid);
            if (s == null) return;
            made = sc.addDeck(s, '', after)['id'] as String;
            sc.stamp(s);
          }, 'Deck added').then((ok) {
            if (ok && made != null) ref.read(selectionProvider.notifier).deck(made!);
          });
        },
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: K.surface,
            border: Border.all(color: K.line),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add, size: 16, color: K.ink),
              SizedBox(width: 4),
              Text('Deck', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}
