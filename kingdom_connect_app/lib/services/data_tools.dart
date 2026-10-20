import 'dart:io';

import 'package:intl/intl.dart';

import '../core/errors/app_failure.dart';
import '../core/security/permissions.dart';
import '../core/utils/clock.dart';
import '../data/database/app_database.dart';
import '../data/migration/backup_codec.dart';
import '../data/migration/windows_import.dart';
import '../data/models/records.dart';
import 'storage/storage_provider.dart';

/// Backups, restore and the import from the Windows program, over the repositories (so every step is permission-checked
/// and audited).
class DataTools {
  DataTools({required this.db, required this.clock, required this.user, required this.policy});

  final AppDatabase db;
  final Clock clock;
  final AppUser user;
  final PermissionPolicy policy;

  /// Everything, as the backup JSON.
  Future<String> backupJson() async {
    if (!policy.can(user, Permission.exportData)) throw const PermissionDenied('export data');
    final json = BackupCodec.encode(
      meetings: await db.meetings.all(),
      ministries: await db.ministries.all(),
      followUps: await db.followUps.all(),
      prayer: await db.prayer.all(),
      volunteers: await db.volunteers.all(),
      schedules: await db.schedules.all(),
      at: clock.now(),
    );
    await db.audit.record(AuditEvent()
      ..at = clock.now()
      ..actor = user.name
      ..action = AuditAction.export
      ..recordType = 'backup'
      ..summary = 'Backup of all records');
    return json;
  }

  String backupFileName() => 'kingdom-connect-backup-${DateFormat('yyyy-MM-dd-HHmm').format(clock.now())}.json';

  /// Saves a backup with [provider] and returns where it went.
  Future<String> backupTo(StorageProvider provider) async {
    if (!provider.isAvailable) throw AppFailure(provider.unavailableReason ?? '${provider.displayName} is not available.');
    return provider.saveSnapshot(backupFileName(), await backupJson());
  }

  /// Restores a backup. Records are matched by uid: existing ones are updated, nothing is deleted.
  Future<int> restore(String json) async {
    final BackupContents c;
    try {
      c = BackupCodec.decode(json);
    } on FormatException catch (e) {
      throw AppFailure(e.message);
    }
    var n = 0;
    n += await db.ministries.importAll(c.ministries, summary: 'Restored ${c.ministries.length} ministries');
    n += await db.meetings.importAll(c.meetings, summary: 'Restored ${c.meetings.length} meetings');
    n += await db.followUps.importAll(c.followUps, summary: 'Restored ${c.followUps.length} follow-ups');
    n += await db.prayer.importAll(c.prayer, summary: 'Restored ${c.prayer.length} prayer requests');
    n += await db.volunteers.importAll(c.volunteers, summary: 'Restored ${c.volunteers.length} volunteers');
    n += await db.schedules.importAll(c.schedules, summary: 'Restored ${c.schedules.length} schedules');
    return n;
  }

  /// The Windows program's data folder, if this is a PC that has one.
  static Directory? defaultWindowsDataFolder() {
    final appData = Platform.environment['APPDATA'];
    if (!Platform.isWindows || appData == null) return null;
    final d = Directory('$appData\\Kingdom Connect');
    return d.existsSync() ? d : null;
  }

  /// Phase 1 migration: reads the Windows program's files (never changes them) and imports what they hold.
  Future<WindowsImportResult> importWindowsFolder(Directory folder) async {
    String? read(String name) {
      final f = File('${folder.path}${Platform.pathSeparator}$name');
      return f.existsSync() ? f.readAsStringSync() : null;
    }

    final parsed = WindowsImport.parse(
      savedContent: read('kc-saved-content.json'),
      membersPrivate: read('kc-members-private.json'),
    );
    if (parsed.isEmpty && parsed.problems.isEmpty) {
      throw const AppFailure('No Kingdom Connect data was found in that folder. Choose the folder that holds '
          'kc-saved-content.json (usually %APPDATA%\\Kingdom Connect).');
    }
    final meetings = await db.meetings.importAll(parsed.meetings, summary: 'Imported the meeting from the Windows app');
    final volunteers = await db.volunteers.importAll(parsed.volunteers,
        summary: 'Imported ${parsed.volunteers.length} members from the Windows app');
    return WindowsImportResult(meetings: meetings, volunteers: volunteers, problems: parsed.problems);
  }
}

class WindowsImportResult {
  const WindowsImportResult({required this.meetings, required this.volunteers, required this.problems});

  final int meetings;
  final int volunteers;
  final List<String> problems;

  String get summary {
    final parts = <String>[
      if (meetings > 0) '$meetings meeting${meetings == 1 ? '' : 's'}',
      if (volunteers > 0) '$volunteers member${volunteers == 1 ? '' : 's'} (as volunteers)',
    ];
    return parts.isEmpty ? 'Nothing to import.' : 'Imported ${parts.join(' and ')}.';
  }
}
