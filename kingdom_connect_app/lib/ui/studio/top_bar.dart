import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../engine/backend.dart';
import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../providers.dart';
import '../theme.dart';

/// The Frame Go Live puts on screen: the selected one, or (when the selected one is already live) the next.
String? goLiveTarget(Json st, Selection sel) {
  final picked = sc.findScene(st, sel.scene);
  if (picked != null && picked['tpl'] != true && !sc.isLive(st, picked['id'])) return picked['id'] as String;
  return sc.neighbour(st, sc.liveOf(st)['scene'], 1)?['id'] as String?;
}

Future<void> goLive(WidgetRef ref, BuildContext context, Json st, [String? id]) async {
  final sel = ref.read(selectionProvider);
  final target = id ?? goLiveTarget(st, sel);
  final scene = sc.findScene(st, target);
  if (scene == null) {
    toast(ScaffoldMessenger.maybeOf(context), 'Choose a Frame first.', bad: true);
    return;
  }
  final tx = sel.tx.isEmpty ? null : sel.tx;
  await act(ref, context, (n) => sc.take(n, target, tx), '${scene['name']} is live');
  ref.read(selectionProvider.notifier).scene(target!);
}

/// Previous / Next: the live Frame's Decks first, then the next (or previous) Frame (FRAMEDECKS: Frame → Deck → Content).
Future<void> stepFrame(WidgetRef ref, BuildContext context, Json st, int d) async {
  if (sc.liveOf(st)['scene'] != '') {
    final t = sc.stepTarget(st, d);
    if (t == null) {
      toast(ScaffoldMessenger.maybeOf(context), d > 0 ? 'That’s the last Frame.' : 'That’s the first Frame.');
      return;
    }
    final tx = ref.read(selectionProvider).tx;
    final many = sc.decksOf(t.scene).length > 1;
    await act(ref, context, (n) => sc.step(n, d, tx.isEmpty ? null : tx), '${t.scene['name']}${many ? ' · ${t.deck['name']}' : ''} is live');
    ref.read(selectionProvider.notifier).scene(t.scene['id'] as String);
    return;
  }
  final nx = sc.neighbour(st, ref.read(selectionProvider).scene, d);
  if (nx == null) {
    toast(ScaffoldMessenger.maybeOf(context), d > 0 ? 'That’s the last Frame.' : 'That’s the first Frame.');
    return;
  }
  await goLive(ref, context, st, nx['id'] as String);
}

Future<void> stepItem(WidgetRef ref, BuildContext context, Json st, int d) async {
  final k = sc.stepKind(st, ref.read(selectionProvider).layer);
  if (k == null) return;
  final l = sc.items(st, k);
  final m = ScaffoldMessenger.maybeOf(context);
  if (l.isEmpty) return toast(m, 'The list is empty.', bad: true);
  final i = sc.currentIndex(st, k), j = i < 0 ? (d > 0 ? 0 : l.length - 1) : i + d;
  if (j < 0) return toast(m, 'That’s the first one.');
  if (j >= l.length) return toast(m, 'That’s the last one.');
  await act(ref, context, (n) => sc.showItem(n, k, l[j]['id']));
}

Future<void> hideAll(WidgetRef ref, BuildContext context) => act(ref, context, sc.hideAll, 'Everything hidden');

class TopBar extends ConsumerWidget {
  const TopBar({super.key, required this.state});

  final Json state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = state;
    final live = sc.liveOf(st);
    final ls = sc.liveScene(st);
    final sel = ref.watch(selectionProvider);
    final page = ref.watch(pageProvider);
    final link = ref.watch(linkProvider).value ?? Link.connecting;
    final kind = sc.stepKind(st, sel.layer);
    final its = kind == null ? const <Json>[] : sc.items(st, kind);
    final idx = kind == null ? -1 : sc.currentIndex(st, kind);
    final onAir =
        ls != null &&
        ((st['question'] as Json)['visible'] == true ||
            (st['verse'] as Json)['visible'] == true ||
            (st['birthday'] as Json)['visible'] == true ||
            (live['on'] as Json).isNotEmpty ||
            sc.layersOf(ls).any((l) => sc.isMedia(l['kind'] as String) && l['visible'] == true));
    final narrow = MediaQuery.sizeOf(context).width < 1180;

