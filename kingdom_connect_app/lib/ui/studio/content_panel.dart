import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../program_view.dart';
import '../providers.dart';
import '../theme.dart';

/// CONTENT of the selected Frame: L1, L2… with the kind's icon, what it shows, LIVE, the lock and the eye.
class ContentPanel extends ConsumerWidget {
  const ContentPanel({super.key, required this.state, required this.scene});

  final Json state;
  final Json? scene;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = scene;
    final sel = ref.watch(selectionProvider);
    final layers = s == null ? const <Json>[] : sc.layersOf(s);
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
              if (s != null) _AddContent(scene: s),
            ],
          ),
        ),
        Expanded(
          child: s == null
              ? const Padding(
                  padding: EdgeInsets.all(18),
                  child: Text('Select a Frame.', style: TextStyle(color: K.muted, fontSize: 13)),
                )
              : layers.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(18),
                  child: Text('This Frame is empty. Click + Content.', style: TextStyle(color: K.muted, fontSize: 13)),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                  children: [
                    for (var i = 0; i < layers.length; i++)
                      _LayerRow(state: state, scene: s, layer: layers[i], number: i + 1, selected: layers[i]['id'] == sel.layer),
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
          onTap: () => ref.read(selectionProvider.notifier).layer(selected ? '' : lid),
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// + Content: the cards and the text Content (camera, screen and media Content are made on the Windows PC).
class _AddContent extends ConsumerWidget {
  const _AddContent({required this.scene});

  final Json scene;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sid = scene['id'] as String;
    final has = {for (final l in sc.layersOf(scene)) l['kind']};
    return PopupMenuButton<String>(
      tooltip: 'Add Content to this Frame',
      offset: const Offset(0, 36),
      onSelected: (k) => act(ref, context, (n) {
        final s = sc.findScene(n, sid);
        if (s == null) return;
        final l = sc.newLayer(k);
        if (k == 'brand') {
          (s['layers'] as List).insert(0, l);
        } else {
          (s['layers'] as List).add(l);
        }
        sc.stamp(s);
        WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(selectionProvider.notifier).layer(l['id'] as String));
      }, '${kindInfo[k]!.name} added'),
      itemBuilder: (_) => [
        for (final k in [...cardKinds, ...textKinds])
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
