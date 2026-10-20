import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Where a copy of the ministry data can live (docs/project/flutter-platform-plan.md §2, Phase 5).
///
/// Only [LocalProvider] works today: it keeps backup snapshots in a folder on this device. The cloud providers are
/// placeholders with the same contract, so OneDrive, SharePoint, Google Drive and iCloud can be added later without
/// changing the features. Sync is not implemented and nothing leaves the device.
abstract class StorageProvider {
  /// Stable id, saved in settings ("local", "onedrive" …).
  String get id;

  String get displayName;

  /// Available on this platform and in this build.
  bool get isAvailable;

  /// Why it is not available (shown in Settings), or null.
  String? get unavailableReason;

  /// Stores one snapshot (the backup JSON). Returns where it went, in words for the user.
  Future<String> saveSnapshot(String name, String json);

  /// Snapshot names, newest first.
  Future<List<String>> listSnapshots();

  Future<String> readSnapshot(String name);
}

class LocalProvider implements StorageProvider {
  LocalProvider({this.folder});

  /// Where the backups go; by default Documents/Kingdom Connect/Backups.
  final Directory? folder;
  Directory? _resolved;

  @override
  String get id => 'local';

  @override
  String get displayName => 'This device';

  @override
  bool get isAvailable => !kIsWeb;

  @override
  String? get unavailableReason => kIsWeb ? 'In a web browser, use Export → Backup file instead.' : null;

  Future<Directory> _dir() async {
    final base = _resolved ??=
        folder ?? Directory('${(await getApplicationDocumentsDirectory()).path}/Kingdom Connect/Backups');
    if (!base.existsSync()) await base.create(recursive: true);
    return base;
  }

  @override
  Future<String> saveSnapshot(String name, String json) async {
    final dir = await _dir();
    final file = File('${dir.path}/$name');
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsString(json, flush: true);
    await tmp.rename(file.path); // atomic: a backup is either complete or not there
    return file.path;
  }

  @override
  Future<List<String>> listSnapshots() async {
    final dir = await _dir();
    final files = dir.listSync().whereType<File>().where((f) => f.path.endsWith('.json')).toList()
      ..sort((a, b) => b.statSync().modified.compareTo(a.statSync().modified));
    return files.map((f) => f.uri.pathSegments.last).toList();
  }

  @override
  Future<String> readSnapshot(String name) async => File('${(await _dir()).path}/$name').readAsString();
}

/// A cloud provider that is planned but not built yet. Same contract, so the Settings screen can list it.
class PlannedCloudProvider implements StorageProvider {
  const PlannedCloudProvider(this.id, this.displayName);

  @override
  final String id;

  @override
  final String displayName;

  @override
  bool get isAvailable => false;

  @override
  String? get unavailableReason => 'Planned. Your data stays on this device until sync is added.';

  @override
  Future<String> saveSnapshot(String name, String json) => throw UnsupportedError('$displayName is not available yet.');

  @override
  Future<List<String>> listSnapshots() async => const [];

  @override
  Future<String> readSnapshot(String name) => throw UnsupportedError('$displayName is not available yet.');
}

const oneDriveProvider = PlannedCloudProvider('onedrive', 'OneDrive');
const sharePointProvider = PlannedCloudProvider('sharepoint', 'SharePoint');
const googleDriveProvider = PlannedCloudProvider('googledrive', 'Google Drive');
const iCloudProvider = PlannedCloudProvider('icloud', 'iCloud');
