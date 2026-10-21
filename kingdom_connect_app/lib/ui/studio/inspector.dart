import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../engine/model.dart';
import '../../engine/scenes.dart' as sc;
import '../actions.dart';
import '../fields.dart';
import '../program_view.dart';
import '../providers.dart';
import '../theme.dart';
import 'frames_panel.dart' show confirm;

/// Below the canvas: the selected Frame (Frame · Timing · History) or, with Content selected, that Content.
class Inspector extends ConsumerStatefulWidget {
  const Inspector({super.key, required this.state, required this.scene});

  final Json state;
  final Json scene;

  @override
  ConsumerState<Inspector> createState() => _InspectorState();
}

class _InspectorState extends ConsumerState<Inspector> {
  var _tab = 0;

  @override
  Widget build(BuildContext context) {
    final st = widget.state, s = widget.scene;
    final sel = ref.watch(selectionProvider);
    final layer = sc.layerOf(s, sel.layer);
    final live = sc.isLive(st, s['id']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: K.line)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                width: 36,
                height: 36,
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: K.raised,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: K.line),
                ),
                child: Icon(layer == null ? Icons.dashboard_outlined : kindIcon(layer['kind'] as String), size: 18, color: K.accent),
              ),
              const SizedBox(width: 10),
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text((layer ?? s)['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        if (live) ...[const SizedBox(width: 8), const LiveBadge(small: true)],
                      ],
                    ),
                    Text(
                      layer == null ? 'Frame' : '${kindInfo[layer['kind']]?.name ?? 'Content'} · in ${s['name']}',
                      style: const TextStyle(color: K.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (layer != null)
                Padding(
                  padding: const EdgeInsets.only(left: 10, bottom: 12),
                  child: TextButton.icon(
                    onPressed: () => ref.read(selectionProvider.notifier).layer(''),
                    icon: const Icon(Icons.arrow_back, size: 16),
                    label: const Text('Frame'),
                  ),
                ),
              const SizedBox(width: 30),
              if (layer == null)
                for (final (i, t) in ['Frame', 'Timing', 'History'].indexed)
                  InkWell(
                    onTap: () => setState(() => _tab = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: _tab == i ? K.accent : Colors.transparent, width: 2)),
                      ),
                      child: Text(
                        t,
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: _tab == i ? K.ink : K.muted),
                      ),
                    ),
                  ),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            child: layer != null
                ? ContentEditor(key: ValueKey(layer['id']), state: st, scene: s, layer: layer)
                : switch (_tab) {
                    1 => _TimingTab(key: ValueKey('t${s['id']}'), state: st, scene: s),
                    2 => _HistoryTab(scene: s),
                    _ => _FrameTab(key: ValueKey('f${s['id']}'), state: st, scene: s),
                  },
          ),
        ),
      ],
    );
  }
}

/// Edits the Frame with this id (in the copy being saved).
Future<bool> editScene(WidgetRef ref, BuildContext context, String id, void Function(Json s, Json n) fn, [String? done]) => act(ref, context, (n) {
  final s = sc.findScene(n, id);
  if (s == null) return;
  fn(s, n);
  sc.stamp(s);
}, done);

class _Two extends StatelessWidget {
  const _Two({required this.left, required this.right});

  final List<Widget> left, right;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      Widget col(List<Widget> c) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [for (final w in c) Padding(padding: const EdgeInsets.only(bottom: 12), child: w)],
      );
      if (box.maxWidth < 720) return col([...left, ...right]);
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: col(left)),
          const SizedBox(width: 28),
          Expanded(child: col(right)),
        ],
      );
    },
  );
}

class _FrameTab extends ConsumerWidget {
  const _FrameTab({super.key, required this.state, required this.scene});

