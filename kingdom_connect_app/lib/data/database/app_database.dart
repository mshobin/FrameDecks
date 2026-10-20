import 'package:flutter/foundation.dart';
import 'package:isar_community/isar.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/audit/audit_log.dart';
import '../../core/security/permissions.dart';
import '../../core/utils/clock.dart';
import '../models/entity.dart';
import '../models/meeting.dart';
import '../models/records.dart';
import '../repositories/repository.dart';
import 'record_store.dart';

/// Every repository of the app, over one storage engine.
class AppDatabase {
  AppDatabase._({
    required this.meetings,
    required this.ministries,
    required this.followUps,
    required this.prayer,
    required this.volunteers,
    required this.schedules,
    required this.audit,
    required this.isPersistent,
    this.isar,
  });

  final Repository<Meeting> meetings;
  final Repository<Ministry> ministries;
  final Repository<FollowUp> followUps;
  final Repository<PrayerRequest> prayer;
  final Repository<Volunteer> volunteers;
  final Repository<ServiceSchedule> schedules;
  final AuditLog audit;

  /// False on the web (data lasts until the tab closes) and in tests.
  final bool isPersistent;
  final Isar? isar;

  static const schemas = [
    MeetingSchema,
    MinistrySchema,
    FollowUpSchema,
    PrayerRequestSchema,
    VolunteerSchema,
    ServiceScheduleSchema,
    AuditEventSchema,
  ];

  /// The app's database: Isar in the app's support folder, or memory on the web.
  static Future<AppDatabase> open({
    PermissionPolicy policy = const OpenPolicy(),
    AppUser user = AppUser.owner,
    Clock clock = const SystemClock(),
  }) async {
    if (kIsWeb) return memory(policy: policy, user: user, clock: clock);
    final dir = await getApplicationSupportDirectory();
    final isar = Isar.getInstance('kingdom_connect') ??
        await Isar.open(schemas, directory: dir.path, name: 'kingdom_connect', inspector: false);
    return isarBacked(isar, policy: policy, user: user, clock: clock);
  }

  static AppDatabase isarBacked(
    Isar isar, {
    PermissionPolicy policy = const OpenPolicy(),
    AppUser user = AppUser.owner,
    Clock clock = const SystemClock(),
  }) {
    final audit = IsarAuditLog(isar);
    Repository<T> repo<T extends Entity>(IsarRecordStore<T> store, Permission p) =>
        Repository<T>(store: store, audit: audit, policy: policy, user: user, clock: clock, editPermission: p);
    return AppDatabase._(
      meetings: repo(
          IsarRecordStore(isar, isar.meetings,
              findAll: () => isar.meetings.where().findAll(), findByUid: isar.meetings.getByUid),
          Permission.editMeetings),
      ministries: repo(
          IsarRecordStore(isar, isar.ministrys,
              findAll: () => isar.ministrys.where().findAll(), findByUid: isar.ministrys.getByUid),
          Permission.editMeetings),
      followUps: repo(
          IsarRecordStore(isar, isar.followUps,
              findAll: () => isar.followUps.where().findAll(), findByUid: isar.followUps.getByUid),
          Permission.editPeople),
      prayer: repo(
          IsarRecordStore(isar, isar.prayerRequests,
              findAll: () => isar.prayerRequests.where().findAll(), findByUid: isar.prayerRequests.getByUid),
          Permission.editPeople),
      volunteers: repo(
          IsarRecordStore(isar, isar.volunteers,
              findAll: () => isar.volunteers.where().findAll(), findByUid: isar.volunteers.getByUid),
          Permission.editPeople),
      schedules: repo(
          IsarRecordStore(isar, isar.serviceSchedules,
              findAll: () => isar.serviceSchedules.where().findAll(), findByUid: isar.serviceSchedules.getByUid),
          Permission.editMeetings),
      audit: audit,
      isPersistent: true,
      isar: isar,
    );
  }

  /// In memory: the web build and tests.
  static AppDatabase memory({
    PermissionPolicy policy = const OpenPolicy(),
    AppUser user = AppUser.owner,
    Clock clock = const SystemClock(),
  }) {
    final audit = MemoryAuditLog();
    Repository<T> repo<T extends Entity>(Permission p) => Repository<T>(
        store: MemoryRecordStore<T>(), audit: audit, policy: policy, user: user, clock: clock, editPermission: p);
    return AppDatabase._(
      meetings: repo<Meeting>(Permission.editMeetings),
      ministries: repo<Ministry>(Permission.editMeetings),
      followUps: repo<FollowUp>(Permission.editPeople),
      prayer: repo<PrayerRequest>(Permission.editPeople),
      volunteers: repo<Volunteer>(Permission.editPeople),
      schedules: repo<ServiceSchedule>(Permission.editMeetings),
      audit: audit,
      isPersistent: false,
    );
  }
}
