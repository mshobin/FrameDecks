import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/data/models/meeting.dart';
import 'package:kingdom_connect/data/models/records.dart';
import 'package:kingdom_connect/features/dashboard/application/dashboard_metrics.dart';

import '../helpers.dart';

void main() {
  // Wednesday 21 October 2026: this week starts Monday 19 October.
  final now = DateTime(2026, 10, 21, 10);

  DashboardMetrics compute({
    List<Meeting> meetings = const [],
    List<Ministry> ministries = const [],
    List<FollowUp> followUps = const [],
    List<Volunteer> volunteers = const [],
    List<PrayerRequest> prayer = const [],
  }) =>
      DashboardMetrics.compute(
          meetings: meetings, ministries: ministries, followUps: followUps, volunteers: volunteers, prayer: prayer, now: now);

  test('empty data gives zeros and an empty, eight-week trend', () {
    final m = compute();
    expect(m.totalMeetings, 0);
    expect(m.trend, hasLength(8));
    expect(m.trend.every((w) => w.attendance == 0), isTrue);
    expect(m.attendanceChangePercent, isNull);
    expect(m.upcoming, isEmpty);
    expect(m.lastMeeting, isNull);
  });

  test('weekly attendance, change against the earlier weeks, upcoming and last meeting', () {
    final meetings = [
      meeting('old', DateTime(2026, 9, 2), people: 40),            // week 5 of 8 ago: first half
      meeting('a', DateTime(2026, 10, 12), people: 50, visitors: 4), // last week
      meeting('b', DateTime(2026, 10, 19), people: 30),              // this week, before today
      meeting('today', DateTime(2026, 10, 21), people: 10),          // today counts in this week
      meeting('next', DateTime(2026, 10, 25)),                       // upcoming, not counted yet
      meeting('later', DateTime(2026, 11, 3)),
    ];
    final m = compute(meetings: meetings);
    expect(m.totalMeetings, 6);
    expect(m.meetingsThisMonth, 4);
    expect(m.trend.last.weekStart, DateTime(2026, 10, 19));
    expect(m.trend.last.attendance, 40);
    expect(m.trend[6].attendance, 50);
    expect(m.trend[6].visitors, 4);
    expect(m.attendanceChangePercent, closeTo((90 - 40) * 100 / 40, 0.001));
    expect(m.upcoming.map((x) => x.name), ['today', 'next', 'later']);
    expect(m.lastMeeting!.name, 'b');
  });

  test('follow-ups: open and overdue; ministries and volunteers count only active ones', () {
    final m = compute(
      followUps: [
        followUp('late', due: DateTime(2026, 10, 20)),
        followUp('due today', due: DateTime(2026, 10, 21)),
        followUp('done', due: DateTime(2026, 10, 1), status: FollowUpStatus.done),
      ],
      ministries: [Ministry()..active = true, Ministry()..active = false],
      volunteers: [Volunteer()..active = true, Volunteer()..active = true, Volunteer()..active = false],
      prayer: [PrayerRequest(), PrayerRequest()..status = PrayerStatus.answered],
    );
    expect(m.openFollowUps, 2);
    expect(m.overdueFollowUps, 1);
    expect(m.activeMinistries, 1);
    expect(m.volunteerCount, 2);
    expect(m.openPrayerRequests, 1);
  });
}
