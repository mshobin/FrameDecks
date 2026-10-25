import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../providers.dart';
import '../theme.dart';
import 'top_bar.dart';

enum _Filter { all, favorites, recent, library }

/// FRAMES: search, All · Favorites · Recent · Library, and the numbered Frame cards (LIVE / NEXT, groups, ★, ⋯).
class FramesPanel extends ConsumerStatefulWidget {
  const FramesPanel({super.key, required this.state});

  final Json state;

  @override
  ConsumerState<FramesPanel> createState() => _FramesPanelState();
}

class _FramesPanelState extends ConsumerState<FramesPanel> {
  var _filter = _Filter.all;
  var _query = '';
  final _closed = <String>{};

  bool _matches(Json s) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return true;
    final words = <Object?>[s['name'], s['group'], s['notes']];
    for (final l in sc.layersOf(s)) {
      final c = sc.cOf(l);
      words.addAll([l['name'], c['title'], c['text']]);
      for (final it in (c['items'] as List? ?? const []).cast<Json>()) {
        words.addAll([it['label'], it['text'], it['ref']]);
      }
    }
    return words.join(' ').toLowerCase().contains(q);
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.state;
    final sel = ref.watch(selectionProvider);
    final order = sc.order(st);
    final all = sc.scenesOf(st);
    var list = switch (_filter) {
      _Filter.all => order,
      _Filter.favorites => order.where((s) => s['fav'] == true).toList(),
      _Filter.recent => ([...order]..sort((a, b) => ((b['modified'] as num?) ?? 0).compareTo((a['modified'] as num?) ?? 0))).take(12).toList(),
      _Filter.library => all.where((s) => s['tpl'] == true).toList(),
    };
    list = list.where(_matches).toList();
    final liveId = sc.liveOf(st)['scene'];
    final next = liveId == '' ? null : sc.neighbour(st, liveId, 1);
    final grouped = _filter == _Filter.all && _query.trim().isEmpty;

