import '../../data/models/records.dart';

/// Where audit events go (docs/project/flutter-platform-plan.md §2). Every write in the app records one; the dashboard's
/// Recent activity reads them back.
abstract class AuditLog {
  Future<void> record(AuditEvent event);

  /// Newest first.
  Stream<List<AuditEvent>> watchRecent(int limit);

  Future<List<AuditEvent>> recent(int limit);
}
