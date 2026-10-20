import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/migration/backup_codec.dart';
import '../../../data/models/records.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../../../widgets/record_list.dart';

class PrayerScreen extends ConsumerWidget {
  const PrayerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => RecordListPage<PrayerRequest>(
        title: 'Prayer requests',
        subtitle: 'Carry each other’s burdens, and remember what God has answered.',
        addLabel: 'Add request',
        emptyIcon: Icons.volunteer_activism_outlined,
        emptyTitle: 'No prayer requests',
        emptyMessage: 'Add requests from meetings or as they come. Private ones stay out of exports.',
        provider: prayerProvider,
        searchText: (p) => '${p.title} ${p.details} ${p.requestedBy}',
        filters: [
          ListFilter('Open', (p) => p.status == PrayerStatus.open),
          ListFilter('Answered', (p) => p.status == PrayerStatus.answered),
          ListFilter('All', (p) => p.status != PrayerStatus.archived),
          ListFilter('Archived', (p) => p.status == PrayerStatus.archived),
        ],
        sort: (a, b) => b.createdAt.compareTo(a.createdAt),
        onAdd: (c) => editPrayer(c, null),
        tile: (c, p) => ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: KC.s4, vertical: KC.s1),
          leading: Icon(p.status == PrayerStatus.answered ? Icons.auto_awesome : Icons.volunteer_activism_outlined,
              color: p.status == PrayerStatus.answered ? KC.gold : null),
          title: Row(children: [
            Flexible(child: Text(p.displayTitle, style: const TextStyle(fontWeight: FontWeight.w600))),
            if (p.isPrivate) const Padding(padding: EdgeInsets.only(left: KC.s2), child: Icon(Icons.lock_outline, size: 16)),
          ]),
          subtitle: Text([if (p.requestedBy.isNotEmpty) p.requestedBy, shortDay.format(p.createdAt), if (p.details.isNotEmpty) p.details]
              .join(' · '), maxLines: 2, overflow: TextOverflow.ellipsis),
          trailing: p.status == PrayerStatus.answered ? const StatusPill('Answered', color: KC.success) : null,
          onTap: () => editPrayer(c, p),
        ),
      );
}

Future<void> editPrayer(BuildContext context, PrayerRequest? existing) =>
    showEditor<void>(context, title: existing == null ? 'New prayer request' : 'Prayer request', builder: (_) => _PrayerEditor(existing));

class _PrayerEditor extends ConsumerStatefulWidget {
  const _PrayerEditor(this.existing);

  final PrayerRequest? existing;

  @override
  ConsumerState<_PrayerEditor> createState() => _PrayerEditorState();
}

class _PrayerEditorState extends ConsumerState<_PrayerEditor> {
  late final PrayerRequest p = widget.existing == null
      ? PrayerRequest()
      : (BackupCodec.prayerFromJson(BackupCodec.prayerToJson(widget.existing!))..id = widget.existing!.id);

  Future<void> _save() async {
    if (p.title.trim().isEmpty) return showFailure(context, 'Write the request in a few words.');
    if (p.status == PrayerStatus.answered) p.answeredAt ??= DateTime.now();
    try {
      await ref.read(databaseProvider).prayer.save(p);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showFailure(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        EditorField(label: 'Request', initial: p.title, onChanged: (v) => p.title = v, autofocus: widget.existing == null,
            icon: Icons.volunteer_activism_outlined),
        EditorField(label: 'Details', initial: p.details, onChanged: (v) => p.details = v, lines: 3),
        EditorField(label: 'Requested by', initial: p.requestedBy, onChanged: (v) => p.requestedBy = v, icon: Icons.person_outline),
        StatefulBuilder(
          builder: (c, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Private'),
              subtitle: const Text('Left out of exports and printouts'),
              value: p.isPrivate,
              onChanged: (v) => set(() => p.isPrivate = v),
            ),
            const SizedBox(height: KC.s2),
            SegmentedButton<PrayerStatus>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: PrayerStatus.open, label: Text('Praying')),
                ButtonSegment(value: PrayerStatus.answered, label: Text('Answered')),
                ButtonSegment(value: PrayerStatus.archived, label: Text('Archived')),
              ],
              selected: {p.status},
              onSelectionChanged: (s) => set(() => p.status = s.first),
            ),
            const SizedBox(height: KC.s4),
          ]),
        ),
        EditorActions(
          onSave: _save,
          onDelete: widget.existing == null
              ? null
              : () async {
                  await ref.read(databaseProvider).prayer.delete(widget.existing!.uid);
                  if (context.mounted) Navigator.pop(context);
                },
        ),
      ]);
}
