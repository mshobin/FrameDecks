import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/clock.dart';
import '../../../data/migration/backup_codec.dart';
import '../../../data/models/records.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../../../widgets/record_list.dart';

/// People to contact after a meeting, until they are reached.
class FollowUpsScreen extends ConsumerWidget {
  const FollowUpsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = dayOf(ref.watch(clockProvider).now());
    bool overdue(FollowUp f) => f.status != FollowUpStatus.done && f.dueDate != null && dayOf(f.dueDate!).isBefore(today);
    return RecordListPage<FollowUp>(
      title: 'Follow-ups',
      subtitle: 'Visitors and people to contact, until someone has reached them.',
      addLabel: 'Add follow-up',
      emptyIcon: Icons.connect_without_contact_outlined,
      emptyTitle: 'No follow-ups',
      emptyMessage: 'Add a visitor or anyone who needs a call, and who will make it.',
      provider: followUpsProvider,
      searchText: (f) => '${f.personName} ${f.reason} ${f.assignedTo} ${f.notes}',
      filters: [
        ListFilter('Open', (f) => f.status != FollowUpStatus.done),
        ListFilter('Overdue', overdue),
        ListFilter('Done', (f) => f.status == FollowUpStatus.done),
        ListFilter('All', (_) => true),
      ],
      sort: (a, b) => (a.dueDate ?? DateTime(9999)).compareTo(b.dueDate ?? DateTime(9999)),
      onAdd: (c) => editFollowUp(c, null),
      tile: (c, f) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: KC.s4, vertical: KC.s1),
        leading: CircleAvatar(child: Text(f.personName.isEmpty ? '?' : f.personName[0].toUpperCase())),
        title: Text(f.displayTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text([
          if (f.reason.isNotEmpty) f.reason,
          if (f.assignedTo.isNotEmpty) 'with ${f.assignedTo}',
          if (f.dueDate != null) 'due ${shortDay.format(f.dueDate!)}',
        ].join(' · ')),
        trailing: overdue(f)
            ? const StatusPill('Overdue', color: KC.warning)
            : StatusPill(_label(f.status), color: f.status == FollowUpStatus.done ? KC.success : Theme.of(c).colorScheme.primary),
        onTap: () => editFollowUp(c, f),
      ),
    );
  }
}

String _label(FollowUpStatus s) => switch (s) {
      FollowUpStatus.open => 'Open',
      FollowUpStatus.contacted => 'Contacted',
      FollowUpStatus.done => 'Done',
    };

Future<void> editFollowUp(BuildContext context, FollowUp? existing) => showEditor<void>(
      context,
      title: existing == null ? 'New follow-up' : 'Follow-up',
      builder: (_) => _FollowUpEditor(existing),
    );

class _FollowUpEditor extends ConsumerStatefulWidget {
  const _FollowUpEditor(this.existing);

  final FollowUp? existing;

  @override
  ConsumerState<_FollowUpEditor> createState() => _FollowUpEditorState();
}

class _FollowUpEditorState extends ConsumerState<_FollowUpEditor> {
  late final FollowUp f = widget.existing == null
      ? (FollowUp()..dueDate = dayOf(ref.read(clockProvider).now()).add(const Duration(days: 3)))
      : (BackupCodec.followUpFromJson(BackupCodec.followUpToJson(widget.existing!))..id = widget.existing!.id);

  Future<void> _save() async {
    if (f.personName.trim().isEmpty) return showFailure(context, 'Add the person’s name.');
    try {
      await ref.read(databaseProvider).followUps.save(f);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showFailure(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        EditorField(label: 'Name', initial: f.personName, onChanged: (v) => f.personName = v, icon: Icons.person_outline,
            autofocus: widget.existing == null),
        EditorField(label: 'Phone or e-mail', initial: f.contact, onChanged: (v) => f.contact = v, icon: Icons.call_outlined),
        EditorField(label: 'Why', initial: f.reason, onChanged: (v) => f.reason = v, hint: 'First visit, asked for prayer …'),
        EditorField(label: 'Who will contact them', initial: f.assignedTo, onChanged: (v) => f.assignedTo = v,
            icon: Icons.assignment_ind_outlined),
        Padding(
          padding: const EdgeInsets.only(bottom: KC.s4),
          child: StatefulBuilder(
              builder: (c, set) => DateField(label: 'Contact by', value: f.dueDate, onChanged: (d) => set(() => f.dueDate = d))),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: KC.s4),
          child: StatefulBuilder(
            builder: (c, set) => SegmentedButton<FollowUpStatus>(
              showSelectedIcon: false,
              segments: [for (final s in FollowUpStatus.values) ButtonSegment(value: s, label: Text(_label(s)))],
              selected: {f.status},
              onSelectionChanged: (s) => set(() => f.status = s.first),
            ),
          ),
        ),
        EditorField(label: 'Notes', initial: f.notes, onChanged: (v) => f.notes = v, lines: 3),
        EditorActions(
          onSave: _save,
          onDelete: widget.existing == null
              ? null
              : () async {
                  await ref.read(databaseProvider).followUps.delete(widget.existing!.uid);
                  if (context.mounted) Navigator.pop(context);
                },
        ),
      ]);
}
