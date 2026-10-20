import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/backend.dart';
import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../program_view.dart';
import '../providers.dart';
import '../theme.dart';

const _liveGreen = Color(0xFF16A34A);

/// The remote (remote.html, Simple layout): Live · Frames · Content on a phone; the three side by side on a tablet.
class RemoteHome extends ConsumerStatefulWidget {
  const RemoteHome({super.key, required this.onDisconnect});

  final VoidCallback onDisconnect;

  @override
  ConsumerState<RemoteHome> createState() => _RemoteHomeState();
}

class _RemoteHomeState extends ConsumerState<RemoteHome> {
  var _tab = 0;

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(stateProvider).value;
    final link = ref.watch(linkProvider).value ?? Link.connecting;
    final wide = MediaQuery.sizeOf(context).width >= 900;
    if (st == null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: K.accent),
              const SizedBox(height: 16),
              Text(
                link == Link.offline ? 'Can’t reach your PC. Check it’s on the same Wi-Fi.' : 'Connecting…',
                style: const TextStyle(color: K.muted),
              ),
            ],
          ),
        ),
      );
    }
    final pages = [LiveTab(state: st), FramesTab(state: st, onTaken: () => setState(() => _tab = 0)), ContentTab(state: st)];
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Bar(link: link, onDisconnect: widget.onDisconnect),
            Expanded(
              child: wide
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(width: 320, child: pages[1]),
                        const VerticalDivider(width: 1),
                        Expanded(child: pages[0]),
                        const VerticalDivider(width: 1),
                        SizedBox(width: 320, child: pages[2]),
                      ],
                    )
                  : IndexedStack(index: _tab, children: pages),
            ),
          ],
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              backgroundColor: K.chromeBg,
              indicatorColor: K.neutralBtn,
              selectedIndex: _tab,
              onDestinationSelected: (i) {
                HapticFeedback.selectionClick();
                setState(() => _tab = i);
              },
              destinations: const [
                NavigationDestination(icon: Icon(Icons.play_circle_outline), label: 'Live'),
                NavigationDestination(icon: Icon(Icons.view_list_outlined), label: 'Frames'),
                NavigationDestination(icon: Icon(Icons.layers_outlined), label: 'Content'),
              ],
            ),
    );
  }
}

class _Bar extends ConsumerWidget {
  const _Bar({required this.link, required this.onDisconnect});