  final Json state, scene;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = scene['id'] as String;
    final q = sc.firstOf(scene, 'question');
    final qn = q == null ? 0 : (sc.cOf(q)['items'] as List).length;
    return _Two(
      left: [
        const Eyebrow('Frame'),
        StateField(
          label: 'Name',
          value: scene['name'] as String,
          onSave: (v) => editScene(ref, context, id, (s, _) => s['name'] = v.trim().isEmpty ? 'Frame' : v.trim()),
        ),
        StateField(
          label: 'Group',
          value: scene['group'] as String,
          hint: 'e.g. Romans · Week 5',
          onSave: (v) => editScene(ref, context, id, (s, _) => s['group'] = v.trim()),
        ),
        CheckRow(value: scene['fav'] == true, label: 'Favourite', onChanged: (v) => editScene(ref, context, id, (s, _) => s['fav'] = v)),
        CheckRow(
          value: scene['tpl'] == true,
          label: 'Template (kept for making new Frames; not in Previous / Next)',
          onChanged: (v) => editScene(ref, context, id, (s, _) => s['tpl'] = v),
        ),
        StateField(
          label: 'Teleprompter script',
          value: scene['notes'] as String,
          hint: 'What you say on this Frame. Only you see it.',
          lines: 4,
          onSave: (v) => editScene(ref, context, id, (s, _) => s['notes'] = v),
        ),
      ],
      right: [
        const SizedBox(height: 18),
        KButton(
          onPressed: () => act(ref, context, (n) {
            final c = duplicateScene(n, sc.findScene(n, id)!);
            WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(selectionProvider.notifier).scene(c['id'] as String));
          }, 'Frame duplicated'),
          child: const Text('Duplicate…'),
        ),
        KButton(
          onPressed: () => act(
            ref,
            context,
            (n) => duplicateScene(n, sc.findScene(n, id)!, template: true, name: sc.uniqueName(n, '${scene['name']} template')),
            'Saved as a template (Library)',
          ),
          child: const Text('Save as template'),
        ),
        KButton(
          onPressed: qn < 2 ? null : () => act(ref, context, (n) => framePerQuestion(n, sc.findScene(n, id)!), '$qn Frames made, one per question'),
          tooltip: qn < 2 ? 'The Frame needs two or more questions' : null,
          child: Text('One Frame per question', style: TextStyle(color: qn < 2 ? K.faint : null)),
        ),
        const Divider(),
        const Text(
          'A Frame owns its Content, its transition and its output rules. Select Content on the left to change it. '
          'Go Live (top bar, T, or double-click a Frame) puts it on screen.',
          style: TextStyle(color: K.muted, fontSize: 13, height: 1.45),
        ),
      ],
    );
  }
}

class _TimingTab extends ConsumerWidget {
  const _TimingTab({super.key, required this.state, required this.scene});

  final Json state, scene;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = scene['id'] as String;
    final tx = scene['tx'] as Json, auto = scene['auto'] as Json;
    final p = sc.profileOf(state);
    return _Two(
      left: [
        const Eyebrow('Transition'),
        SelectRow<String>(
          label: 'When this Frame goes live',
          value: tx['type'] as String,
          items: [('profile', 'Profile default (${p.name}: ${sc.txName(p.type)})'), for (final t in transitionsList) (t.$1, t.$2)],
          onChanged: (v) => editScene(ref, context, id, (s, _) {
            (s['tx'] as Json)['type'] = v;
            if (v != 'profile' && v != 'cut') (s['tx'] as Json)['ms'] = txMs[v];
          }),
        ),
        if (tx['type'] != 'profile' && tx['type'] != 'cut')
          SliderRow(
            label: 'Length',
            value: tx['ms'] as num,
            min: 100,
            max: 3000,
            step: 50,
            unit: ' ms',
            onChanged: (v) => editScene(ref, context, id, (s, _) => (s['tx'] as Json)['ms'] = v),
          ),
      ],
      right: [
        const Eyebrow('Auto advance'),
        CheckRow(
          value: auto['on'] == true,
          label: 'Move on to the next Frame by itself',
          onChanged: (v) => editScene(ref, context, id, (s, _) => (s['auto'] as Json)['on'] = v),
        ),
        if (auto['on'] == true)
          SliderRow(
            label: 'After',
            value: auto['sec'] as num,
            min: 2,
            max: 300,
            step: 1,
            unit: ' s',
            onChanged: (v) => editScene(ref, context, id, (s, _) => (s['auto'] as Json)['sec'] = v),
          ),
        Text(
          sc.liveOf(state)['auto'] == true ? 'Auto is on in the top bar.' : 'Auto is off in the top bar, so Frames wait for you.',
          style: const TextStyle(color: K.muted, fontSize: 12.5),
        ),
      ],
    );
  }
}

