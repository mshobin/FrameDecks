import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/clock.dart';
import '../../../data/migration/backup_codec.dart';
import '../../../data/models/records.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../../../widgets/record_list.dart';

/// Service schedules: who serves where on a given day.
class SchedulesScreen extends ConsumerWidget {
  const SchedulesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final names = ref.watch(ministryNamesProvider);
    final today = dayOf(ref.watch(clockProvider).now());
    return RecordListPage<ServiceSchedule>(
      title: 'Schedules',
      subtitle: 'Who serves where, service by service.',
      addLabel: 'Add schedule',
      emptyIcon: Icons.calendar_month_outlined,
      emptyTitle: 'No schedules yet',
      emptyMessage: 'Plan a service and assign volunteers to each role.',
      provider: schedulesProvider,
      searchText: (s) => '${s.title} ${s.notes} ${s.assignments.map((a) => '${a.role} ${a.volunteerName}').join(' ')}',
      filters: [
        ListFilter('Upcoming', (s) => s.date == null || !dayOf(s.date!).isBefore(today)),
        ListFilter('Past', (s) => s.date != null && dayOf(s.date!).isBefore(today)),
        ListFilter('All', (_) => true),
      ],
      sort: (a, b) => (a.date ?? DateTime(9999)).compareTo(b.date ?? DateTime(9999)),
      onAdd: (c) => editSchedule(c, null),
      tile: (c, s) {
        final confirmed = s.assignments.where((a) => a.confirmed).length;
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: KC.s4, vertical: KC.s1),
          leading: const Icon(Icons.calendar_month_outlined),
          title: Text(s.displayTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text([formatDay(s.date), if (names[s.ministryUid] != null) names[s.ministryUid]!,
            '${s.assignments.length} roles'].join(' · ')),
          trailing: s.assignments.isEmpty
              ? null
              : StatusPill('$confirmed/${s.assignments.length} confirmed',
                  color: confirmed == s.assignments.length ? KC.success : KC.warning),
          onTap: () => editSchedule(c, s),
        );
      },
    );
  }
}

Future<void> editSchedule(BuildContext context, ServiceSchedule? existing) => showEditor<void>(context,
    title: existing == null ? 'New schedule' : 'Schedule', builder: (_) => _ScheduleEditor(existing));

class _ScheduleEditor extends ConsumerStatefulWidget {
  const _ScheduleEditor(this.existing);

  final ServiceSchedule? existing;

  @override
  ConsumerState<_ScheduleEditor> createState() => _ScheduleEditorState();
}

class _ScheduleEditorState extends ConsumerState<_ScheduleEditor> {
  late final ServiceSchedule s = widget.existing == null
      ? (ServiceSchedule()..date = dayOf(ref.read(clockProvider).now()))
      : (BackupCodec.scheduleFromJson(BackupCodec.scheduleToJson(widget.existing!))..id = widget.existing!.id);

  Future<void> _save() async {
    if (s.title.trim().isEmpty) return showFailure(context, 'Give the service a name, e.g. Sunday service.');
    s.assignments = s.assignments.where((a) => a.role.trim().isNotEmpty || a.volunteerName.isNotEmpty).toList();
    try {
      await ref.read(databaseProvider).schedules.save(s);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showFailure(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final volunteers = (ref.watch(volunteersProvider).value ?? const <Volunteer>[]).where((v) => v.active).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final ministries = ref.watch(ministriesProvider).value ?? const <Ministry>[];
    return StatefulBuilder(
      builder: (c, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        EditorField(label: 'Service', initial: s.title, onChanged: (v) => s.title = v, icon: Icons.event_outlined,
            autofocus: widget.existing == null, hint: 'Sunday service, Youth night …'),
        Padding(
          padding: const EdgeInsets.only(bottom: KC.s4),
          child: DateField(label: 'Date', value: s.date, onChanged: (d) => set(() => s.date = d)),
        ),
        if (ministries.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: KC.s4),
            child: DropdownButtonFormField<String?>(
              initialValue: ministries.any((m) => m.uid == s.ministryUid) ? s.ministryUid : null,
              decoration: const InputDecoration(labelText: 'Ministry', prefixIcon: Icon(Icons.church_outlined)),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('No particular ministry')),
                for (final m in ministries) DropdownMenuItem<String?>(value: m.uid, child: Text(m.name)),
              ],
              onChanged: (v) => s.ministryUid = v,
            ),
          ),
        Text('Roles', style: Theme.of(c).textTheme.titleSmall),
        const SizedBox(height: KC.s2),
        for (final a in s.assignments)
          Padding(
            padding: const EdgeInsets.only(bottom: KC.s2),
            child: Row(children: [
              Expanded(
                child: TextFormField(
                  initialValue: a.role,
                  decoration: const InputDecoration(labelText: 'Role', isDense: true),
                  onChanged: (v) => a.role = v,
                ),
              ),
              const SizedBox(width: KC.s2),
              Expanded(
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: volunteers.any((v) => v.uid == a.volunteerUid) ? a.volunteerUid : null,
                  decoration: const InputDecoration(labelText: 'Volunteer', isDense: true),
                  items: [for (final v in volunteers) DropdownMenuItem(value: v.uid, child: Text(v.name, overflow: TextOverflow.ellipsis))],
                  onChanged: (uid) => set(() {
                    a.volunteerUid = uid ?? '';
                    a.volunteerName = volunteers.where((v) => v.uid == uid).map((v) => v.name).firstOrNull ?? '';
                  }),
                ),
              ),
              Checkbox(
                value: a.confirmed,
                semanticLabel: 'Confirmed',
                onChanged: (v) => set(() => a.confirmed = v ?? false),
              ),
              IconButton(
                tooltip: 'Remove role',
                icon: const Icon(Icons.close),
                onPressed: () => set(() => s.assignments = [...s.assignments]..remove(a)),
              ),
            ]),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => set(() => s.assignments = [...s.assignments, ScheduleAssignment()]),
            icon: const Icon(Icons.add),
            label: const Text('Add a role'),
          ),
        ),
        const SizedBox(height: KC.s2),
        EditorField(label: 'Notes', initial: s.notes, onChanged: (v) => s.notes = v, lines: 2),
        EditorActions(
          onSave: _save,
          onDelete: widget.existing == null
              ? null
              : () async {
                  await ref.read(databaseProvider).schedules.delete(widget.existing!.uid);
                  if (context.mounted) Navigator.pop(context);
                },
        ),
      ]),
    );
  }
}
