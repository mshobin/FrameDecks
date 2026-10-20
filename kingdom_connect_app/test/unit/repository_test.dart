import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/core/errors/app_failure.dart';
import 'package:kingdom_connect/core/security/permissions.dart';
import 'package:kingdom_connect/core/utils/clock.dart';
import 'package:kingdom_connect/data/database/app_database.dart';
import 'package:kingdom_connect/data/models/meeting.dart';
import 'package:kingdom_connect/data/models/records.dart';

void main() {
  late FixedClock clock;
  late AppDatabase db;

  setUp(() {
    clock = FixedClock(DateTime(2026, 10, 21, 9));
    db = AppDatabase.memory(clock: clock);
  });

  test('save creates with a uid, stamps sync fields and records the change', () async {
    final m = await db.meetings.save(Meeting()..name = 'Leaders');
    expect(m.uid, isNotEmpty);
    expect(m.version, 1);
    expect(m.dirty, isTrue);
    expect(m.createdAt, clock.value);

    clock.value = DateTime(2026, 10, 21, 10);
    m.name = 'Leaders meeting';
    await db.meetings.save(m);
    final stored = await db.meetings.byUid(m.uid);
    expect(stored!.name, 'Leaders meeting');
    expect(stored.version, 2);
    expect(stored.updatedAt, clock.value);
    expect(stored.createdAt, DateTime(2026, 10, 21, 9));

    final log = await db.audit.recent(10);
    expect(log.map((e) => e.action), [AuditAction.update, AuditAction.create]);
    expect(log.first.recordType, 'meeting');
    expect(log.first.summary, 'Leaders meeting');
  });

  test('delete hides the record and keeps it for restore; the live list updates', () async {
    final m = await db.meetings.save(Meeting()..name = 'Prayer night');
    final lists = <int>[];
    final sub = db.meetings.watchAll().listen((l) => lists.add(l.length));
    await Future<void>.delayed(Duration.zero);
    await db.meetings.delete(m.uid);
    await Future<void>.delayed(Duration.zero);
    expect(await db.meetings.byUid(m.uid), isNull);
    expect(await db.meetings.all(), isEmpty);
    await db.meetings.restore(m.uid);
    await Future<void>.delayed(Duration.zero);
    expect((await db.meetings.byUid(m.uid))!.name, 'Prayer night');
    expect(lists, [1, 0, 1]);
    await sub.cancel();
  });

  test('import keeps uids, so importing twice updates instead of duplicating', () async {
    Volunteer v() => Volunteer()
      ..uid = 'windows-member-7'
      ..name = 'Ann';
    expect(await db.volunteers.importAll([v()], summary: 'first'), 1);
    expect(await db.volunteers.importAll([v()..name = 'Ann Lee'], summary: 'again'), 1);
    final all = await db.volunteers.all();
    expect(all, hasLength(1));
    expect(all.single.name, 'Ann Lee');
    expect(all.single.version, 2);
  });

  test('permissions are checked on every write (enterprise policy)', () async {
    final viewer = AppDatabase.memory(
      clock: clock,
      policy: const RolePolicy(),
      user: const AppUser(id: 'v', name: 'Viewer', role: Role.viewer),
    );
    expect(() => viewer.meetings.save(Meeting()..name = 'x'), throwsA(isA<PermissionDenied>()));
    final leader = AppDatabase.memory(
      clock: clock,
      policy: const RolePolicy(),
      user: const AppUser(id: 'l', name: 'Leader', role: Role.leader),
    );
    final m = await leader.meetings.save(Meeting()..name = 'ok');
    expect(() => leader.meetings.delete(m.uid), throwsA(isA<PermissionDenied>()));
  });

  test('the open policy allows everything', () {
    for (final p in Permission.values) {
      expect(const OpenPolicy().can(AppUser.owner, p), isTrue);
    }
    expect(const RolePolicy().can(const AppUser(id: 'x', name: 'x', role: Role.viewer), Permission.exportData), isFalse);
  });
}
