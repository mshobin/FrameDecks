import 'dart:convert';
import 'dart:ffi';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar_community/isar.dart';
import 'package:kingdom_connect/core/utils/clock.dart';
import 'package:kingdom_connect/data/database/app_database.dart';
import 'package:kingdom_connect/data/models/meeting.dart';
import 'package:kingdom_connect/data/models/records.dart';

/// The same repository behaviour on the real Isar database. The native library comes from isar_community_flutter_libs
/// (the same file the app ships), so the test needs no download.
String _isarLibrary() {
  final config = jsonDecode(File('.dart_tool/package_config.json').readAsStringSync()) as Map<String, Object?>;
  final pkg = (config['packages'] as List<Object?>).cast<Map<String, Object?>>()
      .firstWhere((p) => p['name'] == 'isar_community_flutter_libs');
  final root = Uri.parse('${pkg['rootUri']}/').toFilePath();
  final dir = Directory(root).isAbsolute ? root : '${Directory('.dart_tool').absolute.path}/$root';
  final file = Platform.isWindows ? 'windows/libisar.dll' : Platform.isMacOS ? 'macos/libisar.dylib' : 'linux/libisar.so';
  return File('$dir$file').absolute.path;
}

void main() {
  late Directory dir;
  late Isar isar;
  late AppDatabase db;

  setUpAll(() async {
    await Isar.initializeIsarCore(libraries: {Abi.current(): _isarLibrary()});
  });

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('kc-isar-');
    isar = await Isar.open(AppDatabase.schemas, directory: dir.path, name: 'test_${dir.path.hashCode}');
    db = AppDatabase.isarBacked(isar, clock: FixedClock(DateTime(2026, 10, 21)));
  });

  tearDown(() async {
    await isar.close(deleteFromDisk: true);
    await dir.delete(recursive: true);
  });

  test('save, find by uid, embedded objects, soft delete and live lists', () async {
    final m = await db.meetings.save(Meeting()
      ..name = 'Leaders'
      ..attendance = (MeetingAttendance()..count = 9)
      ..actionItems = [ActionItem()..uid = 'a'..title = 'Call Ann']);
    final again = await db.meetings.byUid(m.uid);
    expect(again!.name, 'Leaders');
    expect(again.attendance.count, 9);
    expect(again.actionItems.single.title, 'Call Ann');

    final seen = <int>[];
    final sub = db.meetings.watchAll().listen((l) => seen.add(l.length));
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await db.meetings.delete(m.uid);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await sub.cancel();
    expect(seen.first, 1);
    expect(seen.last, 0);
    expect(await db.meetings.byUid(m.uid), isNull);
  });

  test('import replaces by uid (unique index) and the audit log reads back newest first', () async {
    Volunteer v(String name) => Volunteer()
      ..uid = 'windows-member-1'
      ..name = name;
    await db.volunteers.importAll([v('Ann')], summary: 'first');
    await db.volunteers.importAll([v('Ann Lee')], summary: 'second');
    expect((await db.volunteers.all()).map((x) => x.name), ['Ann Lee']);
    final log = await db.audit.recent(5);
    expect(log, hasLength(2));
    expect(log.every((e) => e.action == AuditAction.import), isTrue);
  });
}
