import 'dart:convert';

import '../models/entity.dart';
import '../models/meeting.dart';
import '../models/records.dart';

/// Every record as one JSON document, and back: the backup file, and what a future sync provider uploads.
///
/// The format is versioned ([formatVersion]); readers ignore fields they do not know, so newer backups still restore
/// into older apps as far as possible.
class BackupCodec {
  const BackupCodec._();

  static const formatVersion = 1;

  static String encode({
    required List<Meeting> meetings,
    required List<Ministry> ministries,
    required List<FollowUp> followUps,
    required List<PrayerRequest> prayer,
    required List<Volunteer> volunteers,
    required List<ServiceSchedule> schedules,
    required DateTime at,
  }) =>
      const JsonEncoder.withIndent(' ').convert({
        'format': 'kingdom-connect-backup',
        'formatVersion': formatVersion,
        'createdAt': at.toIso8601String(),
        'meetings': meetings.map(meetingToJson).toList(),
        'ministries': ministries.map(ministryToJson).toList(),
        'followUps': followUps.map(followUpToJson).toList(),
        'prayer': prayer.map(prayerToJson).toList(),
        'volunteers': volunteers.map(volunteerToJson).toList(),
        'schedules': schedules.map(scheduleToJson).toList(),
      });

  static BackupContents decode(String text) {
    final d = jsonDecode(text);
    if (d is! Map || d['format'] != 'kingdom-connect-backup') {
      throw const FormatException('This file is not a Kingdom Connect backup.');
    }
    List<T> list<T>(String key, T Function(Map<String, Object?>) read) => [
          for (final r in (d[key] as List<Object?>? ?? const []))
            if (r is Map) read(r.cast<String, Object?>()),
        ];
    return BackupContents(
      meetings: list('meetings', meetingFromJson),
      ministries: list('ministries', ministryFromJson),
      followUps: list('followUps', followUpFromJson),
      prayer: list('prayer', prayerFromJson),
      volunteers: list('volunteers', volunteerFromJson),
      schedules: list('schedules', scheduleFromJson),
    );
  }

  // ---------- shared fields ----------
  static Map<String, Object?> _base(Entity e) => {
        'uid': e.uid,
        'createdAt': e.createdAt.toIso8601String(),
        'updatedAt': e.updatedAt.toIso8601String(),
        'deletedAt': e.deletedAt?.toIso8601String(),
        'version': e.version,
      };

  static T _readBase<T extends Entity>(T e, Map<String, Object?> j) {
    e
      ..uid = _s(j['uid'])
      ..createdAt = _d(j['createdAt']) ?? DateTime.now()
      ..updatedAt = _d(j['updatedAt']) ?? DateTime.now()
      ..deletedAt = _d(j['deletedAt'])
      ..version = _i(j['version'])
      ..dirty = true;
    return e;
  }

  static String _s(Object? v) => v == null ? '' : v.toString();
  static int _i(Object? v) => v is int ? v : int.tryParse(_s(v)) ?? 0;
  static bool _b(Object? v, {bool fallback = false}) => v is bool ? v : fallback;
  static DateTime? _d(Object? v) => v == null ? null : DateTime.tryParse(v.toString());
  static List<String> _l(Object? v) => v is List ? v.map(_s).toList() : <String>[];
  static T _e<T extends Enum>(List<T> values, Object? v, T fallback) =>
      values.firstWhere((x) => x.name == v, orElse: () => fallback);

  // ---------- meetings ----------
  static Map<String, Object?> meetingToJson(Meeting m) => {
        ..._base(m),
        'name': m.name,
        'ministryUid': m.ministryUid,
        'date': m.date?.toIso8601String(),
        'startTime': m.startTime,
        'location': m.location,
        'speaker': m.speaker,
        'speakerContact': m.speakerContact,
        'attendance': {
          'count': m.attendance.count,
          'visitors': m.attendance.visitors,
          'newMembers': m.attendance.newMembers,
          'notes': m.attendance.notes,
        },
        'discussion': {'agenda': m.discussion.agenda, 'notes': m.discussion.notes, 'decisions': m.discussion.decisions},
        'actionItems': [
          for (final a in m.actionItems)
            {
              'uid': a.uid,
              'title': a.title,
              'owner': a.owner,
              'dueDate': a.dueDate?.toIso8601String(),
              'status': a.status.name,
            }
        ],
        'spiritual': {
          'prayerRequests': m.spiritual.prayerRequests,
          'testimonies': m.spiritual.testimonies,
          'followUps': m.spiritual.followUps,
        },
        'status': m.status.name,
        'source': m.source.name,
      };

  static Meeting meetingFromJson(Map<String, Object?> j) {
    Map<String, Object?> sub(String k) => (j[k] is Map) ? (j[k] as Map).cast<String, Object?>() : const {};
    final at = sub('attendance'), di = sub('discussion'), sp = sub('spiritual');
    return _readBase(Meeting(), j)
      ..name = _s(j['name'])
      ..ministryUid = j['ministryUid']?.toString()
      ..date = _d(j['date'])
      ..startTime = _s(j['startTime'])
      ..location = _s(j['location'])
      ..speaker = _s(j['speaker'])
      ..speakerContact = _s(j['speakerContact'])
      ..attendance = (MeetingAttendance()
        ..count = _i(at['count'])
        ..visitors = _i(at['visitors'])
        ..newMembers = _i(at['newMembers'])
        ..notes = _s(at['notes']))
      ..discussion = (MeetingDiscussion()
        ..agenda = _s(di['agenda'])
        ..notes = _s(di['notes'])
        ..decisions = _s(di['decisions']))
      ..actionItems = [
        for (final a in (j['actionItems'] as List<Object?>? ?? const []))
          if (a is Map)
            ActionItem()
              ..uid = _s(a['uid'])
              ..title = _s(a['title'])
              ..owner = _s(a['owner'])
              ..dueDate = _d(a['dueDate'])
              ..status = _e(ActionStatus.values, a['status'], ActionStatus.open)
      ]
      ..spiritual = (SpiritualOutcomes()
        ..prayerRequests = _s(sp['prayerRequests'])
        ..testimonies = _s(sp['testimonies'])
        ..followUps = _s(sp['followUps']))
      ..status = _e(MeetingStatus.values, j['status'], MeetingStatus.planned)
      ..source = _e(MeetingSource.values, j['source'], MeetingSource.app);
  }

