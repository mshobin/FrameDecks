import 'package:isar_community/isar.dart';

import 'entity.dart';

part 'meeting.g.dart';

enum MeetingStatus { draft, planned, held }

enum MeetingSource { app, windowsImport, workbook }

enum ActionStatus { open, inProgress, done }

/// TAB 2 Meeting Form: one meeting, with everything recorded about it.
@collection
class Meeting extends Entity {
  // ---- Meeting details
  String name = '';

  @Index()
  String? ministryUid;

  @Index()
  DateTime? date;

  /// "19:00" (24-hour, as typed or picked); text so a meeting can say "after the service".
  String startTime = '';
  String location = '';
  String speaker = '';
  String speakerContact = '';

  // ---- Attendees
  MeetingAttendance attendance = MeetingAttendance();

  // ---- Discussion topics
  MeetingDiscussion discussion = MeetingDiscussion();

  // ---- Action items
  List<ActionItem> actionItems = [];

  // ---- Spiritual outcomes
  SpiritualOutcomes spiritual = SpiritualOutcomes();

  @Index()
  @enumerated
  MeetingStatus status = MeetingStatus.planned;

  @enumerated
  MeetingSource source = MeetingSource.app;

  @ignore
  @override
  String get displayTitle => name.isEmpty ? 'Untitled meeting' : name;

  @ignore
  @override
  String get recordType => 'meeting';
}

@embedded
class MeetingAttendance {
  int count = 0;
  int visitors = 0;
  int newMembers = 0;
  String notes = '';
}

@embedded
class MeetingDiscussion {
  String agenda = '';
  String notes = '';
  String decisions = '';
}

@embedded
class ActionItem {
  String uid = '';
  String title = '';
  String owner = '';
  DateTime? dueDate;

  @enumerated
  ActionStatus status = ActionStatus.open;
}

@embedded
class SpiritualOutcomes {
  String prayerRequests = '';
  String testimonies = '';
  String followUps = '';
}