    return Container(
      height: 56,
      decoration: const BoxDecoration(
        color: K.chromeBg,
        border: Border(bottom: BorderSide(color: K.line)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          Image.asset('assets/brand/kc-mark.png', height: 32, filterQuality: FilterQuality.medium),
          const SizedBox(width: 14),
          _Tabs(page: page, onPick: (p) => ref.read(pageProvider.notifier).show(p)),
          const Spacer(),
          // ◀  GO LIVE  ▶
          _Group(
            children: [
              _IconBtn(icon: Icons.arrow_left, tooltip: 'Previous Deck or Frame (live)', onTap: () => stepFrame(ref, context, st, -1)),
              _GoLive(onAir: ls?['name'] as String?, onTap: () => goLive(ref, context, st)),
              _IconBtn(icon: Icons.arrow_right, tooltip: 'Next Deck or Frame (live)', onTap: () => stepFrame(ref, context, st, 1)),
            ],
          ),
          const SizedBox(width: 10),
          _TransitionSelect(value: sel.tx, onChanged: (v) => ref.read(selectionProvider.notifier).tx(v)),
          const SizedBox(width: 10),
          KButton(
            outlineGold: live['auto'] == true,
            tooltip: 'Auto: Frames with an auto time move on by themselves',
            onPressed: () => act(ref, context, (n) => sc.liveOf(n)['auto'] = sc.liveOf(n)['auto'] != true),
            child: Text('Auto', style: TextStyle(color: live['auto'] == true ? K.accent : K.muted)),
          ),
          if (!narrow) ...[
            const SizedBox(width: 10),
            _Group(
              children: [
                _IconBtn(icon: Icons.arrow_left, tooltip: 'Previous item', onTap: kind == null ? null : () => stepItem(ref, context, st, -1)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    kind == null ? 'No list' : '${kind == 'verse' ? 'Scripture' : 'Question'} ${idx < 0 ? '–' : idx + 1} / ${its.length}',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: kind == null ? K.faint : K.ink),
                  ),
                ),
                _IconBtn(icon: Icons.arrow_right, tooltip: 'Next item', onTap: kind == null ? null : () => stepItem(ref, context, st, 1)),
              ],
            ),
          ],
          const SizedBox(width: 10),
          _ProgramMenu(state: st),
          const Spacer(),
          _OnAirPill(on: onAir, black: live['blackout'] == true, emergency: live['emergency'] == true),
          const SizedBox(width: 10),
          Tooltip(
            message: switch (link) {
              Link.online => 'Saved · ${ref.read(backendProvider).label}',
              Link.connecting => 'Connecting…',
              Link.offline => 'Not connected to ${ref.read(backendProvider).label}',
              Link.needsPin => 'Needs the PIN',
            },
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: link == Link.online ? K.accent : (link == Link.connecting ? K.muted : K.redText),
              ),
            ),
          ),
          const SizedBox(width: 14),
          _HideAll(onTap: () => hideAll(ref, context)),
        ],
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.page, required this.onPick});

  final AppPage page;
  final ValueChanged<AppPage> onPick;

  @override
  Widget build(BuildContext context) {
    Widget tab(AppPage p, IconData icon, String tip) => Tooltip(
      message: tip,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => onPick(p),
        child: Container(
          width: 38,
          height: 34,
          decoration: BoxDecoration(color: page == p ? K.neutralBtn : null, borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, size: 19, color: page == p ? K.accent : K.muted),
        ),
      ),
    );
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: K.surface,
        border: Border.all(color: K.line),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [tab(AppPage.studio, Icons.movie_creation_outlined, 'Studio'), tab(AppPage.settings, Icons.settings_outlined, 'Settings')],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    height: 42,
    padding: const EdgeInsets.all(3),
    decoration: BoxDecoration(
      color: K.surface,
      border: Border.all(color: K.line),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: children),
  );
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.tooltip, required this.onTap});

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: InkWell(
      borderRadius: BorderRadius.circular(7),
      onTap: onTap,
      child: SizedBox(width: 38, height: 36, child: Icon(icon, size: 22, color: onTap == null ? K.faint : K.ink)),
    ),
  );
}

class _GoLive extends StatelessWidget {
  const _GoLive({required this.onAir, required this.onTap});

