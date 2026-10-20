import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/migration/backup_codec.dart';
import '../../../data/models/meeting.dart';
import '../../../data/models/records.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../../../widgets/record_list.dart';

class MinistriesScreen extends ConsumerWidget {
  const MinistriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetings = ref.watch(meetingsProvider).value ?? const <Meeting>[];
    final volunteers = ref.watch(volunteersProvider).value ?? const <Volunteer>[];
    return RecordListPage<Ministry>(
      title: 'Ministries',
      subtitle: 'The teams and groups your meetings, volunteers and schedules belong to.',
      addLabel: 'Add ministry',
      emptyIcon: Icons.church_outlined,
      emptyTitle: 'No ministries yet',
      emptyMessage: 'Add Youth, Worship, Prayer, Outreach … to group meetings and volunteers.',
      provider: ministriesProvider,
      searchText: (m) => '${m.name} ${m.leader} ${m.description}',
      filters: [ListFilter('Active', (m) => m.active), ListFilter('All', (_) => true)],
      sort: (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
      onAdd: (c) => editMinistry(c, null),
      tile: (c, m) {
        final count = meetings.where((x) => x.ministryUid == m.uid).length;
        final people = volunteers.where((v) => v.ministryUids.contains(m.uid)).length;
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: KC.s4, vertical: KC.s1),
          leading: CircleAvatar(backgroundColor: _color(m, c).withValues(alpha: 0.18), child: Icon(Icons.church, color: _color(m, c))),
          title: Text(m.displayTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text([if (m.leader.isNotEmpty) 'Led by ${m.leader}', '$count meetings', '$people volunteers'].join(' · ')),
          trailing: Wrap(spacing: KC.s1, children: [
            if (!m.active) const StatusPill('Inactive', color: Colors.grey),
            IconButton(
              tooltip: 'New meeting for ${m.name}',
              icon: const Icon(Icons.event_available_outlined),
              onPressed: () => c.go('/meetings/new?ministry=${m.uid}'),
            ),
          ]),
          onTap: () => editMinistry(c, m),
        );
      },
    );
  }
}

Color _color(Ministry m, BuildContext c) {
  final hex = m.colorHex.replaceAll('#', '');
  final v = hex.length == 6 ? int.tryParse(hex, radix: 16) : null;
  return v == null ? Theme.of(c).colorScheme.primary : Color(0xFF000000 | v);
}

Future<void> editMinistry(BuildContext context, Ministry? existing) =>
    showEditor<void>(context, title: existing == null ? 'New ministry' : 'Ministry', builder: (_) => _MinistryEditor(existing));

class _MinistryEditor extends ConsumerStatefulWidget {
  const _MinistryEditor(this.existing);

  final Ministry? existing;

  @override
  ConsumerState<_MinistryEditor> createState() => _MinistryEditorState();
}

class _MinistryEditorState extends ConsumerState<_MinistryEditor> {
  late final Ministry m = widget.existing == null
      ? Ministry()
      : (BackupCodec.ministryFromJson(BackupCodec.ministryToJson(widget.existing!))..id = widget.existing!.id);

  static const _swatches = ['', '#1F3A6D', '#2E7D4F', '#8E3B46', '#6A4C93', '#C77700', '#0E7C86'];

  Future<void> _save() async {
    if (m.name.trim().isEmpty) return showFailure(context, 'Give the ministry a name.');
    try {
      await ref.read(databaseProvider).ministries.save(m);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showFailure(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        EditorField(label: 'Name', initial: m.name, onChanged: (v) => m.name = v, icon: Icons.church_outlined,
            autofocus: widget.existing == null),
        EditorField(label: 'Leader', initial: m.leader, onChanged: (v) => m.leader = v, icon: Icons.person_outline),
        EditorField(label: 'Description', initial: m.description, onChanged: (v) => m.description = v, lines: 2),
        StatefulBuilder(
          builder: (c, set) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Colour', style: Theme.of(c).textTheme.labelLarge),
            const SizedBox(height: KC.s2),
            Wrap(spacing: KC.s2, children: [
              for (final hex in _swatches)
                Semantics(
                  label: hex.isEmpty ? 'App colour' : 'Colour $hex',
                  selected: m.colorHex == hex,
                  button: true,
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => set(() => m.colorHex = hex),
                    child: CircleAvatar(
                      radius: 18,
                      backgroundColor: hex.isEmpty ? Theme.of(c).colorScheme.primary : Color(0xFF000000 | int.parse(hex.substring(1), radix: 16)),
                      child: m.colorHex == hex ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
                    ),
                  ),
                ),
            ]),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Active'),
              value: m.active,
              onChanged: (v) => set(() => m.active = v),
            ),
          ]),
        ),
        EditorActions(
          onSave: _save,
          onDelete: widget.existing == null
              ? null
              : () async {
                  await ref.read(databaseProvider).ministries.delete(widget.existing!.uid);
                  if (context.mounted) Navigator.pop(context);
                },
        ),
      ]);
}