  final Link link;
  final VoidCallback onDisconnect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ok = link == Link.online;
    final tx = ref.watch(selectionProvider).tx;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 12, 8),
      decoration: const BoxDecoration(
        color: K.chromeBg,
        border: Border(bottom: BorderSide(color: K.line)),
      ),
      child: Row(
        children: [
          Image.asset('assets/brand/kc-mark.png', height: 30),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: K.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: K.line),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: ok ? K.liveText : K.redText),
                ),
                const SizedBox(width: 8),
                Text(
                  ok ? 'Connected' : 'Reconnecting…',
                  style: TextStyle(color: ok ? K.liveText : K.redText, fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          PopupMenuButton<String>(
            tooltip: 'More',
            onSelected: (v) {
              if (v == 'disconnect') return onDisconnect();
              if (v.startsWith('tx:')) ref.read(selectionProvider.notifier).tx(v.substring(3));
            },
            itemBuilder: (_) => [
              const PopupMenuItem(enabled: false, height: 28, child: Eyebrow('Transition for Go Live')),
              CheckedPopupMenuItem(value: 'tx:', checked: tx.isEmpty, child: const Text('Frame default')),
              for (final t in transitionsList) CheckedPopupMenuItem(value: 'tx:${t.$1}', checked: tx == t.$1, child: Text(t.$2)),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'disconnect', child: Text('Disconnect')),
            ],
            child: Container(
              width: 44,
              height: 40,
              decoration: BoxDecoration(
                color: K.raised,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: K.line),
              ),
              child: const Icon(Icons.more_horiz, color: K.ink),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: K.red,
            borderRadius: BorderRadius.circular(10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () {
                HapticFeedback.heavyImpact();
                act(ref, context, sc.hideAll, 'Everything hidden');
              },
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                child: Text(
                  'HIDE ALL',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: .5),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------ actions (the same as the PC)

Future<void> remoteTake(WidgetRef ref, BuildContext context, Json st, String id) async {
  final s = sc.findScene(st, id);
  if (s == null) return;
  final tx = ref.read(selectionProvider).tx;
  await act(ref, context, (n) => sc.take(n, id, tx.isEmpty ? null : tx), '${s['name']} is live');
  ref.read(selectionProvider.notifier).scene(id);
}

Future<void> remoteStepFrame(WidgetRef ref, BuildContext context, Json st, int d) async {
  final from = sc.liveOf(st)['scene'] == '' ? ref.read(selectionProvider).scene : sc.liveOf(st)['scene'];
  final nx = sc.neighbour(st, from, d);
  if (nx == null) return toast(ScaffoldMessenger.maybeOf(context), d > 0 ? 'That’s the last Frame.' : 'That’s the first Frame.');
  await remoteTake(ref, context, st, nx['id'] as String);
}

/// What Previous / Next Content move through in the Frame on screen: its questions, its scriptures.
List<String> contentKinds(Json st) => [
  if (sc.liveScene(st) != null && sc.items(st, 'question').isNotEmpty) 'question',
  if (sc.liveScene(st) != null && sc.items(st, 'verse').isNotEmpty) 'verse',
];

String? currentKind(Json st, String? chosen) {
  final k = contentKinds(st);
  if (chosen != null && k.contains(chosen)) return chosen;
  if ((st['verse'] as Json)['visible'] == true && (st['question'] as Json)['visible'] != true && k.contains('verse')) return 'verse';
  return k.isEmpty ? null : k.first;
}

// ------------------------------------------------------------------ Live

class LiveTab extends ConsumerStatefulWidget {
  const LiveTab({super.key, required this.state});

  final Json state;

  @override
  ConsumerState<LiveTab> createState() => _LiveTabState();
}

class _LiveTabState extends ConsumerState<LiveTab> {
  String? _kind;

  void _stepContent(Json st, int d) {
    final k = currentKind(st, _kind);
    if (k == null) return;
    final l = sc.items(st, k);
    final ci = sc.currentIndex(st, k), j = ci < 0 ? (d > 0 ? 0 : l.length - 1) : ci + d;
    final m = ScaffoldMessenger.maybeOf(context);
    if (j < 0) return toast(m, 'That’s the first one.');
    if (j >= l.length) return toast(m, 'That’s the last one.');
    act(ref, context, (n) => sc.showItem(n, k, l[j]['id']), '${k == 'verse' ? 'Scripture' : 'Question'} ${j + 1}');
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.state;
    final live = sc.liveOf(st);
    final ls = sc.liveScene(st);
    final order = sc.order(st);
    final i = ls == null ? -1 : order.indexWhere((s) => s['id'] == ls['id']);
    final k = currentKind(st, _kind);
    var detail = '';
    if (k != null) {
      final its = sc.items(st, k), ci = sc.currentIndex(st, k);
      final on = (st[k] as Json)['visible'] == true;
      detail = '${ci >= 0 ? '${ci + 1} of ${its.length}' : '${its.length} ready'}${on ? ' · ON SCREEN' : ''}';
    }
    final note = live['blackout'] == true
        ? 'The screen is black. Tap SHOW PICTURE to bring it back.'
        : live['freeze'] == true
        ? 'The picture is frozen. Tap UNFREEZE to go live again.'
        : live['emergency'] == true
        ? 'The Emergency screen is on (on the PC).'
        : '';

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        _Panel(
          eyebrow: 'Current frame',
          title: order.isEmpty ? 'No Frames yet' : (i >= 0 ? 'Frame ${i + 1} of ${order.length}' : 'Not started · ${order.length} Frames'),
          subtitle: ls != null ? ls['name'] as String : (order.isEmpty ? 'Add Frames on the PC' : 'NEXT FRAME starts with ${order.first['name']}'),
          children: [
            _BigButton(label: 'PREVIOUS FRAME', icon: Icons.arrow_left, onTap: () => remoteStepFrame(ref, context, st, -1)),
            _BigButton(label: 'NEXT FRAME', icon: Icons.arrow_right, green: true, iconBelow: true, onTap: () => remoteStepFrame(ref, context, st, 1)),
          ],
        ),
        const SizedBox(height: 14),
        _Panel(
          eyebrow: 'Current content',
          title: k == null ? 'Nothing to step through' : (k == 'verse' ? 'Scripture' : 'Question'),
          subtitle: k != null ? detail : (ls != null ? 'This Frame has no questions or scriptures' : ''),
          action: contentKinds(st).length < 2
              ? null
              : TextButton(
                  onPressed: () {
                    final ks = contentKinds(st);
                    setState(() => _kind = ks[(ks.indexOf(k ?? ks.first) + 1) % ks.length]);
                  },
                  child: const Text('CHANGE', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1)),
                ),
          children: [
            _BigButton(label: 'PREVIOUS CONTENT', icon: Icons.arrow_left, onTap: k == null ? null : () => _stepContent(st, -1)),
            _BigButton(
              label: 'NEXT CONTENT',
              icon: Icons.arrow_right,
              green: true,
              iconBelow: true,
              onTap: k == null ? null : () => _stepContent(st, 1),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: _BigButton(
                label: live['freeze'] == true ? 'UNFREEZE' : 'FREEZE',
                on: live['freeze'] == true,
                onTap: () => act(
                  ref,
                  context,
                  (n) => sc.liveOf(n)['freeze'] = sc.liveOf(n)['freeze'] != true,
                  live['freeze'] == true ? 'Picture live again' : 'Picture frozen',
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _BigButton(
                label: live['blackout'] == true ? 'SHOW PICTURE' : 'BLACK SCREEN',
                on: live['blackout'] == true,
                onTap: () => act(
                  ref,
                  context,
                  (n) => sc.liveOf(n)['blackout'] = sc.liveOf(n)['blackout'] != true,
                  live['blackout'] == true ? 'Picture back' : 'Black screen',
                ),
              ),
            ),
          ],
        ),
        if (note.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              note,
              textAlign: TextAlign.center,
              style: const TextStyle(color: K.accent, fontSize: 13),
            ),
          ),
        const SizedBox(height: 14),
        _BigButton(
          label: 'TELEPROMPTER',
          sub: 'only you see it',
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const TeleprompterPage())),
        ),
        const SizedBox(height: 18),
        const Eyebrow('On screen now'),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: ProgramView(state: st, background: ProgramBackground.dark),
          ),
        ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.eyebrow, required this.title, required this.subtitle, required this.children, this.action});

  final String eyebrow, title, subtitle;
  final List<Widget> children;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: K.line),
      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF172238), Color(0xFF111A2C)]),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Eyebrow(eyebrow)),
            ?action,
          ],
        ),
        const SizedBox(height: 4),
        Text(title, style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w800, height: 1.15)),
        if (subtitle.isNotEmpty) Text(subtitle, style: const TextStyle(color: K.muted, fontSize: 15)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: children[0]),
            const SizedBox(width: 12),
            Expanded(child: children[1]),
          ],
        ),
      ],
    ),
  );
}

