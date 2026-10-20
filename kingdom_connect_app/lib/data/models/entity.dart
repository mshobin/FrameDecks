import 'package:isar_community/isar.dart';

/// Fields every stored record has (docs/project/flutter-platform-plan.md §3).
///
/// [uid] is the record's identity across devices and imports; [id] is only Isar's local key. [version], [dirty] and
/// [deletedAt] are there so a future sync provider can find and merge changes without a schema change.
abstract class Entity {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: true)
  late String uid;

  late DateTime createdAt;

  @Index()
  late DateTime updatedAt;

  /// Soft delete: the record stays (for undo and sync) but is hidden everywhere.
  DateTime? deletedAt;

  int version = 0;

  /// Changed since the last sync. Always true until sync exists.
  bool dirty = true;

  @ignore
  bool get isDeleted => deletedAt != null;

  /// What the record is called in lists, activity and the audit log.
  @ignore
  String get displayTitle;

  /// The type name used in the audit log (stable, not localised).
  @ignore
  String get recordType;
}