class _HistoryTab extends StatelessWidget {
  const _HistoryTab({required this.scene});

  final Json scene;

  @override
  Widget build(BuildContext context) {
    final f = DateFormat('d MMM yyyy, HH:mm');
    String when(Object? ms) => ms is num && ms > 0 ? f.format(DateTime.fromMillisecondsSinceEpoch(ms.toInt())) : '—';
    final rows = <(String, String)>[
      ('Created', when(scene['created'])),
      ('Last changed', when(scene['modified'])),
      ('Version', '${scene['version']}'),
      ('Made by', (scene['creator'] ?? '').toString().isEmpty ? '—' : scene['creator'].toString()),
      ('From template', (scene['template'] ?? '').toString().isEmpty ? '—' : scene['template'].toString()),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Eyebrow('History'),
        const SizedBox(height: 10),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                SizedBox(
                  width: 140,
                  child: Text(r.$1, style: const TextStyle(color: K.muted, fontSize: 13)),
                ),
                Text(r.$2, style: const TextStyle(fontSize: 13.5)),
              ],
            ),
          ),
      ],
    );
  }
}

// ------------------------------------------------------------------ Content

/// Edits one Content: its name, what it shows and how it looks.
class ContentEditor extends ConsumerWidget {
  const ContentEditor({super.key, required this.state, required this.scene, required this.layer});

  final Json state, scene, layer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sid = scene['id'] as String, lid = layer['id'] as String;
    final kind = layer['kind'] as String;
    final c = sc.cOf(layer);
    final locked = layer['locked'] == true;

    Future<bool> edit(void Function(Json l, Json n) fn, [String? done]) => editScene(ref, context, sid, (s, n) {
      final l = sc.layerOf(s, lid);
      if (l != null) fn(l, n);
    }, done);

    final common = <Widget>[
      StateField(
        label: 'Name',
        value: layer['name'] as String,
        enabled: !locked,
        onSave: (v) => edit((l, _) => l['name'] = v.trim().isEmpty ? kindInfo[kind]!.name : v.trim()),
      ),
      if (locked) const Text('Locked: unlock it in the Content list to change it.', style: TextStyle(color: K.accent, fontSize: 12.5)),
    ];
    final danger = KButton(
      onPressed: locked
          ? null
          : () async {
              final ok = await confirm(context, 'Delete “${layer['name']}”?', 'It is removed from ${scene['name']}.');
              if (!ok || !context.mounted) return;
              ref.read(selectionProvider.notifier).layer('');
              await edit((l, n) {
                if (sc.isLive(n, sid)) sc.setOn(n, sid, lid, false);
                (sc.findScene(n, sid)!['layers'] as List).removeWhere((x) => (x as Json)['id'] == lid);
              }, 'Content deleted');
            },
      child: const Text('Delete Content', style: TextStyle(color: K.redText)),
    );

