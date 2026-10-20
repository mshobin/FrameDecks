import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../data/models/meeting.dart';
import '../../../data/models/records.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/brand.dart';
import '../../../widgets/common.dart';
import '../../../widgets/kpi_card.dart';
import '../application/dashboard_metrics.dart';

/// TAB 1: the Executive Dashboard. Everything here updates live as records change.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metrics = ref.watch(dashboardProvider);
    final church = ref.watch(settingsProvider).churchName;
    final now = ref.watch(clockProvider).now();
    return Scaffold(
      body: PageBody(children: [
        _Hero(church: church, now: now),
        const SizedBox(height: KC.s5),
        if (metrics == null)
          const Padding(padding: EdgeInsets.all(KC.s8), child: Center(child: CircularProgressIndicator()))
        else ...[
          _KpiGrid(metrics),
          const SizedBox(height: KC.s5),
          _Panels(metrics),
        ],
      ]),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.church, required this.now});

  final String church;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final hour = now.hour;
    final greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [KC.navyDeep, KC.navy], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        padding: EdgeInsets.all(isCompact(context) ? KC.s5 : KC.s6),
        child: Row(children: [
          BrandMark(size: isCompact(context) ? 56 : 72),
          const SizedBox(width: KC.s5),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(church.isEmpty ? 'KINGDOM CONNECT' : church.toUpperCase(),
                  style: t.labelLarge?.copyWith(color: KC.gold, letterSpacing: 1.8, fontWeight: FontWeight.w800)),
              const SizedBox(height: KC.s1),
              Text('$greeting.',
                  style: (isCompact(context) ? t.headlineSmall : t.headlineMedium)
                      ?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
              const SizedBox(height: KC.s1),
              Text(DateFormat('EEEE d MMMM yyyy').format(now), style: t.bodyMedium?.copyWith(color: Colors.white70)),
            ]),
          ),
          if (!isCompact(context))
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: KC.gold, foregroundColor: KC.navyDeep),
              onPressed: () => context.go('/meetings/new'),
              icon: const Icon(Icons.add),
              label: const Text('New meeting'),
            ),
        ]),
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid(this.m);

  final DashboardMetrics m;

  @override
  Widget build(BuildContext context) {
    final change = m.attendanceChangePercent;
    final c = Theme.of(context).colorScheme;
    final last4 = m.trend.skip(m.trend.length - 4).fold<int>(0, (a, w) => a + w.attendance);
    final cards = [
      KpiCard(
        label: 'Total meetings',
        value: '${m.totalMeetings}',
        icon: Icons.event_note,
        detail: '${m.meetingsThisMonth} this month',
        onTap: () => context.go('/meetings'),
      ),
      KpiCard(
        label: 'Active ministries',
        value: '${m.activeMinistries}',
        icon: Icons.church,
        detail: m.activeMinistries == 0 ? 'Add your first ministry' : 'Serving this season',
        onTap: () => context.go('/ministries'),
      ),
      KpiCard(
        label: 'Attendance · 4 weeks',
        value: NumberFormat.decimalPattern().format(last4),
        icon: Icons.trending_up,
        detail: change == null ? 'No earlier weeks to compare' : '${change >= 0 ? '▲' : '▼'} ${change.abs().toStringAsFixed(0)} % vs the 4 weeks before',
        detailColor: change == null ? null : (change >= 0 ? KC.success : c.error),
      ),
      KpiCard(
        label: 'Open follow-ups',
        value: '${m.openFollowUps}',
        icon: Icons.connect_without_contact,
        detail: m.overdueFollowUps == 0 ? 'Nothing overdue' : '${m.overdueFollowUps} overdue',
        detailColor: m.overdueFollowUps == 0 ? KC.success : KC.warning,
        onTap: () => context.go('/follow-ups'),
      ),
      KpiCard(
        label: 'Volunteers',
        value: '${m.volunteerCount}',
        icon: Icons.groups,
        detail: '${m.openPrayerRequests} open prayer requests',
        onTap: () => context.go('/volunteers'),
      ),
    ];
    return LayoutBuilder(builder: (context, box) {
      final perRow = box.maxWidth >= 1100 ? 5 : (box.maxWidth >= 700 ? 3 : 2);
      final w = (box.maxWidth - KC.s4 * (perRow - 1)) / perRow;
      return Wrap(
        spacing: KC.s4,
        runSpacing: KC.s4,
        children: [for (final card in cards) SizedBox(width: w, child: card)],
      );
    });
  }
}

class _Panels extends StatelessWidget {
  const _Panels(this.m);

  final DashboardMetrics m;

  @override
  Widget build(BuildContext context) {
    final chart = SectionCard(title: 'Attendance trend', trailing: const _Legend(), child: _TrendChart(m.trend));
    final upcoming = SectionCard(
      title: 'Upcoming meetings',
      trailing: TextButton(onPressed: () => context.go('/meetings'), child: const Text('All meetings')),
      child: _Upcoming(m.upcoming),
    );
    const activity = SectionCard(title: 'Recent activity', child: _Activity());
    const actions = SectionCard(title: 'Quick actions', child: _QuickActions());

    if (!isWide(context)) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        actions,
        const SizedBox(height: KC.s4),
        chart,
        const SizedBox(height: KC.s4),
        upcoming,
        const SizedBox(height: KC.s4),
        activity,
      ]);
    }
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(
        flex: 3,
        child: Column(children: [chart, const SizedBox(height: KC.s4), upcoming]),
      ),
      const SizedBox(width: KC.s4),
      const Expanded(
        flex: 2,
        child: Column(children: [actions, SizedBox(height: KC.s4), activity]),
      ),
    ]);
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    Widget dot(Color c, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(3))),
          const SizedBox(width: KC.s1),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ]);
    return Wrap(spacing: KC.s3, children: [dot(Theme.of(context).colorScheme.primary, 'Attendance'), dot(KC.gold, 'Visitors')]);
  }
}

