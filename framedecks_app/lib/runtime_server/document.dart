/// The one state document a runtime serves (kc-saved-content.json), as the runtime server sees it.
///
/// In the Mac app the server shares the app's own [LocalBackend]: one document, one rev, whether a change comes from
/// this window or from a phone. The CLI (bin/runtime_server.dart) uses a [LocalBackend] of its own.
library;

import '../engine/backend.dart';
import '../engine/model.dart';

abstract class DocumentStore {
  /// The document now, with its `rev`.
  Json get document;

  /// Every saved document, in order (from this server or anyone else using the same store).
  Stream<Json> get changes;

  /// Saves a change: [fn] edits a copy of the latest document, then `rev` goes up by one. If [fn] throws, nothing
  /// is saved. Changes are made one at a time, so what [fn] sees is what it changes.
  Future<Json> update(void Function(Json n) fn);
}

/// A [StateBackend] (in practice the app's [LocalBackend]) as the runtime's document.
class BackendDocument implements DocumentStore {
  BackendDocument(this.backend);

  final StateBackend backend;

  @override
  Json get document => backend.state;

  @override
  Stream<Json> get changes => backend.changes;

  @override
  Future<Json> update(void Function(Json n) fn) => backend.update(fn);
}
