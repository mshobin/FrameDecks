/// Cloud sync: a port of app/js/cloud-sync.js (SaaS Phase 2; docs/project/saas-pwa-architecture.md §11, §24,
/// docs/architecture/cloud-api.md). The same rules as the Windows Studio, so every computer merges the same way.
///
///   pull: the cloud's changes since `seq`. A record this computer has not changed is taken as it is. One changed here
///         and in the cloud: a Frame is never lost (the cloud's stays, this computer's becomes a copy "‹name› (from
///         ‹computer›)"); anything else keeps this computer's version and sends it.
///   push: every record that differs from the last version both sides agreed on (`snapshot`), with its `baseRev`.
///
/// What is live, the cards' current text and the meeting details (unless "Sync meeting details" is on, D6) are never
/// sent. Nothing here runs while signed out (cloud_client.dart decides). Sync never touches what is on screen: it saves
/// through the backend's update like any edit.
library;

import 'dart:async';

import 'backend.dart';
import 'entities.dart' as ent;
import 'model.dart';
import 'normalize.dart';
import 'scenes.dart' as sc;

/// The cloud as the engine sees it: its own saved state, and GET / POST /v1/sync. The app's is CloudClient's; tests
/// use a fake cloud.
abstract class CloudNet {
  Future<Json?> getState();
  Future<void> saveState(Json state);
  Future<Json> pull(int since);
  Future<Json> push(List<Json> changes);
}

/// The two choices in Settings → FrameDecks account.
class SyncPrefs {
  SyncPrefs({this.syncMeeting = false, this.pauseLive = false});

  /// D6: off unless switched on.
  bool syncMeeting;

  /// "Pause sync while something is on screen".
  bool pauseLive;
}

/// What the account panel shows: the last round, and what it had to do.
class SyncInfo {
  int lastSync = 0;
  int pending = 0;
  int conflicts = 0;
  String error = '';

  /// The copies the last round made ("Study (from Home Mac)").
  List<String> copies = [];
}

const _batch = 200;
String _key(String kind, String id) => '$kind/$id';

/// A Frame's content without its ids and times: the starter Frames every computer makes are the same Frame.
const _noise = {'id', 'created', 'modified', 'creator', 'version'};
Object? _look(Object? v) {
  if (v is List) return v.map(_look).toList();
  if (v is! Map) return v;
  return {
    for (final k in v.keys)
      if (!_noise.contains(k)) k.toString(): _look(v[k]),
  };
}

String fingerprint(Object? body) => ent.canon(_look(body));

class CloudSync {
  CloudSync({required this.net, required this.store, required this.prefs, required this.computer});

  final CloudNet net;
  final StateBackend store;
  final SyncPrefs Function() prefs;
  final String Function() computer;

  final info = SyncInfo();
  _State? _state;
  var _running = false, _again = false;

  /// The engine's own record of what both sides agreed on (null before the first round).
  ({int seq, Map<String, int> revs, Map<String, Object?> snapshot})? get state =>
      _state == null ? null : (seq: _state!.seq, revs: _state!.revs, snapshot: _state!.snapshot);

  /// Forgets the agreed state (signed out): the next account starts by reading its sync state again.
  void reset() => _state = null;

  Future<_State> _load() async {
    if (_state != null) return _state!;
    final s = await net.getState();
    final revs = s?['revs'], snap = s?['snapshot'];
    return _state = _State(
      (s?['seq'] as num?)?.toInt() ?? 0,
      revs is Map ? {for (final e in revs.entries) e.key.toString(): (e.value as num).toInt()} : {},
      snap is Map ? {for (final e in snap.entries) e.key.toString(): e.value} : {}, // a list: an older or empty file
    );
  }

  Future<void> _save() => net.saveState(_state!.toJson());

  /// The records this computer would send now.
  List<ent.Entity> _mine(Json doc) {
    final p = prefs();
    return ent.split(doc).entities.where((e) => e.kind != 'meeting' || p.syncMeeting).toList();
  }

  static Map<String, ent.Entity> _byKey(List<ent.Entity> list) => {for (final e in list) _key(e.kind, e.id): e};