  // ---------- the other records ----------
  static Map<String, Object?> ministryToJson(Ministry m) => {
        ..._base(m),
        'name': m.name,
        'description': m.description,
        'colorHex': m.colorHex,
        'leader': m.leader,
        'active': m.active,
      };

  static Ministry ministryFromJson(Map<String, Object?> j) => _readBase(Ministry(), j)
    ..name = _s(j['name'])
    ..description = _s(j['description'])
    ..colorHex = _s(j['colorHex'])
    ..leader = _s(j['leader'])
    ..active = _b(j['active'], fallback: true);

  static Map<String, Object?> followUpToJson(FollowUp f) => {
        ..._base(f),
        'personName': f.personName,
        'contact': f.contact,
        'reason': f.reason,
        'meetingUid': f.meetingUid,
        'assignedTo': f.assignedTo,
        'dueDate': f.dueDate?.toIso8601String(),
        'status': f.status.name,
        'notes': f.notes,
      };

  static FollowUp followUpFromJson(Map<String, Object?> j) => _readBase(FollowUp(), j)
    ..personName = _s(j['personName'])
    ..contact = _s(j['contact'])
    ..reason = _s(j['reason'])
    ..meetingUid = j['meetingUid']?.toString()
    ..assignedTo = _s(j['assignedTo'])
    ..dueDate = _d(j['dueDate'])
    ..status = _e(FollowUpStatus.values, j['status'], FollowUpStatus.open)
    ..notes = _s(j['notes']);

  static Map<String, Object?> prayerToJson(PrayerRequest p) => {
        ..._base(p),
        'title': p.title,
        'details': p.details,
        'requestedBy': p.requestedBy,
        'isPrivate': p.isPrivate,
        'status': p.status.name,
        'meetingUid': p.meetingUid,
        'answeredAt': p.answeredAt?.toIso8601String(),
      };

  static PrayerRequest prayerFromJson(Map<String, Object?> j) => _readBase(PrayerRequest(), j)
    ..title = _s(j['title'])
    ..details = _s(j['details'])
    ..requestedBy = _s(j['requestedBy'])
    ..isPrivate = _b(j['isPrivate'])
    ..status = _e(PrayerStatus.values, j['status'], PrayerStatus.open)
    ..meetingUid = j['meetingUid']?.toString()
    ..answeredAt = _d(j['answeredAt']);

  static Map<String, Object?> volunteerToJson(Volunteer v) => {
        ..._base(v),
        'name': v.name,
        'phone': v.phone,
        'email': v.email,
        'country': v.country,
        'ministryUids': v.ministryUids,
        'roles': v.roles,
        'availability': v.availability,
        'birthDate': v.birthDate,
        'active': v.active,
      };

  static Volunteer volunteerFromJson(Map<String, Object?> j) => _readBase(Volunteer(), j)
    ..name = _s(j['name'])
    ..phone = _s(j['phone'])
    ..email = _s(j['email'])
    ..country = _s(j['country'])
    ..ministryUids = _l(j['ministryUids'])
    ..roles = _l(j['roles'])
    ..availability = _s(j['availability'])
    ..birthDate = _s(j['birthDate'])
    ..active = _b(j['active'], fallback: true);

  static Map<String, Object?> scheduleToJson(ServiceSchedule s) => {
        ..._base(s),
        'title': s.title,
        'ministryUid': s.ministryUid,
        'date': s.date?.toIso8601String(),
        'notes': s.notes,
        'assignments': [
          for (final a in s.assignments)
            {'role': a.role, 'volunteerUid': a.volunteerUid, 'volunteerName': a.volunteerName, 'confirmed': a.confirmed}
        ],
      };

  static ServiceSchedule scheduleFromJson(Map<String, Object?> j) => _readBase(ServiceSchedule(), j)
    ..title = _s(j['title'])
    ..ministryUid = j['ministryUid']?.toString()
    ..date = _d(j['date'])
    ..notes = _s(j['notes'])
    ..assignments = [
      for (final a in (j['assignments'] as List<Object?>? ?? const []))
        if (a is Map)
          ScheduleAssignment()
            ..role = _s(a['role'])
            ..volunteerUid = _s(a['volunteerUid'])
            ..volunteerName = _s(a['volunteerName'])
            ..confirmed = _b(a['confirmed'])
    ];
}

class BackupContents {
  const BackupContents({
    required this.meetings,
    required this.ministries,
    required this.followUps,
    required this.prayer,
    required this.volunteers,
    required this.schedules,
  });

  final List<Meeting> meetings;
  final List<Ministry> ministries;
  final List<FollowUp> followUps;
  final List<PrayerRequest> prayer;
  final List<Volunteer> volunteers;
  final List<ServiceSchedule> schedules;

  int get total =>
      meetings.length + ministries.length + followUps.length + prayer.length + volunteers.length + schedules.length;
}
