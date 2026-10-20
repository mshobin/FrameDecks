import '../../../core/utils/clock.dart';
import '../../../data/models/meeting.dart';
import '../../../data/models/records.dart';

/// One week's attendance (the Monday it starts, and the people counted in meetings that week).
class WeekAttendance {
  const WeekAttendance(this.weekStart, this.attendance, this.visitors);

  final DateTime weekStart;
  final int attendance;
  final int visitors;
}

/// Everything TAB 1 shows, worked out from the records. Pure: no Flutter, no storage, fully unit-tested.
class DashboardMetrics {
  const DashboardMetrics({
    required this.totalMeetings,
    required this.meetingsThisMonth,
    required this.activeMinistries,
    required this.openFollowUps,
    required this.overdueFollowUps,
    required this.volunteerCount,
    required this.openPrayerRequests,
    required this.trend,
    required this.attendanceChangePercent,
    required this.upcoming,
    required this.lastMeeting,
  });

  final int totalMeetings;
  final int meetingsThisMonth;
  final int activeMinistries;
  final int openFollowUps;
  final int overdueFollowUps;
  final int volunteerCount;
  final int openPrayerRequests;

  /// Oldest week first; always [weeks] entries (empty weeks count 0).
  final List<WeekAttendance> trend;

  /// Average attendance of the last half of [trend] against the first half; null without data.
  final double? attendanceChangePercent;

  /// Meetings from today on, soonest first.
  final List<Meeting> upcoming;
  final Meeting? lastMeeting;

  static DashboardMetrics compute({
    required List<Meeting> meetings,
    required List<Ministry> ministries,
    required List<FollowUp> followUps,
    required List<Volunteer> volunteers,
    required List<PrayerRequest> prayer,
    required DateTime now,
    int weeks = 8,
    int upcomingLimit = 5,
  }) {
    final today = dayOf(now);
    final dated = meetings.where((m) => m.date != null).toList()..sort((a, b) => a.date!.compareTo(b.date!));
    final upcoming = dated.where((m) => !dayOf(m.date!).isBefore(today)).take(upcomingLimit).toList();
    final past = dated.where((m) => dayOf(m.date!).isBefore(today) || m.status == MeetingStatus.held).toList();

    // Attendance per week (weeks start on Monday), for the last [weeks] weeks including this one.
    final thisWeek = today.subtract(Duration(days: today.weekday - 1));
    final trend = <WeekAttendance>[];
    for (var i = weeks - 1; i >= 0; i--) {
      final start = DateTime(thisWeek.year, thisWeek.month, thisWeek.day - 7 * i);
      final end = DateTime(start.year, start.month, start.day + 7);
      var people = 0, visitors = 0;
      for (final m in dated) {
        final d = dayOf(m.date!);
        if (!d.isBefore(start) && d.isBefore(end) && !d.isAfter(today)) {
          people += m.attendance.count;
          visitors += m.attendance.visitors;
        }
      }
      trend.add(WeekAttendance(start, people, visitors));
    }
    double? change;
    final half = weeks ~/ 2;
    final before = trend.take(half).map((w) => w.attendance).fold<int>(0, (a, b) => a + b);
    final after = trend.skip(half).map((w) => w.attendance).fold<int>(0, (a, b) => a + b);
    if (before > 0) change = (after - before) * 100 / before;

    return DashboardMetrics(
      totalMeetings: meetings.length,
      meetingsThisMonth: dated.where((m) => m.date!.year == today.year && m.date!.month == today.month).length,
      activeMinistries: ministries.where((m) => m.active).length,
      openFollowUps: followUps.where((f) => f.status != FollowUpStatus.done).length,
      overdueFollowUps: followUps
          .where((f) => f.status != FollowUpStatus.done && f.dueDate != null && dayOf(f.dueDate!).isBefore(today))
          .length,
      volunteerCount: volunteers.where((v) => v.active).length,
      openPrayerRequests: prayer.where((p) => p.status == PrayerStatus.open).length,
      trend: trend,
      attendanceChangePercent: change,
      upcoming: upcoming,
      lastMeeting: past.isEmpty ? null : past.last,
    );
  }
}