    if (kind == 'question' || kind == 'scripture') {
      return _ListEditor(state: state, scene: scene, layer: layer, common: common, danger: danger, edit: edit, locked: locked);
    }
    if (kind == 'birthday') {
      final b = state['birthday'] as Json;
      Future<bool> bd(String k, Object v) => act(ref, context, (n) => (n['birthday'] as Json)[k] = v);
      return _Two(
        left: [
          ...common,
          const Eyebrow('Birthday card'),
          StateField(label: 'Name', value: b['name'] as String, onSave: (v) => bd('name', v)),
          StateField(label: 'Greeting', value: b['greeting'] as String, hint: 'Happy Birthday, Grace!', onSave: (v) => bd('greeting', v)),
          StateField(label: 'Message', value: b['message'] as String, lines: 2, onSave: (v) => bd('message', v)),
          StateField(label: 'Country', value: b['country'] as String, onSave: (v) => bd('country', v)),
        ],
        right: [
          const Eyebrow('Look'),
          StateField(label: 'Card label', value: b['label'] as String, onSave: (v) => bd('label', v)),
          CheckRow(value: b['showLabel'] == true, label: 'Show the label', onChanged: (v) => bd('showLabel', v)),
          SelectRow<String>(
            label: 'Position',
            value: (state['layout'] as Json)['bdayPos'] as String,
            items: const [('top', 'Top'), ('center', 'Centre'), ('bottom', 'Bottom')],
            onChanged: (v) => act(ref, context, (n) => (n['layout'] as Json)['bdayPos'] = v),
          ),
          danger,
        ],
      );
    }
    if (kind == 'brand') {
      final b = state['brand'] as Json;
      return _Two(
        left: [
          ...common,
          const Eyebrow('Branding badge'),
          Text(
            'Shows the meeting name “${b['meeting']}”, the organisation “${b['org']}” and the logo from Settings → Branding.',
            style: const TextStyle(color: K.muted, fontSize: 13),
          ),
          CheckRow(value: c['logo'] == true, label: 'Logo', onChanged: (v) => edit((l, _) => sc.cOf(l)['logo'] = v)),
          CheckRow(value: c['name'] == true, label: 'Meeting name', onChanged: (v) => edit((l, _) => sc.cOf(l)['name'] = v)),
          CheckRow(value: c['org'] == true, label: 'Organisation', onChanged: (v) => edit((l, _) => sc.cOf(l)['org'] = v)),
          CheckRow(value: c['plate'] != false, label: 'Navy plate behind it', onChanged: (v) => edit((l, _) => sc.cOf(l)['plate'] = v)),
        ],
        right: [
          const Eyebrow('Display'),
          _PosSelect(value: c['pos'] as String, onChanged: (v) => edit((l, _) => sc.cOf(l)['pos'] = v)),
          SliderRow(label: 'Size', value: c['scale'] as num, min: .5, max: 2.5, step: .05, onChanged: (v) => edit((l, _) => sc.cOf(l)['scale'] = v)),
          SliderRow(label: 'Padding', value: c['pad'] as num, min: 0, max: 3, step: .1, onChanged: (v) => edit((l, _) => sc.cOf(l)['pad'] = v)),
          SliderRow(
            label: 'Margin from the edge',
            value: c['margin'] as num,
            min: 0,
            max: 12,
            step: .5,
            onChanged: (v) => edit((l, _) => sc.cOf(l)['margin'] = v),
          ),
          danger,
        ],
      );
    }
    if (sc.isText(kind)) {
      final cd = kind == 'countdown';
      return _Two(
        left: [
          ...common,
          const Eyebrow('Content'),
          StateField(
            label: cd ? 'Title (above the time)' : (kind == 'lowerthird' ? 'Name' : 'Title'),
            value: c['title'] as String,
            enabled: !locked,
            onSave: (v) => edit((l, _) => sc.cOf(l)['title'] = v),
          ),
          StateField(
            label: cd ? 'When the time is up' : (kind == 'lowerthird' ? 'Role or line' : 'Text'),
            value: c['text'] as String,
            enabled: !locked,
            lines: cd || kind == 'lowerthird' ? 1 : 3,
            hint: 'You can write {meeting} and {org}',
            onSave: (v) => edit((l, _) => sc.cOf(l)['text'] = v),
          ),
          if (cd) ...[
            SelectRow<String>(
              label: 'Count',
              value: c['mode'] as String,
              items: const [('duration', 'Minutes from Go Live'), ('until', 'Until a time of day')],
              onChanged: (v) => edit((l, _) => sc.cOf(l)['mode'] = v),
            ),
            if (c['mode'] == 'until')
              StateField(label: 'Until (HH:MM)', value: c['until'] as String, onSave: (v) => edit((l, _) => sc.cOf(l)['until'] = v.trim()))
            else
              SliderRow(
                label: 'Minutes',
                value: c['minutes'] as num,
                min: 1,
                max: 120,
                step: 1,
                onChanged: (v) => edit((l, _) => sc.cOf(l)['minutes'] = v),
              ),
          ],
        ],
        right: [
          const Eyebrow('Display'),
          _PosSelect(value: c['pos'] as String, onChanged: (v) => edit((l, _) => sc.cOf(l)['pos'] = v)),
          SliderRow(label: 'Width', value: c['w'] as num, min: 20, max: 96, step: 1, unit: '%', onChanged: (v) => edit((l, _) => sc.cOf(l)['w'] = v)),
          SliderRow(label: 'Size', value: c['scale'] as num, min: .5, max: 2.5, step: .05, onChanged: (v) => edit((l, _) => sc.cOf(l)['scale'] = v)),
          CheckRow(value: c['label'] == true, label: 'Show the title', onChanged: (v) => edit((l, _) => sc.cOf(l)['label'] = v)),
          CheckRow(value: c['logo'] == true, label: 'Show the logo', onChanged: (v) => edit((l, _) => sc.cOf(l)['logo'] = v)),
          danger,
        ],
      );
    }
    // camera, screen, slides and other media: shown by the Windows app's capture
    return _Two(
      left: [
        ...common,
        Text(
          '${kindInfo[kind]?.name ?? 'This'} Content is drawn by FRAMEDECKS on the Windows PC (its camera, screen and media '
          'capture). Here you can rename it, show or hide it, and delete it.',
          style: const TextStyle(color: K.muted, fontSize: 13, height: 1.45),
        ),
      ],
      right: [danger],
    );
  }
}