    final rows = <Widget>[];
    String? lastGroup;
    for (final s in list) {
      final g = (s['group'] ?? '').toString();
      if (grouped && g.isNotEmpty && g != lastGroup) {
        final count = list.where((x) => x['group'] == g).length;
        rows.add(
          _GroupHeader(
            name: g,
            count: count,
            open: !_closed.contains(g),
            onTap: () => setState(() => _closed.contains(g) ? _closed.remove(g) : _closed.add(g)),
          ),
        );
      }
      lastGroup = g;
      if (grouped && g.isNotEmpty && _closed.contains(g)) continue;
      rows.add(
        _FrameCard(
          state: st,
          scene: s,
          number: order.indexOf(s) + 1,
          selected: s['id'] == sel.scene,
          live: s['id'] == liveId,
          next: next != null && next['id'] == s['id'],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 8),
          child: Row(
            children: [
              const Eyebrow('Frames'),
              const Spacer(),
              _NewFrameButton(state: st),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Search Frames', prefixIcon: Icon(Icons.search, size: 18)),
            style: const TextStyle(fontSize: 13.5),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: K.field,
              border: Border.all(color: K.line),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Row(
              children: [
                for (final f in _Filter.values)
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(7),
                      onTap: () => setState(() => _filter = f),
                      child: Container(
                        height: 30,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: _filter == f ? K.neutralBtn : null, borderRadius: BorderRadius.circular(7)),
                        child: Text(switch (f) {
                          _Filter.all => 'All',
                          _Filter.favorites => 'Favorites',
                          _Filter.recent => 'Recent',
                          _Filter.library => 'Library',
                        }, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: _filter == f ? K.ink : K.muted)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Expanded(
          child: rows.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(18),
                  child: Text(
                    _query.trim().isNotEmpty
                        ? 'No Frame matches “${_query.trim()}”.'
                        : switch (_filter) {
                            _Filter.favorites => 'No favourite Frames yet. Click ☆ on a Frame.',
                            _Filter.library => 'No templates yet. Use ⋯ → Save as template.',
                            _ => 'No Frames yet. Click + to make one.',
                          },
                    style: const TextStyle(color: K.muted, fontSize: 13),
                  ),
                )
              : ListView(padding: const EdgeInsets.fromLTRB(8, 2, 8, 12), children: rows),
        ),
      ],
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.name, required this.count, required this.open, required this.onTap});

  final String name;
  final int count;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(6, 12, 8, 6),
      child: Row(
        children: [
          Icon(open ? Icons.arrow_drop_down : Icons.arrow_right, size: 18, color: K.muted),
          Expanded(child: Eyebrow(name)),
          Text(
            '$count',
            style: const TextStyle(color: K.faint, fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    ),
  );
}

class _FrameCard extends ConsumerWidget {
  const _FrameCard({required this.state, required this.scene, required this.number, required this.selected, required this.live, required this.next});

  final Json state, scene;
  final int number;
  final bool selected, live, next;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = scene['id'] as String;
    final qs = live ? sc.qsMode(scene, state) : '';
    final decks = sc.decksOf(scene).length;
    final border = live ? K.live : (selected ? K.accent : Colors.transparent);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: live ? const Color(0xFF12301F) : (selected ? K.raised : Colors.transparent),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: border, width: live ? 1.5 : 1),
        ),
        // selects on the press itself (the tap of an InkWell that also takes double-clicks waits to see which it is)
        child: Listener(
          onPointerDown: (_) => ref.read(selectionProvider.notifier).scene(id),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () {},
            onDoubleTap: () => goLive(ref, context, state, id),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 4, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      SizedBox(
                        width: 22,
                        child: Text(
                          scene['tpl'] == true ? '·' : '$number',
                          style: const TextStyle(color: K.faint, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              scene['name'] as String,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${sc.sceneSummary(state, scene)}${decks > 1 ? ' · $decks Decks' : ''}',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: K.muted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      if (live) const LiveBadge(small: true),
                      if (next && !live) const _NextBadge(),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        tooltip: scene['fav'] == true ? 'Remove from Favorites' : 'Add to Favorites',
                        icon: Icon(scene['fav'] == true ? Icons.star : Icons.star_border, size: 18, color: scene['fav'] == true ? K.accent : K.faint),
                        onPressed: () => act(ref, context, (n) {
                          final s = sc.findScene(n, id);
                          if (s != null) s['fav'] = s['fav'] != true;
                        }),
                      ),
                      _FrameMenu(state: state, scene: scene),
                    ],
                  ),
                  if (qs.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.only(left: 22),
                      child: _QSChips(sceneId: id, mode: qs),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NextBadge extends StatelessWidget {
  const _NextBadge();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      border: Border.all(color: K.muted),
      borderRadius: BorderRadius.circular(5),
    ),
    child: const Text(
      'NEXT',
      style: TextStyle(color: K.ink, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1),
    ),
  );
}

/// Question · Scripture · Q + S on the live Frame.
class _QSChips extends ConsumerWidget {
  const _QSChips({required this.sceneId, required this.mode});

  final String sceneId, mode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget chip(String m, String text) => InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => act(ref, context, (n) => sc.setQS(n, sceneId, m)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: mode == m ? K.accent : null, borderRadius: BorderRadius.circular(14)),
        child: Text(
          text,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: mode == m ? K.accentInk : K.ink),
        ),
      ),
    );
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: K.field, borderRadius: BorderRadius.circular(16)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [chip('question', 'Question'), chip('verse', 'Scripture'), chip('both', 'Q + S')]),
    );
  }
}

class _FrameMenu extends ConsumerWidget {
  const _FrameMenu({required this.state, required this.scene});