  final String? onAir;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'Go Live: put the selected Frame on screen (T)',
    child: Material(
      color: K.take,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minWidth: 170),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.play_arrow_rounded, color: K.takeInk, size: 18),
              const SizedBox(width: 8),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'GO LIVE',
                    style: TextStyle(color: K.takeInk, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1.4, height: 1.1),
                  ),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 140),
                    child: Text(
                      onAir == null ? 'Nothing on air' : '● On air: $onAir',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: K.takeInk, fontWeight: FontWeight.w700, fontSize: 11, height: 1.2),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),
              const Kbd('T', color: K.takeInk),
            ],
          ),
        ),
      ),
    ),
  );
}

class _TransitionSelect extends StatelessWidget {
  const _TransitionSelect({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'Transition for the next Go Live',
    child: Container(
      height: 38,
      padding: const EdgeInsets.only(left: 12, right: 6),
      decoration: BoxDecoration(
        color: K.surface,
        border: Border.all(color: K.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          dropdownColor: K.raised,
          iconEnabledColor: K.muted,
          style: const TextStyle(color: K.ink, fontSize: 13.5, fontFamily: K.sans),
          items: [
            const DropdownMenuItem(value: '', child: Text('Frame default')),
            for (final t in transitionsList) DropdownMenuItem(value: t.$1, child: Text(t.$2)),
          ],
          onChanged: (v) => onChanged(v ?? ''),
        ),
      ),
    ),
  );
}

class _ProgramMenu extends ConsumerWidget {
  const _ProgramMenu({required this.state});

  final Json state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final live = sc.liveOf(state);
    return PopupMenuButton<String>(
      tooltip: 'Program: Blackout, Emergency screen, Freeze and the meeting profile',
      offset: const Offset(0, 44),
      onSelected: (v) {
        switch (v) {
          case 'blackout':
            act(
              ref,
              context,
              (n) => sc.liveOf(n)['blackout'] = sc.liveOf(n)['blackout'] != true,
              live['blackout'] == true ? 'Picture back' : 'Black screen',
            );
          case 'emergency':
            act(
              ref,
              context,
              (n) => sc.liveOf(n)['emergency'] = sc.liveOf(n)['emergency'] != true,
              live['emergency'] == true ? 'Emergency screen off' : 'Emergency screen on',
            );
          case 'freeze':
            act(
              ref,
              context,
              (n) => sc.liveOf(n)['freeze'] = sc.liveOf(n)['freeze'] != true,
              live['freeze'] == true ? 'Picture live again' : 'Picture frozen',
            );
          default:
            if (v.startsWith('profile:')) {
              final id = v.substring(8);
              act(ref, context, (n) => n['profile'] = id, 'Profile: ${profiles.firstWhere((p) => p.id == id).name}');
            }
        }
      },
      itemBuilder: (_) => [
        CheckedPopupMenuItem(value: 'blackout', checked: live['blackout'] == true, child: const Text('Black screen')),
        CheckedPopupMenuItem(value: 'emergency', checked: live['emergency'] == true, child: const Text('Emergency screen')),
        CheckedPopupMenuItem(value: 'freeze', checked: live['freeze'] == true, child: const Text('Freeze the picture')),
        const PopupMenuDivider(),
        const PopupMenuItem(enabled: false, height: 28, child: Eyebrow('Meeting profile')),
        for (final p in profiles)
          CheckedPopupMenuItem(value: 'profile:${p.id}', checked: state['profile'] == p.id, child: Text('${p.name} · ${sc.txName(p.type)}')),
      ],
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: K.surface,
          border: Border.all(color: K.line),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Program', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
            Icon(Icons.arrow_drop_down, color: K.muted),
          ],
        ),
      ),
    );
  }
}

class _OnAirPill extends StatelessWidget {
  const _OnAirPill({required this.on, required this.black, required this.emergency});

  final bool on, black, emergency;

  @override
  Widget build(BuildContext context) {
    final bad = black || emergency;
    final color = bad ? K.redText : (on ? K.liveText : K.faint);
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: bad ? K.red.withValues(alpha: .12) : (on ? K.liveSoft : K.surface),
        border: Border.all(color: color.withValues(alpha: .6)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 8),
          Text(
            black ? 'BLACK' : (emergency ? 'EMERGENCY' : (on ? 'LIVE' : 'OFF AIR')),
            style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1.2),
          ),
        ],
      ),
    );
  }
}

class _HideAll extends StatelessWidget {
  const _HideAll({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'Hide everything on screen (Esc)',
    child: Material(
      color: K.red,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'HIDE ALL',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.5, letterSpacing: 1),
              ),
              SizedBox(width: 10),
              Kbd('ESC'),
            ],
          ),
        ),
      ),
    ),
  );
}
