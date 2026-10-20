import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/clock.dart';
import '../../../data/models/meeting.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../application/meeting_sections.dart';

enum _When { upcoming, past, all }

/// Every meeting as a card: search, filter by when, open to edit.
class MeetingsScreen extends ConsumerStatefulWidget {
  const MeetingsScreen({super.key});

  @override
  ConsumerState<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends ConsumerState<MeetingsScreen> {
  var _query = '';
  var _when = _When.upcoming;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(meetingsProvider);
    final names = ref.watch(ministryNamesProvider);
    final today = dayOf(ref.watch(clockProvider).now());
    final q = _query.trim().toLowerCase();

    final meetings = (async.value ?? const <Meeting>[]).where((m) {
      final d = m.date == null ? null : dayOf(m.date!);
      final whenOk = switch (_when) {
        _When.upcoming => d == null || !d.isBefore(today),
        _When.past => d != null && d.isBefore(today),
        _When.all => true,
      };
      if (!whenOk) return false;
      if (q.isEmpty) return true;
      return [m.name, m.location, m.speaker, names[m.ministryUid] ?? '', m.discussion.notes]
          .any((s) => s.toLowerCase().contains(q));
    }).toList()
      ..sort((a, b) {
        final x = a.date ?? DateTime(9999), y = b.date ?? DateTime(9999);
        return _when == _When.past ? y.compareTo(x) : x.compareTo(y);
      });

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/meetings/new'),
        icon: const Icon(Icons.add),
        label: const Text('New meeting'),
      ),
      body: PageBody(children: [
        const PageHeader(title: 'Meetings', subtitle: 'Plan, record and review every ministry meeting.'),
        const SizedBox(height: KC.s5),
        TextField(
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search meetings, places, speakers'),
          onChanged: (v) => setState(() => _query = v),
        ),
        const SizedBox(height: KC.s3),
        Wrap(spacing: KC.s2, children: [
          for (final w in _When.values)
            ChoiceChip(
              label: Text(switch (w) { _When.upcoming => 'Upcoming', _When.past => 'Past', _When.all => 'All' }),
              selected: _when == w,
              onSelected: (_) => setState(() => _when = w),
            ),
        ]),
        const SizedBox(height: KC.s4),
        if (async.isLoading)
          const Center(child: Padding(padding: EdgeInsets.all(KC.s6), child: CircularProgressIndicator()))
        else if (meetings.isEmpty)
          EmptyState(
            icon: Icons.event_note_outlined,
            title: q.isEmpty ? 'No meetings here yet' : 'No meetings match “$_query”',
            message: q.isEmpty ? 'Select New meeting to plan one. It takes a minute.' : 'Try another word, or show All meetings.',
          )
        else
          for (final m in meetings)
            Padding(
              padding: const EdgeInsets.only(bottom: KC.s3),
              child: _MeetingCard(m, ministry: names[m.ministryUid] ?? ''),
            ),
      ]),
    );
  }
}

class _MeetingCard extends StatelessWidget {
  const _MeetingCard(this.m, {required this.ministry});

  final Meeting m;
  final String ministry;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final open = m.actionItems.where((a) => a.status != ActionStatus.done).length;
    final done = completeness(m);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.go('/meetings/${m.uid}'),
        child: Padding(
          padding: const EdgeInsets.all(KC.s4),
          child: Row(children: [
            SizedBox(
              width: 44,
              height: 44,
              child: CircularProgressIndicator(
                value: done,
                strokeWidth: 4,
                backgroundColor: c.primary.withValues(alpha: 0.12),
                semanticsLabel: 'Form ${(done * 100).round()} % complete',
              ),
            ),
            const SizedBox(width: KC.s4),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(m.displayTitle, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text([formatDay(m.date), m.startTime, ministry, m.location].where((s) => s.isNotEmpty).join(' · '),
                    style: TextStyle(color: c.onSurfaceVariant)),
                const SizedBox(height: KC.s2),
                Wrap(spacing: KC.s2, runSpacing: KC.s1, children: [
                  if (m.attendance.count > 0) StatusPill('${m.attendance.count} attended', color: KC.success),
                  if (open > 0) StatusPill('$open open action${open == 1 ? '' : 's'}', color: KC.warning),
                  if (m.source == MeetingSource.windowsImport) StatusPill('From the Windows app', color: c.secondary),
                ]),
              ]),
            ),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}
