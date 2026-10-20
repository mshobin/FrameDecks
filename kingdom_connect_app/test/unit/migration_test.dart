import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/core/utils/clock.dart';
import 'package:kingdom_connect/data/database/app_database.dart';
import 'package:kingdom_connect/data/migration/backup_codec.dart';
import 'package:kingdom_connect/data/migration/windows_import.dart';
import 'package:kingdom_connect/data/models/meeting.dart';
import 'package:kingdom_connect/data/models/records.dart';
import 'package:kingdom_connect/features/meetings/application/meeting_sections.dart';

/// The Windows app's files as 6.9 writes them (kc-saved-content.json, kc-members-private.json).
final savedContent = jsonEncode({
  'rev': 12,
  'meeting': {
    'title': 'Romans · Week 5', 'date': '2026-10-25', 'time': '19:00', 'location': 'Fellowship Hall',
    'presenter': 'Sam', 'contact': 'sam@example.com', 'attendees': '24', 'attendeeNotes': 'Two newcomers',
    'owner': 'Ann', 'contentNotes': '', 'notes': 'Bring Bibles', 'extra': 'Snacks after',
  },
  'scenes': [
    {'id': 's1', 'name': 'Welcome'},
    {'id': 't1', 'name': 'Saved template', 'tpl': true},
    {'id': 's2', 'name': 'Discussion'},
  ],
});
final membersPrivate = jsonEncode({
  'members': [
    {'id': 'a1', 'name': 'Ann Lee', 'phone': '+1 555 0100', 'email': 'ann@example.com', 'birthDate': '-05-14', 'role': 'Leader'},
    {'id': 'b2', 'name': ''},
    'not a member',
  ],
  'settings': {'groupName': ''},
});

void main() {
  group('Windows import', () {
    test('maps the meeting, using the Frames as the agenda when there are no content notes', () {
      final r = WindowsImport.parse(savedContent: savedContent, membersPrivate: membersPrivate);
      expect(r.problems, isEmpty);
      final m = r.meetings.single;
      expect(m.name, 'Romans · Week 5');
      expect(m.date, DateTime(2026, 10, 25));
      expect(m.startTime, '19:00');
      expect(m.location, 'Fellowship Hall');
      expect(m.speaker, 'Sam');
      expect(m.speakerContact, 'sam@example.com');
      expect(m.attendance.count, 24);
      expect(m.attendance.notes, 'Two newcomers');
      expect(m.discussion.agenda, '• Welcome\n• Discussion');
      expect(m.discussion.notes, 'Bring Bibles\n\nSnacks after');
      expect(m.source, MeetingSource.windowsImport);
    });

    test('maps members to volunteers and skips unusable rows', () {
      final v = WindowsImport.parse(membersPrivate: membersPrivate).volunteers.single;
      expect(v.uid, 'windows-member-a1');
      expect(v.name, 'Ann Lee');
      expect(v.roles, ['Leader']);
      expect(v.birthDate, '-05-14');
    });

    test('damaged files are reported, not fatal', () {
      final r = WindowsImport.parse(savedContent: '{not json', membersPrivate: '[1,2]');
      expect(r.isEmpty, isTrue);
      expect(r.problems, hasLength(2));
    });

    test('importing twice updates the same records', () async {
      final db = AppDatabase.memory(clock: FixedClock(DateTime(2026, 10, 21)));
      for (var i = 0; i < 2; i++) {
        final r = WindowsImport.parse(savedContent: savedContent, membersPrivate: membersPrivate);
        await db.meetings.importAll(r.meetings, summary: 'import');
        await db.volunteers.importAll(r.volunteers, summary: 'import');
      }
      expect(await db.meetings.all(), hasLength(1));
      expect(await db.volunteers.all(), hasLength(1));
    });
  });

  test('a backup restores every record exactly', () async {
    final clock = FixedClock(DateTime(2026, 10, 21));
    final db = AppDatabase.memory(clock: clock);
    final ministry = await db.ministries.save(Ministry()..name = 'Youth');
    final m = Meeting()
      ..name = 'Youth night'
      ..ministryUid = ministry.uid
      ..date = DateTime(2026, 10, 30)
      ..actionItems = [ActionItem()..uid = 'a'..title = 'Book the hall'..owner = 'Ann'..status = ActionStatus.inProgress]
      ..spiritual = (SpiritualOutcomes()..testimonies = 'Healing');
    await db.meetings.save(m);
    await db.prayer.save(PrayerRequest()..title = 'Exams'..isPrivate = true);
    await db.schedules.save(ServiceSchedule()
      ..title = 'Sunday'
      ..assignments = [ScheduleAssignment()..role = 'Usher'..volunteerName = 'Ann'..confirmed = true]);

    final json = BackupCodec.encode(
      meetings: await db.meetings.all(),
      ministries: await db.ministries.all(),
      followUps: await db.followUps.all(),
      prayer: await db.prayer.all(),
      volunteers: await db.volunteers.all(),
      schedules: await db.schedules.all(),
      at: clock.now(),
    );
    final back = BackupCodec.decode(json);
    expect(back.total, 4);
    final m2 = back.meetings.single;
    expect(m2.uid, m.uid);
    expect(m2.ministryUid, ministry.uid);
    expect(m2.actionItems.single.status, ActionStatus.inProgress);
    expect(m2.spiritual.testimonies, 'Healing');
    expect(back.prayer.single.isPrivate, isTrue);
    expect(back.schedules.single.assignments.single.confirmed, isTrue);
    expect(BackupCodec.encode(
      meetings: back.meetings, ministries: back.ministries, followUps: back.followUps, prayer: back.prayer,
      volunteers: back.volunteers, schedules: back.schedules, at: clock.now(),
    ), json);
    expect(() => BackupCodec.decode('{"format":"other"}'), throwsFormatException);
  });

  test('meeting form rules: what is required, and section completeness', () {
    final m = Meeting();
    expect(validateMeeting(m), 'Give the meeting a name.');
    m.name = 'Leaders';
    expect(validateMeeting(m), 'Choose the meeting date.');
    m.date = DateTime(2026, 10, 25);
    expect(validateMeeting(m), isNull);
    m.actionItems = [ActionItem()];
    expect(validateMeeting(m), isNotNull);
    m.actionItems.single.title = 'Call Ann';
    expect(completeness(m), 1 / 5);  // action items only; details need a location
    m.location = 'Hall';
    m.attendance.count = 12;
    expect(isSectionComplete(m, MeetingSection.details), isTrue);
    expect(completeness(m), 3 / 5);
    final copy = copyMeeting(m)..name = 'Changed';
    copy.actionItems.single.title = 'Changed';
    expect(m.name, 'Leaders');
    expect(m.actionItems.single.title, 'Call Ann');
  });
}
