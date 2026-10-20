import 'dart:convert';

import '../models/meeting.dart';
import '../models/records.dart';

/// Phase 1 of the migration (docs/project/flutter-platform-plan.md §3–4): read the Windows program's data folder
/// (%APPDATA%\Kingdom Connect) and turn it into Flutter records.
///
/// Read-only: the Windows files are never changed, so the Windows program keeps working exactly as before. The uids
/// are derived from the Windows ids, so importing again updates the same records instead of adding copies.
class WindowsImport {
  const WindowsImport({required this.meetings, required this.volunteers, required this.problems});

  final List<Meeting> meetings;
  final List<Volunteer> volunteers;

  /// Things that could not be read, in plain words (shown in the import summary).
  final List<String> problems;

  bool get isEmpty => meetings.isEmpty && volunteers.isEmpty;

  /// [savedContent] is kc-saved-content.json, [membersPrivate] kc-members-private.json (either may be null).
  static WindowsImport parse({String? savedContent, String? membersPrivate}) {
    final problems = <String>[];
    final meetings = <Meeting>[];
    final volunteers = <Volunteer>[];

    final content = _json(savedContent, 'kc-saved-content.json', problems);
    if (content != null) {
      final m = meetingFrom(content);
      if (m != null) meetings.add(m);
    }
    final members = _json(membersPrivate, 'kc-members-private.json', problems);
    if (members != null) {
      final list = members['members'];
      if (list is List) {
        for (final raw in list) {
          if (raw is Map) {
            final v = volunteerFrom(raw.cast<String, Object?>());
            if (v != null) volunteers.add(v);
          }
        }
      }
    }
    return WindowsImport(meetings: meetings, volunteers: volunteers, problems: problems);
  }

  static Map<String, Object?>? _json(String? text, String name, List<String> problems) {
    if (text == null || text.trim().isEmpty) return null;
    try {
      final d = jsonDecode(text);
      if (d is Map) return d.cast<String, Object?>();
      problems.add('$name is not in the expected format, so it was skipped.');
    } on FormatException {
      problems.add('$name could not be read (it may be damaged), so it was skipped.');
    }
    return null;
  }

  /// The Windows app's meeting (Meeting Form details, 6.9) → one Meeting.
  static Meeting? meetingFrom(Map<String, Object?> saved) {
    final raw = saved['meeting'];
    if (raw is! Map) return null;
    final m = raw.cast<String, Object?>();
    String s(String k) => (m[k] ?? '').toString().trim();
    if (s('title').isEmpty && s('date').isEmpty && s('presenter').isEmpty) return null;

    // The Frames' names are the meeting's running order: a useful agenda when the meeting has no content notes.
    final frames = <String>[];
    final scenes = saved['scenes'];
    if (scenes is List) {
      for (final sc in scenes) {
        if (sc is Map && sc['tpl'] != true && (sc['name'] ?? '').toString().trim().isNotEmpty) {
          frames.add(sc['name'].toString().trim());
        }
      }
    }
    final date = DateTime.tryParse(s('date'));
    return Meeting()
      ..uid = 'windows-meeting-${_slug(s('title'))}-${s('date')}'
      ..name = s('title').isEmpty ? 'Meeting' : s('title')
      ..date = date == null ? null : DateTime(date.year, date.month, date.day)
      ..startTime = s('time')
      ..location = s('location')
      ..speaker = s('presenter')
      ..speakerContact = s('contact')
      ..attendance = (MeetingAttendance()
        ..count = int.tryParse(s('attendees')) ?? 0
        ..notes = s('attendeeNotes'))
      ..discussion = (MeetingDiscussion()
        ..agenda = s('contentNotes').isNotEmpty ? s('contentNotes') : frames.map((f) => '• $f').join('\n')
        ..notes = [s('notes'), s('extra')].where((x) => x.isNotEmpty).join('\n\n'))
      ..status = MeetingStatus.planned
      ..source = MeetingSource.windowsImport;
  }

  /// A member of the Windows app's member list → a Volunteer.
  static Volunteer? volunteerFrom(Map<String, Object?> m) {
    String s(String k) => (m[k] ?? '').toString().trim();
    if (s('name').isEmpty) return null;
    final id = s('id').isEmpty ? _slug(s('name')) : s('id');
    return Volunteer()
      ..uid = 'windows-member-$id'
      ..name = s('name')
      ..phone = s('phone')
      ..email = s('email')
      ..country = s('country')
      ..roles = s('role').isEmpty ? [] : [s('role')]
      ..birthDate = s('birthDate')
      ..active = true;
  }

  static String _slug(String s) => s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-|-$'), '');
}
