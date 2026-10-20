import 'package:kingdom_connect/data/models/meeting.dart';
import 'package:kingdom_connect/data/models/records.dart';

Meeting meeting(String name, DateTime date, {int people = 0, int visitors = 0, MeetingStatus status = MeetingStatus.planned}) =>
    Meeting()
      ..uid = 'm-$name'
      ..createdAt = date
      ..updatedAt = date
      ..name = name
      ..date = date
      ..status = status
      ..attendance = (MeetingAttendance()
        ..count = people
        ..visitors = visitors);

FollowUp followUp(String name, {DateTime? due, FollowUpStatus status = FollowUpStatus.open}) => FollowUp()
  ..uid = 'f-$name'
  ..createdAt = DateTime(2026)
  ..updatedAt = DateTime(2026)
  ..personName = name
  ..dueDate = due
  ..status = status;