class _BigButton extends StatelessWidget {
  const _BigButton({required this.label, required this.onTap, this.icon, this.green = false, this.on = false, this.iconBelow = false, this.sub});

  final String label;
  final String? sub;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool green, on, iconBelow;

  @override
  Widget build(BuildContext context) {
    final fill = green ? _liveGreen : (on ? K.accent : K.raised);
    final ink = green ? Colors.white : (on ? K.accentInk : K.ink);
    final ic = icon == null ? null : Icon(icon, color: ink, size: 30);
    return Opacity(
      opacity: onTap == null ? .45 : 1,
      child: Material(
        color: fill,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: green || on ? fill : K.lineHover),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap == null
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  onTap!();
                },
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 86),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (ic != null && !iconBelow) ic,
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: ink, fontWeight: FontWeight.w800, fontSize: 14.5, letterSpacing: .4),
                  ),
                  if (sub != null)
                    Text(
                      sub!,
                      style: TextStyle(color: ink.withValues(alpha: .7), fontSize: 11.5, fontWeight: FontWeight.w600),
                    ),
                  if (ic != null && iconBelow) ic,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------ Frames

class FramesTab extends ConsumerStatefulWidget {
  const FramesTab({super.key, required this.state, required this.onTaken});

  final Json state;
  final VoidCallback onTaken;

  @override
  ConsumerState<FramesTab> createState() => _FramesTabState();
}

class _FramesTabState extends ConsumerState<FramesTab> {
  var _q = '';

