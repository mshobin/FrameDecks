import '../../../data/models/meeting.dart';

/// The five sections of the Meeting Form, and whether each is filled in. Pure, so desktop and mobile agree.
enum MeetingSection { details, attendees, discussion, actionItems, spiritual }

extension MeetingSectionInfo on MeetingSection {
  String get title => switch (this) {
        MeetingSection.details => 'Meeting details',
        MeetingSection.attendees => 'Attendees',
        MeetingSection.discussion => 'Discussion topics',
        MeetingSection.actionItems => 'Action items',
        MeetingSection.spiritual => 'Spiritual outcomes',
      };

  String get hint => switch (this) {
        MeetingSection.details => 'Name, ministry, date, time and place.',
        MeetingSection.attendees => 'How many came, visitors and new members.',
        MeetingSection.discussion => 'The agenda, notes and what was decided.',
        MeetingSection.actionItems => 'Who does what, by when.',
        MeetingSection.spiritual => 'Prayer requests, testimonies and people to follow up.',
      };
}

/// What must be filled in before a meeting can be saved: only its name and date.
String? validateMeeting(Meeting m) {
  if (m.name.trim().isEmpty) return 'Give the meeting a name.';
  if (m.date == null) return 'Choose the meeting date.';
  for (final a in m.actionItems) {
    if (a.title.trim().isEmpty) return 'Every action item needs a short description.';
  }
  return null;
}

bool isSectionComplete(Meeting m, MeetingSection s) => switch (s) {
      MeetingSection.details => m.name.trim().isNotEmpty && m.date != null && m.location.trim().isNotEmpty,
      MeetingSection.attendees => m.attendance.count > 0,
      MeetingSection.discussion =>
        m.discussion.agenda.trim().isNotEmpty || m.discussion.notes.trim().isNotEmpty || m.discussion.decisions.trim().isNotEmpty,
      MeetingSection.actionItems => m.actionItems.isNotEmpty,
      MeetingSection.spiritual => m.spiritual.prayerRequests.trim().isNotEmpty ||
          m.spiritual.testimonies.trim().isNotEmpty ||
          m.spiritual.followUps.trim().isNotEmpty,
    };

/// 0.0 – 1.0, for the form's progress bar.
double completeness(Meeting m) =>
    MeetingSection.values.where((s) => isSectionComplete(m, s)).length / MeetingSection.values.length;

/// A deep copy, so the form edits a draft and Cancel leaves the stored meeting untouched.
Meeting copyMeeting(Meeting m) {
  final c = Meeting()
    ..id = m.id
    ..createdAt = _late(() => m.createdAt) ?? DateTime.now()
    ..updatedAt = _late(() => m.updatedAt) ?? DateTime.now()
    ..deletedAt = m.deletedAt
    ..version = m.version
    ..dirty = m.dirty
    ..name = m.name
    ..ministryUid = m.ministryUid
    ..date = m.date
    ..startTime = m.startTime
    ..location = m.location
    ..speaker = m.speaker
    ..speakerContact = m.speakerContact
    ..attendance = (MeetingAttendance()
      ..count = m.attendance.count
      ..visitors = m.attendance.visitors
      ..newMembers = m.attendance.newMembers
      ..notes = m.attendance.notes)
    ..discussion = (MeetingDiscussion()
      ..agenda = m.discussion.agenda
      ..notes = m.discussion.notes
      ..decisions = m.discussion.decisions)
    ..actionItems = [
      for (final a in m.actionItems)
        ActionItem()
          ..uid = a.uid
          ..title = a.title
          ..owner = a.owner
          ..dueDate = a.dueDate
          ..status = a.status
    ]
    ..spiritual = (SpiritualOutcomes()
      ..prayerRequests = m.spiritual.prayerRequests
      ..testimonies = m.spiritual.testimonies
      ..followUps = m.spiritual.followUps)
    ..status = m.status
    ..source = m.source;
  final uid = _late(() => m.uid);
  if (uid != null) c.uid = uid;
  return c;
}

T? _late<T>(T Function() read) {
  try {
    return read();
  } catch (_) {
    return null; // a `late` field that was never set (a new record)
  }
}
