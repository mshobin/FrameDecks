import '../../core/audit/audit_log.dart';
import '../../core/errors/app_failure.dart';
import '../../core/security/permissions.dart';
import '../../core/utils/clock.dart';
import '../../core/utils/ids.dart';
import '../database/record_store.dart';
import '../models/entity.dart';
import '../models/records.dart';

/// The only way the app changes stored records. Every write:
/// - checks the permission ([PermissionPolicy]),
/// - stamps the sync fields ([Entity.updatedAt], [Entity.version], [Entity.dirty]),
/// - records an [AuditEvent] (which is also the dashboard's Recent activity).
class Repository<T extends Entity> {
  Repository({
    required this.store,
    required this.audit,
    required this.policy,
    required this.user,
    required this.clock,
    required this.editPermission,
  });

  final RecordStore<T> store;
  final AuditLog audit;
  final PermissionPolicy policy;
  final AppUser user;
  final Clock clock;
  final Permission editPermission;

  Stream<List<T>> watchAll() => store.watchActive();

  Future<List<T>> all() async => (await store.everything()).where((r) => !r.isDeleted).toList();

  Future<T?> byUid(String uid) async {
    final r = await store.byUid(uid);
    return r == null || r.isDeleted ? null : r;
  }

  /// Creates [record] if it is new (no uid yet), otherwise saves the changes. Returns the stored record.
  Future<T> save(T record, {String? summary}) async {
    _require(editPermission, 'change ${record.recordType} records');
    final now = clock.now();
    final isNew = !_hasUid(record);
    if (isNew) {
      record.uid = newUid();
      record.createdAt = now;
    }
    record
      ..updatedAt = now
      ..version = record.version + 1
      ..dirty = true;
    await store.put(record);
    await _log(isNew ? AuditAction.create : AuditAction.update, record, summary);
    return record;
  }

  /// Soft delete: hidden everywhere, kept for undo and for sync.
  Future<void> delete(String uid) async {
    _require(Permission.deleteRecords, 'delete records');
    final r = await store.byUid(uid);
    if (r == null || r.isDeleted) return;
    final now = clock.now();
    r
      ..deletedAt = now
      ..updatedAt = now
      ..version = r.version + 1
      ..dirty = true;
    await store.put(r);
    await _log(AuditAction.delete, r, null);
  }

  Future<void> restore(String uid) async {
    _require(Permission.deleteRecords, 'restore records');
    final r = await store.byUid(uid);
    if (r == null || !r.isDeleted) return;
    r
      ..deletedAt = null
      ..updatedAt = clock.now()
      ..version = r.version + 1
      ..dirty = true;
    await store.put(r);
    await _log(AuditAction.restore, r, null);
  }

  /// Import: records keep their uid (so importing twice updates in place). One audit event for the whole import.
  Future<int> importAll(List<T> records, {required String summary}) async {
    _require(Permission.importData, 'import data');
    if (records.isEmpty) return 0;
    final now = clock.now();
    final merged = <T>[];
    for (final r in records) {
      final existing = await store.byUid(r.uid);
      if (existing != null) {
        r
          ..id = existing.id
          ..createdAt = existing.createdAt
          ..version = existing.version + 1;
      } else {
        r
          ..createdAt = now
          ..version = 1;
      }
      r
        ..updatedAt = now
        ..dirty = true;
      merged.add(r);
    }
    await store.putAll(merged);
    await audit.record(AuditEvent()
      ..at = now
      ..actor = user.name
      ..action = AuditAction.import
      ..recordType = merged.first.recordType
      ..summary = summary);
    return merged.length;
  }

  bool _hasUid(T record) {
    try {
      return record.uid.isNotEmpty;
    } catch (_) {
      return false; // `late` and never set: a new record
    }
  }

  void _require(Permission p, String action) {
    if (!policy.can(user, p)) throw PermissionDenied(action);
  }

  Future<void> _log(AuditAction action, T r, String? summary) => audit.record(AuditEvent()
    ..at = clock.now()
    ..actor = user.name
    ..action = action
    ..recordType = r.recordType
    ..recordUid = r.uid
    ..summary = summary ?? r.displayTitle);
}