  /// local null: deleted here. A snapshot entry may be present with no body (a record deleted in the cloud and kept
  /// here), which counts as "no agreed version", as `undefined` does in cloud-sync.js.
  bool _changedHere(String k, ent.Entity? local) {
    final snap = _state!.snapshot[k];
    if (local == null) return snap != null; // deleted here since we last agreed
    return snap == null || ent.canon(local.body) != ent.canon(snap);
  }

  /// A Frame changed in both places: this computer's version becomes a copy with fresh ids, so nothing is lost.
  Json _frameCopy(Object? body) {
    final c = deepCopy(body as Json);
    c['id'] = rid('sc_');
    final name = c['name'];
    c['name'] = '${name == null || name == '' ? 'Frame' : name} (from ${computer()})';
    return sc.freshIds(c);
  }

  /// Writes changes into the document: sets {key: entity}, deletes [key], extra Frames to add.
  Future<void> _apply(Map<String, ent.Entity> sets, List<String> deletes, List<Json> extraFrames) async {
    if (sets.isEmpty && deletes.isEmpty && extraFrames.isEmpty) return;
    await store.update((n) {
      final s = ent.split(n), m = _byKey(s.entities);
      m.addAll(sets);
      deletes.forEach(m.remove);
      for (final f in extraFrames) {
        m['frame/${f['id']}'] = ent.Entity('frame', f['id'] as String, f);
      }
      // normalized as store.js fileSave does after every update (LocalBackend saves the map as it is)
      final d = normalize(ent.join(m.values.toList(), s.local));
      n.removeWhere((k, _) => !d.containsKey(k));
      n.addAll(d);
    });
  }

  Future<void> _pull() async {
    final st = _state!;
    final sets = <String, ent.Entity>{}, deletes = <String>[], extra = <Json>[], theirs = <String>{};
    final joining = st.revs.isEmpty;
    while (true) {
      final res = await net.pull(st.seq);
      final local = _byKey(_mine(store.state));
      for (final r in (res['entities'] as List? ?? const []).cast<Map<String, dynamic>>()) {
        final kind = r['kind'] as String, id = r['id'] as String, k = _key(kind, id), l = local[k];
        final Object? body = r['deleted'] == true ? null : r['body'];
        if (joining && kind == 'frame' && body != null) theirs.add(fingerprint(body));
        final known = st.revs.containsKey(k); // has this computer synced this record before?
        st.revs[k] = (r['rev'] as num).toInt();
        final same = l != null && body != null && ent.canon(l.body) == ent.canon(body);
        if (same || !_changedHere(k, l)) {
          // not changed here (or already the same)
          if (body == null) {
            if (l != null) deletes.add(k);
            st.snapshot.remove(k);
          } else {
            if (!same) sets[k] = ent.Entity(kind, id, body);
            st.snapshot[k] = body;
          }
          continue;
        }
        final isFrame = kind == 'frame' || kind == 'template';
        // A setting this computer never synced (joining an account, or "Sync meeting details" just switched on):
        // take the account's. Frames are merged instead (architecture §18).
        if (!known && !isFrame && body != null) {
          sets[k] = ent.Entity(kind, id, body);
          st.snapshot[k] = body;
          continue;
        }
        info.conflicts++;
        if (isFrame && body != null && l == null) {
          // deleted here, changed there: it comes back
          sets[k] = ent.Entity(kind, id, body);
          st.snapshot[k] = body;
        } else if (isFrame && body != null && l != null) {
          final c = _frameCopy(l.body);
          extra.add(c);
          info.copies.add(c['name'] as String);
          sets[k] = ent.Entity(kind, id, body);
          st.snapshot[k] = body;
        } else {
          st.snapshot[k] = body; // keep this computer's: push sends it on top
        }
      }
      final seq = (res['seq'] as num?)?.toInt() ?? 0;
      if (seq > st.seq) st.seq = seq;
      if (res['more'] != true) break;
    }
    // Joining an account: a Frame here that the account already has (the same content under other ids, such as the
    // starter Frames) is not added twice. Any difference and it is kept.
    if (joining) {
      for (final e in _mine(store.state)) {
        final k = _key(e.kind, e.id);
        if (e.kind == 'frame' && !st.revs.containsKey(k) && theirs.contains(fingerprint(e.body))) deletes.add(k);
      }
    }
    await _apply(sets, deletes, extra);
  }

