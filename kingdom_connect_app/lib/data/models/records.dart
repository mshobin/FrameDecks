import 'package:isar_community/isar.dart';

import 'entity.dart';

part 'records.g.dart';

/// A ministry (Youth, Worship, Men's Fellowship …): meetings, volunteers and schedules belong to one.
@collection
class Ministry extends Entity {
  @Index()
  String name = '';
  String description = '';

  /// "#1F3A6D"; empty uses the app's accent.
  String colorHex = '';
  String leader = '';

  @Index()
  bool active = true;

  @ignore
  @override
  String get displayTitle => name.isEmpty ? 'Untitled ministry' : name;

  @ignore
  @override
  String get recordType => 'ministry';
}

enum FollowUpStatus { open, contacted, done }

/// Someone to contact after a meeting (a visitor, someone who asked for prayer …).
@collection
class FollowUp extends Entity {
  String personName = '';
  String contact = '';
  String reason = '';

  @Index()
  String? meetingUid;
  String assignedTo = '';

  @Index()
  DateTime? dueDate;

  @Index()
  @enumerated
  FollowUpStatus status = FollowUpStatus.open;
  String notes = '';

  @ignore
  @override
  String get displayTitle => personName.isEmpty ? 'Follow-up' : personName;

  @ignore
  @override
  String get recordType => 'followUp';
}

enum PrayerStatus { open, answered, archived }

@collection
class PrayerRequest extends Entity {
  String title = '';
  String details = '';
  String requestedBy = '';

  /// Private requests are left out of exports and printouts unless the person exporting chooses otherwise.
  bool isPrivate = false;

  @Index()
  @enumerated
  PrayerStatus status = PrayerStatus.open;

  @Index()
  String? meetingUid;
  DateTime? answeredAt;

  @ignore
  @override
  String get displayTitle => title.isEmpty ? 'Prayer request' : title;

  @ignore
  @override
  String get recordType => 'prayerRequest';
}

/// A volunteer or member (members imported from the Windows app become volunteers).
@collection
class Volunteer extends Entity {
  @Index()
  String name = '';
  String phone = '';
  String email = '';
  String country = '';
  List<String> ministryUids = [];
  List<String> roles = [];
  String availability = '';

  /// "1990-05-14", or "-05-14" when the year is unknown (the Windows app's format).
  String birthDate = '';

  @Index()
  bool active = true;

  @ignore
  @override
  String get displayTitle => name.isEmpty ? 'Volunteer' : name;

  @ignore
  @override
  String get recordType => 'volunteer';
}

/// Who serves where on a given day (worship team, ushers, media …).
@collection
class ServiceSchedule extends Entity {
  String title = '';

  @Index()
  String? ministryUid;

  @Index()
  DateTime? date;
  List<ScheduleAssignment> assignments = [];
  String notes = '';

  @ignore
  @override
  String get displayTitle => title.isEmpty ? 'Service' : title;

  @ignore
  @override
  String get recordType => 'serviceSchedule';
}

@embedded
class ScheduleAssignment {
  String role = '';
  String volunteerUid = '';
  String volunteerName = '';
  bool confirmed = false;
}

enum AuditAction { create, update, delete, restore, import, export }

/// Who changed what, and when. Local only. Also the source of the dashboard's Recent activity.
@collection
class AuditEvent {
  Id id = Isar.autoIncrement;

  @Index()
  late DateTime at;
  String actor = '';

  @enumerated
  AuditAction action = AuditAction.update;

  @Index()
  String recordType = '';
  String recordUid = '';
  String summary = '';
}