class _TrendChart extends StatelessWidget {
  const _TrendChart(this.weeks);

  final List<WeekAttendance> weeks;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final maxY = weeks.fold<int>(0, (a, w) => w.attendance > a ? w.attendance : a);
    if (maxY == 0) {
      return const SizedBox(
        height: 200,
        child: EmptyState(
          icon: Icons.insights_outlined,
          title: 'No attendance yet',
          message: 'Record attendance in the Meeting Form and the weekly trend appears here.',
        ),
      );
    }
    final top = ((maxY * 1.15) / 10).ceil() * 10.0;      // a round top: 40, 60, 120 …
    return SizedBox(
      height: 220,
      child: BarChart(BarChartData(
        maxY: top,
        gridData: FlGridData(
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(color: c.outlineVariant.withValues(alpha: 0.4), strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, interval: top / 4)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, meta) => SideTitleWidget(
                meta: meta,
                child: Text(shortDay.format(weeks[v.toInt()].weekStart), style: Theme.of(context).textTheme.bodySmall),
              ),
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < weeks.length; i++)
            BarChartGroupData(x: i, barsSpace: 3, barRods: [
              BarChartRodData(toY: weeks[i].attendance.toDouble(), color: c.primary, width: 12, borderRadius: BorderRadius.circular(4)),
              BarChartRodData(toY: weeks[i].visitors.toDouble(), color: KC.gold, width: 6, borderRadius: BorderRadius.circular(4)),
            ]),
        ],
      )),
    );
  }
}

class _Upcoming extends ConsumerWidget {
  const _Upcoming(this.meetings);

  final List<Meeting> meetings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (meetings.isEmpty) {
      return EmptyState(
        icon: Icons.event_available_outlined,
        title: 'Nothing planned yet',
        message: 'Plan your next meeting and it appears here.',
        action: FilledButton.icon(onPressed: () => context.go('/meetings/new'), icon: const Icon(Icons.add), label: const Text('Plan a meeting')),
      );
    }
    final names = ref.watch(ministryNamesProvider);
    return Column(children: [
      for (final m in meetings)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: _DateBadge(m.date!),
          title: Text(m.displayTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text([names[m.ministryUid] ?? '', m.startTime, m.location].where((s) => s.isNotEmpty).join(' · ')),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.go('/meetings/${m.uid}'),
        ),
    ]);
  }
}

class _DateBadge extends StatelessWidget {
  const _DateBadge(this.date);

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Container(
      width: 48,
      padding: const EdgeInsets.symmetric(vertical: KC.s1),
      decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(KC.radiusSmall)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(DateFormat('MMM').format(date).toUpperCase(),
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: c.primary, letterSpacing: 1)),
        Text('${date.day}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.primary)),
      ]),
    );
  }
}

class _Activity extends ConsumerWidget {
  const _Activity();

  static const _verbs = {
    AuditAction.create: 'Added',
    AuditAction.update: 'Updated',
    AuditAction.delete: 'Deleted',
    AuditAction.restore: 'Restored',
    AuditAction.import: 'Imported',
    AuditAction.export: 'Exported',
  };
  static const _icons = {
    'meeting': Icons.event_note,
    'followUp': Icons.connect_without_contact,
    'prayerRequest': Icons.volunteer_activism,
    'volunteer': Icons.person,
    'ministry': Icons.church,
    'serviceSchedule': Icons.calendar_month,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(recentActivityProvider).value ?? const <AuditEvent>[];
    if (events.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: KC.s4),
        child: Text('Changes you make appear here.'),
      );
    }
    final ago = DateFormat('d MMM, HH:mm');
    return Column(children: [
      for (final e in events)
        ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          leading: Icon(_icons[e.recordType] ?? Icons.history, size: 20),
          title: Text(
              e.action == AuditAction.import || e.action == AuditAction.export ? e.summary : '${_verbs[e.action]} ${e.summary}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          subtitle: Text(ago.format(e.at)),
        ),
    ]);
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    Widget action(IconData icon, String label, String to) => OutlinedButton.icon(
          onPressed: () => context.go(to),
          icon: Icon(icon, size: 18),
          label: Text(label),
          style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
        );
    return LayoutBuilder(builder: (context, box) {
      final two = box.maxWidth >= 360;
      final w = two ? (box.maxWidth - KC.s2) / 2 : box.maxWidth;
      return Wrap(spacing: KC.s2, runSpacing: KC.s2, children: [
        for (final b in [
          action(Icons.add_circle_outline, 'New meeting', '/meetings/new'),
          action(Icons.person_add_alt, 'Follow-up', '/follow-ups?new=1'),
          action(Icons.volunteer_activism_outlined, 'Prayer request', '/prayer?new=1'),
          action(Icons.group_add_outlined, 'Volunteer', '/volunteers?new=1'),
          action(Icons.calendar_month_outlined, 'Schedule', '/schedules?new=1'),
          action(Icons.ios_share, 'Export & backup', '/settings'),
        ])
          SizedBox(width: w, child: b),
      ]);
    });
  }
}