  Future<void> _push() async {
    final st = _state!;
    final now = _byKey(_mine(store.state)), changes = <Json>[];
    now.forEach((k, e) {
      if (_changedHere(k, e)) changes.add({'kind': e.kind, 'id': e.id, 'baseRev': st.revs[k] ?? 0, 'deleted': false, 'body': e.body});
    });
    for (final k in st.snapshot.keys) {
      if (now.containsKey(k) || k.startsWith('meeting/') && !prefs().syncMeeting) continue; // meeting off: not a delete
      final i = k.indexOf('/');
      changes.add({'kind': k.substring(0, i), 'id': k.substring(i + 1), 'baseRev': st.revs[k] ?? 0, 'deleted': true});
    }
    info.pending = changes.length;
    final retry = <Json>[], extra = <Json>[], sets = <String, ent.Entity>{};
    Json? sent(List<Json> list, Json r) => list.where((x) => x['kind'] == r['kind'] && x['id'] == r['id']).firstOrNull;
    for (var i = 0; i < changes.length; i += _batch) {
      final list = changes.sublist(i, i + _batch > changes.length ? changes.length : i + _batch);
      final res = await net.push(list);
      for (final r in (res['results'] as List? ?? const []).cast<Map<String, dynamic>>()) {
        final k = _key(r['kind'] as String, r['id'] as String), c = sent(list, r);
        if (c == null) continue;
        if (r['status'] == 'ok') {
          st.revs[k] = (r['rev'] as num).toInt();
          if (c['deleted'] == true) {
            st.snapshot.remove(k);
          } else {
            st.snapshot[k] = c['body'];
          }
          final seq = (r['seq'] as num?)?.toInt() ?? 0;
          if (seq > st.seq) st.seq = seq;
          continue;
        }
        info.conflicts++;
        final cur = r['current'] is Map ? r['current'] as Map<String, dynamic> : const <String, dynamic>{};
        final curRev = (cur['rev'] as num?)?.toInt() ?? 0;
        if (curRev != 0) st.revs[k] = curRev;
        if ((r['kind'] == 'frame' || r['kind'] == 'template') && c['deleted'] != true && cur['deleted'] != true && cur['body'] != null) {
          final fc = _frameCopy(c['body']); // the cloud's stays; ours is a copy
          extra.add(fc);
          info.copies.add(fc['name'] as String);
          sets[k] = ent.Entity(r['kind'] as String, r['id'] as String, cur['body']);
          st.snapshot[k] = cur['body'];
        } else {
          retry.add({...c, 'baseRev': curRev}); // this computer's wins
        }
      }
    }
    await _apply(sets, const [], extra);
    if (retry.isNotEmpty) {
      final res = await net.push(retry);
      for (final r in (res['results'] as List? ?? const []).cast<Map<String, dynamic>>()) {
        final k = _key(r['kind'] as String, r['id'] as String), c = sent(retry, r);
        if (c == null || r['status'] != 'ok') continue;
        st.revs[k] = (r['rev'] as num).toInt();
        if (c['deleted'] == true) {
          st.snapshot.remove(k);
        } else {
          st.snapshot[k] = c['body'];
        }
      }
    }
    info.pending = 0;
  }

  /// One round: pull, then push. Never two at once (a round asked for meanwhile runs right after).
  Future<SyncInfo> syncOnce() async {
    if (_running) {
      _again = true;
      return info;
    }
    final doc = store.state, p = prefs();
    final live = doc['live'];
    if (p.pauseLive && live is Map && (live['scene'] ?? '') != '') return info; // "Pause sync while something is on screen"
    _running = true;
    info.copies = [];
    try {
      await _load();
      await _pull();
      await _push();
      await _save();
      info.lastSync = DateTime.now().millisecondsSinceEpoch;
      info.error = '';
    } catch (e) {
      info.error = e is Exception ? e.toString().replaceFirst(RegExp(r'^\w*Exception:\s*'), '') : '$e';
    }
    _running = false;
    if (_again) {
      _again = false;
      return syncOnce();
    }
    return info;
  }
}

class _State {
  _State(this.seq, this.revs, this.snapshot);

  int seq;
  final Map<String, int> revs;
  final Map<String, Object?> snapshot;

  /// As JSON.stringify writes it: a snapshot entry with no body is left out.
  Json toJson() => {
    'seq': seq,
    'revs': revs,
    'snapshot': {
      for (final e in snapshot.entries)
        if (e.value != null) e.key: e.value,
    },
  };
}