  final Json state, scene;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = scene['id'] as String;
    final tpl = scene['tpl'] == true;
    return PopupMenuButton<String>(
      tooltip: 'More',
      icon: const Icon(Icons.more_horiz, size: 18, color: K.faint),
      onSelected: (v) async {
        switch (v) {
          case 'live':
            await goLive(ref, context, state, id);
          case 'dup':
            await act(ref, context, (n) {
              final c = duplicateScene(n, sc.findScene(n, id)!);
              WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(selectionProvider.notifier).scene(c['id'] as String));
            }, 'Frame duplicated');
          case 'tpl':
            await act(
              ref,
              context,
              (n) => duplicateScene(n, sc.findScene(n, id)!, template: true, name: sc.uniqueName(n, '${scene['name']} template')),
              'Saved as a template (Library)',
            );
          case 'use':
            await act(ref, context, (n) {
              final c = duplicateScene(
                n,
                sc.findScene(n, id)!,
                name: sc.uniqueName(n, (scene['name'] as String).replaceFirst(RegExp(r' template$'), '')),
              );
              c['tpl'] = false;
              c['template'] = scene['name'];
            }, 'New Frame from the template');
          case 'up' || 'down':
            await act(ref, context, (n) {
              final l = n['scenes'] as List;
              final i = l.indexWhere((s) => (s as Json)['id'] == id);
              final j = i + (v == 'up' ? -1 : 1);
              if (i < 0 || j < 0 || j >= l.length) return;
              final s = l.removeAt(i);
              l.insert(j, s);
            });
          case 'delete':
            if (!context.mounted) return;
            final ok = await confirm(context, 'Delete “${scene['name']}”?', 'The Frame and its Content are removed.');
            if (ok && context.mounted) {
              await act(ref, context, (n) {
                (n['scenes'] as List).removeWhere((s) => (s as Json)['id'] == id);
                if (sc.liveOf(n)['scene'] == id) {
                  sc.hideAll(n);
                  sc.liveOf(n)['scene'] = '';
                }
              }, 'Frame deleted');
            }
        }
      },
      itemBuilder: (_) => [
        if (!tpl) const PopupMenuItem(value: 'live', child: Text('Go Live')),
        if (tpl) const PopupMenuItem(value: 'use', child: Text('New Frame from this template')),
        const PopupMenuItem(value: 'dup', child: Text('Duplicate')),
        if (!tpl) const PopupMenuItem(value: 'tpl', child: Text('Save as template')),
        const PopupMenuDivider(),
        const PopupMenuItem(value: 'up', child: Text('Move up')),
        const PopupMenuItem(value: 'down', child: Text('Move down')),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'delete',
          child: Text('Delete', style: TextStyle(color: K.redText)),
        ),
      ],
    );
  }
}

class _NewFrameButton extends ConsumerWidget {
  const _NewFrameButton({required this.state});

  final Json state;

  @override
  Widget build(BuildContext context, WidgetRef ref) => PopupMenuButton<String>(
    tooltip: 'New Frame',
    offset: const Offset(0, 40),
    onSelected: (t) => act(ref, context, (n) {
      final s = sc.createScene(n, t, after: ref.read(selectionProvider).scene);
      WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(selectionProvider.notifier).scene(s['id'] as String));
    }, 'Frame added'),
    itemBuilder: (_) => [
      const PopupMenuItem(enabled: false, height: 28, child: Eyebrow('New Frame')),
      for (final t in templates)
        if (t.id != 'zoom' && t.id != 'teams' && t.id != 'slides') PopupMenuItem(value: t.id, child: Text(t.name)),
    ],
    child: Container(
      width: 34,
      height: 32,
      decoration: BoxDecoration(color: K.accent, borderRadius: BorderRadius.circular(8)),
      child: const Icon(Icons.add, color: K.accentInk, size: 20),
    ),
  );
}

Future<bool> confirm(BuildContext context, String title, String body, {String ok = 'Delete'}) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: K.raised,
        title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        content: Text(body, style: const TextStyle(color: K.muted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: K.red),
            onPressed: () => Navigator.pop(c, true),
            child: Text(ok),
          ),
        ],
      ),
    ) ??
    false;