  @override
  Widget build(BuildContext context) {
    final st = widget.state;
    final all = sc.order(st);
    final q = _q.trim().toLowerCase();
    final list = q.isEmpty
        ? all
        : all.where((s) {
            final words = <Object?>[s['name'], s['group'], s['notes']];
            for (final l in sc.layersOf(s)) {
              final c = sc.cOf(l);
              words.addAll([l['name'], c['title'], c['text']]);
              for (final it in (c['items'] as List? ?? const []).cast<Json>()) {
                words.addAll([it['label'], it['text'], it['ref']]);
              }
            }
            return words.join(' ').toLowerCase().contains(q);
          }).toList();
    final liveId = sc.liveOf(st)['scene'];
    final next = liveId == '' ? null : sc.neighbour(st, liveId, 1);
    final sel = ref.watch(selectionProvider).scene;
    String? lastGroup;
    final rows = <Widget>[];
    for (final s in list) {
      final g = (s['group'] ?? '').toString();
      if (g.isNotEmpty && g != lastGroup) {
        rows.add(Padding(padding: const EdgeInsets.fromLTRB(6, 14, 6, 6), child: Eyebrow(g)));
      }
      lastGroup = g;
      final isLive = s['id'] == liveId, isNext = next?['id'] == s['id'];
      rows.add(
        Container(
          margin: const EdgeInsets.only(bottom: 6),
          decoration: BoxDecoration(
            color: isLive ? const Color(0xFF12301F) : (s['id'] == sel ? K.raised : K.surface),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isLive ? K.live : K.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => ref.read(selectionProvider.notifier).scene(s['id'] as String),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 26,
                          child: Text(
                            '${all.indexOf(s) + 1}',
                            style: const TextStyle(color: K.faint, fontWeight: FontWeight.w800),
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5)),
                              Text(
                                sc.layersOf(s).map((l) => kindInfo[l['kind']]?.name ?? '').toSet().join(' · ').ifEmpty('Empty Frame'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: K.muted, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                        if (isLive) const LiveBadge(small: true),
                        if (isNext && !isLive)
                          const Text(
                            'NEXT',
                            style: TextStyle(color: K.muted, fontWeight: FontWeight.w800, fontSize: 11, letterSpacing: 1),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Take ${s['name']} live',
                iconSize: 28,
                icon: Icon(isLive ? Icons.refresh : Icons.play_arrow_rounded, color: K.take),
                onPressed: () async {
                  unawaited(HapticFeedback.lightImpact());
                  await remoteTake(ref, context, st, s['id'] as String);
                  widget.onTaken();
                },
              ),
            ],
          ),
        ),
      );
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Search Frames', prefixIcon: Icon(Icons.search, size: 20)),
            onChanged: (v) => setState(() => _q = v),
          ),
        ),
        Expanded(
          child: rows.isEmpty
              ? Center(
                  child: Text(
                    q.isEmpty ? 'No Frames yet. Create them on the PC (Studio → + Frame).' : 'No Frame matches “${_q.trim()}”.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: K.muted),
                  ),
                )
              : ListView(padding: const EdgeInsets.fromLTRB(14, 4, 14, 14), children: rows),
        ),
      ],
    );
  }
}

extension on String {
  String ifEmpty(String other) => isEmpty ? other : this;
}

// ------------------------------------------------------------------ Content

class ContentTab extends ConsumerWidget {
  const ContentTab({super.key, required this.state});

  final Json state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = state;
    final s = sc.liveScene(st) ?? sc.findScene(st, ref.watch(selectionProvider).scene);
    if (s == null) {
      return const Center(
        child: Text('No Frame yet.', style: TextStyle(color: K.muted)),
      );
    }
    final isLive = sc.isLive(st, s['id']);
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Eyebrow('${s['name']}${isLive ? ' · live' : ''}'),
        const SizedBox(height: 10),
        for (final l in sc.layersOf(s))
          Builder(
            builder: (context) {
              final on = isLive ? sc.layerOn(st, s, l) : l['visible'] == true;
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                decoration: BoxDecoration(
                  color: K.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: on && isLive ? K.live : K.line),
                ),
                child: Row(
                  children: [
                    Icon(kindIcon(l['kind'] as String), color: on ? K.accent : K.faint),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          Text(
                            layerDetail(st, s, l),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: K.muted, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 70,
                      height: 44,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          padding: EdgeInsets.zero,
                          backgroundColor: on ? _liveGreen : K.raised,
                          foregroundColor: on ? Colors.white : K.muted,
                          side: BorderSide(color: on ? _liveGreen : K.lineHover),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          act(ref, context, (n) => sc.toggleVisible(n, s['id'], l['id']));
                        },
                        child: Text(on ? 'ON' : 'OFF', style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

// ------------------------------------------------------------------ Teleprompter

/// The live Frame's script, large, for the person speaking (only on this phone).
class TeleprompterPage extends ConsumerStatefulWidget {
  const TeleprompterPage({super.key});

  @override
  ConsumerState<TeleprompterPage> createState() => _TeleprompterPageState();
}

class _TeleprompterPageState extends ConsumerState<TeleprompterPage> {
  var _size = 30.0;

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(stateProvider).value;
    final ls = st == null ? null : sc.liveScene(st);
    final notes = (ls?['notes'] ?? '').toString().trim();
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: Text(ls?['name'] as String? ?? 'Teleprompter'),
        actions: [
          IconButton(tooltip: 'Smaller', onPressed: () => setState(() => _size = (_size - 4).clamp(16, 80)), icon: const Icon(Icons.text_decrease)),
          IconButton(tooltip: 'Larger', onPressed: () => setState(() => _size = (_size + 4).clamp(16, 80)), icon: const Icon(Icons.text_increase)),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Text(
          notes.isEmpty
              ? (ls == null ? 'Nothing is live yet.' : 'This Frame has no script. Write one on the PC (Frame → Teleprompter script).')
              : notes,
          style: TextStyle(
            color: notes.isEmpty ? K.muted : Colors.white,
            fontSize: notes.isEmpty ? 18 : _size,
            height: 1.45,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
