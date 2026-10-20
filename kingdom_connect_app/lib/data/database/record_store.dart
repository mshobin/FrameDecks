import 'dart:async';

import 'package:isar_community/isar.dart';

import '../../core/audit/audit_log.dart';
import '../models/entity.dart';
import '../models/records.dart';

/// Low-level storage of one record type. Repositories (data/repositories) are the only callers.
///
/// Two implementations with the same behaviour: [IsarRecordStore] (Windows, macOS, iOS, Android, Linux) and
/// [MemoryRecordStore] (the web build, where Isar 3 has no engine, and tests).
abstract class RecordStore<T extends Entity> {
  /// Every record, deleted ones included.
  Future<List<T>> everything();

  /// The records not deleted; emits at once and again after every change.
  Stream<List<T>> watchActive();

  Future<T?> byUid(String uid);

  Future<void> put(T record);

  Future<void> putAll(List<T> records);
}

/// A stream that runs [query] when listened to and again after every [changes] event, in order. Cancelling it stops
/// listening at once (a plain controller: an `async*` generator waiting in `await for` does not end promptly when cancelled).
Stream<R> liveQuery<R>(Future<R> Function() query, Stream<void> Function() changes) {
  late final StreamController<R> out;
  StreamSubscription<void>? sub;
  var chain = Future<void>.value();
  void run() => chain = chain.then((_) async {
        final r = await query();
        if (!out.isClosed) out.add(r);
      }).catchError((Object e, StackTrace st) {
        if (!out.isClosed) out.addError(e, st);
      });
  out = StreamController<R>(
    onListen: () {
      run();
      sub = changes().listen((_) => run());
    },
    onCancel: () async {
      await sub?.cancel();
      sub = null;
    },
  );
  return out.stream;
}

/// Isar storage. The two queries come from Isar's generated, typed code for each collection (see AppDatabase), so
/// no experimental generic API is used.
class IsarRecordStore<T extends Entity> implements RecordStore<T> {
  IsarRecordStore(this.isar, this.collection, {required this.findAll, required this.findByUid});

  final Isar isar;
  final IsarCollection<T> collection;
  final Future<List<T>> Function() findAll;
  final Future<T?> Function(String uid) findByUid;

  @override
  Future<List<T>> everything() => findAll();

  @override
  Stream<List<T>> watchActive() => liveQuery(_active, collection.watchLazy);

  Future<List<T>> _active() async => (await everything()).where((r) => !r.isDeleted).toList();

  @override
  Future<T?> byUid(String uid) => findByUid(uid);

  @override
  Future<void> put(T record) => isar.writeTxn(() => collection.put(record));

  @override
  Future<void> putAll(List<T> records) => isar.writeTxn(() => collection.putAll(records));
}

class MemoryRecordStore<T extends Entity> implements RecordStore<T> {
  final _byUid = <String, T>{};
  final _changes = StreamController<void>.broadcast();
  var _nextId = 1;

  @override
  Future<List<T>> everything() async => _byUid.values.toList();

  @override
  Stream<List<T>> watchActive() => liveQuery(() async => _active(), () => _changes.stream);

  List<T> _active() => _byUid.values.where((r) => !r.isDeleted).toList();

  @override
  Future<T?> byUid(String uid) async => _byUid[uid];

  @override
  Future<void> put(T record) async {
    _store(record);
    _changes.add(null);
  }

  @override
  Future<void> putAll(List<T> records) async {
    records.forEach(_store);
    _changes.add(null);
  }

  void _store(T record) {
    if (record.id == Isar.autoIncrement) record.id = _nextId++;
    _byUid[record.uid] = record;
  }
}

class IsarAuditLog implements AuditLog {
  IsarAuditLog(this.isar);

  final Isar isar;

  @override
  Future<void> record(AuditEvent event) => isar.writeTxn(() => isar.auditEvents.put(event));

  @override
  Future<List<AuditEvent>> recent(int limit) => isar.auditEvents.where().sortByAtDesc().limit(limit).findAll();

  @override
  Stream<List<AuditEvent>> watchRecent(int limit) => liveQuery(() => recent(limit), isar.auditEvents.watchLazy);
}

class MemoryAuditLog implements AuditLog {
  final _events = <AuditEvent>[];
  final _changes = StreamController<void>.broadcast();

  @override
  Future<void> record(AuditEvent event) async {
    _events.add(event);
    _changes.add(null);
  }

  @override
  Future<List<AuditEvent>> recent(int limit) async {
    final sorted = [..._events]..sort((a, b) => b.at.compareTo(a.at));
    return sorted.take(limit).toList();
  }

  @override
  Stream<List<AuditEvent>> watchRecent(int limit) => liveQuery(() => recent(limit), () => _changes.stream);
}
