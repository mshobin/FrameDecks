import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/migration/backup_codec.dart';
import '../../../data/models/records.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../../../widgets/record_list.dart';

class VolunteersScreen extends ConsumerWidget {
  const VolunteersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final names = ref.watch(ministryNamesProvider);
    return RecordListPage<Volunteer>(
      title: 'Volunteers',
      subtitle: 'Everyone who serves, what they do and how to reach them.',
      addLabel: 'Add volunteer',
      emptyIcon: Icons.groups_outlined,
      emptyTitle: 'No volunteers yet',
      emptyMessage: 'Add people here, or import the member list from the Windows app in Settings.',
      provider: volunteersProvider,
      searchText: (v) => '${v.name} ${v.roles.join(' ')} ${v.email} ${v.phone} ${v.ministryUids.map((u) => names[u] ?? '').join(' ')}',
      filters: [
        ListFilter('Active', (v) => v.active),
        ListFilter('Inactive', (v) => !v.active),
        ListFilter('All', (_) => true),
      ],
      sort: (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
      onAdd: (c) => editVolunteer(c, null),
      tile: (c, v) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: KC.s4, vertical: KC.s1),
        leading: CircleAvatar(child: Text(v.name.isEmpty ? '?' : v.name[0].toUpperCase())),
        title: Text(v.displayTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text([
          ...v.roles,
          ...v.ministryUids.map((u) => names[u]).whereType<String>(),
          if (v.availability.isNotEmpty) v.availability,
        ].join(' · ')),
        trailing: v.active ? null : const StatusPill('Inactive', color: Colors.grey),
        onTap: () => editVolunteer(c, v),
      ),
    );
  }
}

Future<void> editVolunteer(BuildContext context, Volunteer? existing) =>
    showEditor<void>(context, title: existing == null ? 'New volunteer' : 'Volunteer', builder: (_) => _VolunteerEditor(existing));

class _VolunteerEditor extends ConsumerStatefulWidget {
  const _VolunteerEditor(this.existing);

  final Volunteer? existing;

  @override
  ConsumerState<_VolunteerEditor> createState() => _VolunteerEditorState();
}

class _VolunteerEditorState extends ConsumerState<_VolunteerEditor> {
  late final Volunteer v = widget.existing == null
      ? Volunteer()
      : (BackupCodec.volunteerFromJson(BackupCodec.volunteerToJson(widget.existing!))..id = widget.existing!.id);

  Future<void> _save() async {
    if (v.name.trim().isEmpty) return showFailure(context, 'Add the volunteer’s name.');
    try {
      await ref.read(databaseProvider).volunteers.save(v);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showFailure(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ministries = ref.watch(ministriesProvider).value ?? const <Ministry>[];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      EditorField(label: 'Name', initial: v.name, onChanged: (x) => v.name = x, icon: Icons.person_outline,
          autofocus: widget.existing == null),
      EditorField(label: 'Phone', initial: v.phone, onChanged: (x) => v.phone = x, icon: Icons.call_outlined,
          keyboard: TextInputType.phone),
      EditorField(label: 'E-mail', initial: v.email, onChanged: (x) => v.email = x, icon: Icons.mail_outline,
          keyboard: TextInputType.emailAddress),
      EditorField(
        label: 'Roles',
        initial: v.roles.join(', '),
        onChanged: (x) => v.roles = x.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
        icon: Icons.badge_outlined,
        hint: 'Usher, Worship team, Media … (separate with commas)',
      ),
      EditorField(label: 'Availability', initial: v.availability, onChanged: (x) => v.availability = x,
          icon: Icons.schedule, hint: 'Sundays, first Friday …'),
      EditorField(label: 'Birthday', initial: v.birthDate, onChanged: (x) => v.birthDate = x.trim(),
          icon: Icons.cake_outlined, hint: '1990-05-14 (or -05-14 without the year)'),
      if (ministries.isNotEmpty)
        StatefulBuilder(
          builder: (c, set) => Padding(
            padding: const EdgeInsets.only(bottom: KC.s4),
            child: Wrap(spacing: KC.s2, runSpacing: KC.s2, children: [
              for (final m in ministries.where((m) => m.active || v.ministryUids.contains(m.uid)))
                FilterChip(
                  label: Text(m.name),
                  selected: v.ministryUids.contains(m.uid),
                  onSelected: (on) => set(() => v.ministryUids =
                      on ? [...v.ministryUids, m.uid] : v.ministryUids.where((u) => u != m.uid).toList()),
                ),
            ]),
          ),
        ),
      StatefulBuilder(
        builder: (c, set) => SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Active'),
          subtitle: const Text('Counted on the dashboard and offered in schedules'),
          value: v.active,
          onChanged: (x) => set(() => v.active = x),
        ),
      ),
      EditorActions(
        onSave: _save,
        onDelete: widget.existing == null
            ? null
            : () async {
                await ref.read(databaseProvider).volunteers.delete(widget.existing!.uid);
                if (context.mounted) Navigator.pop(context);
              },
      ),
    ]);
  }
}