class _PosSelect extends StatelessWidget {
  const _PosSelect({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => SelectRow<String>(
    label: 'Position',
    value: value,
    items: const [
      ('top', 'Top'),
      ('center', 'Centre'),
      ('bottom', 'Bottom'),
      ('lower-left', 'Lower left'),
      ('lower-right', 'Lower right'),
      ('upper-left', 'Upper left'),
      ('upper-right', 'Upper right'),
    ],
    onChanged: onChanged,
  );
}

/// The questions or scriptures of a Question / Scripture Content: edit, add, remove, reorder, show one.
class _ListEditor extends ConsumerWidget {
  const _ListEditor({
    required this.state,
    required this.scene,
    required this.layer,
    required this.common,
    required this.danger,
    required this.edit,
    required this.locked,
  });

  final Json state, scene, layer;
  final List<Widget> common;
  final Widget danger;
  final Future<bool> Function(void Function(Json l, Json n) fn, [String? done]) edit;
  final bool locked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kind = layer['kind'] as String;
    final verse = kind == 'scripture';
    final k = verse ? 'verse' : 'question';
    final c = sc.cOf(layer);
    final its = (c['items'] as List).cast<Json>();
    final card = state[k] as Json;
    final live = sc.isLive(state, scene['id']);

    /// Changes one item; when it is the one on screen, the card follows.
    Future<bool> editItem(String id, String field, String v) => edit((l, n) {
      for (final it in (sc.cOf(l)['items'] as List).cast<Json>()) {
        if (it['id'] == id) it[field] = v;
      }
      final o = n[k] as Json;
      if (o['itemId'] == id && (field == 'text' || field == 'ref' || field == 'version')) o[field] = v;
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Two(
          left: [
            ...common,
            StateField(
              label: 'Card label',
              value: (c['label'] ?? '').toString(),
              hint: verse ? 'Focus Verse' : 'Discussion Question',
              enabled: !locked,
              onSave: (v) => edit((l, _) => sc.cOf(l)['label'] = v),
            ),
          ],
          right: [
            SelectRow<String>(
              label: 'Card animation',
              value: card['transition'] as String,
              items: [for (final t in cardTransitions) (t, cardTransitionNames[t]!)],
              onChanged: (v) => act(ref, context, (n) => (n[k] as Json)['transition'] = v),
            ),
            CheckRow(
              value: card['showLabel'] == true,
              label: 'Show the label on the card',
              onChanged: (v) => act(ref, context, (n) => (n[k] as Json)['showLabel'] = v),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Eyebrow(verse ? 'Scriptures (${its.length})' : 'Questions (${its.length})'),
            const Spacer(),
            KButton(
              onPressed: locked
                  ? null
                  : () => edit((l, _) {
                      final it = verse
                          ? {'id': sc.newItemId('verse'), 'ref': '', 'version': 'KJV', 'text': ''}
                          : {'id': sc.newItemId('question'), 'text': ''};
                      (sc.cOf(l)['items'] as List).add(it);
                      if ((sc.cOf(l)['itemId'] ?? '') == '') sc.cOf(l)['itemId'] = it['id'];
                    }),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [const Icon(Icons.add), const SizedBox(width: 4), Text(verse ? 'Scripture' : 'Question')],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (its.isEmpty) Text(verse ? 'No scriptures yet.' : 'No questions yet.', style: const TextStyle(color: K.muted, fontSize: 13)),
        for (final (i, it) in its.indexed)
          Container(
            key: ValueKey(it['id']),
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: K.panel,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: live && card['itemId'] == it['id'] && card['visible'] == true ? K.live : K.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text(
                      '${i + 1}',
                      style: const TextStyle(color: K.faint, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(width: 10),
                    if (live && card['itemId'] == it['id'] && card['visible'] == true) const LiveBadge(small: true),
                    const Spacer(),
                    if (live)
                      TextButton(
                        onPressed: () =>
                            act(ref, context, (n) => sc.showItem(n, k, it['id']), '${verse ? 'Scripture' : 'Question'} ${i + 1} on screen'),
                        child: const Text('Show'),
                      ),
                    IconButton(
                      tooltip: 'Move up',
                      visualDensity: VisualDensity.compact,
                      onPressed: locked || i == 0
                          ? null
                          : () => edit((l, _) {
                              final a = sc.cOf(l)['items'] as List;
                              a.insert(i - 1, a.removeAt(i));
                            }),
                      icon: const Icon(Icons.arrow_upward, size: 16),
                    ),
                    IconButton(
                      tooltip: 'Remove',
                      visualDensity: VisualDensity.compact,
                      onPressed: locked
                          ? null
                          : () => edit((l, _) {
                              (sc.cOf(l)['items'] as List).removeWhere((x) => (x as Json)['id'] == it['id']);
                              if (sc.cOf(l)['itemId'] == it['id']) sc.cOf(l)['itemId'] = '';
                            }),
                      icon: const Icon(Icons.delete_outline, size: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (verse)
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: StateField(
                          value: (it['ref'] ?? '').toString(),
                          hint: 'Reference (Psalm 119:105)',
                          enabled: !locked,
                          onSave: (v) => editItem(it['id'] as String, 'ref', v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: StateField(
                          value: (it['version'] ?? '').toString(),
                          hint: 'KJV',
                          enabled: !locked,
                          onSave: (v) => editItem(it['id'] as String, 'version', v),
                        ),
                      ),
                    ],
                  ),
                if (verse) const SizedBox(height: 8),
                StateField(
                  value: (it['text'] ?? '').toString(),
                  hint: verse ? 'The verse' : 'The question',
                  lines: 2,
                  enabled: !locked,
                  onSave: (v) => editItem(it['id'] as String, 'text', v),
                ),
              ],
            ),
          ),
        const SizedBox(height: 8),
        Align(alignment: Alignment.centerLeft, child: danger),
      ],
    );
  }
}
