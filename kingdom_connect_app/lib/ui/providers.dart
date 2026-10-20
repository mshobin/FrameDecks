import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engine/backend.dart';
import '../engine/model.dart';

/// Where the state lives (set in main.dart: this device's file, the program on this PC, or the PC on the network).
final backendProvider = Provider<StateBackend>((ref) => throw StateError('backendProvider is set in main.dart'));

/// The current state; rebuilds everything that reads it on every change (from this device or any other).
final stateProvider = StreamProvider<Json>((ref) async* {
  final b = ref.watch(backendProvider);
  yield b.state;
  yield* b.changes;
});

final linkProvider = StreamProvider<Link>((ref) async* {
  final b = ref.watch(backendProvider);
  yield b.link;
  yield* b.linkChanges;
});

/// The Studio's selection (what the canvas previews and the inspector edits), and the Transition menu's choice.
class Selection {
  const Selection({this.scene = '', this.layer = '', this.tx = ''});

  final String scene;
  final String layer;

  /// '' = the Frame's own transition ("Frame default").
  final String tx;

  Selection copyWith({String? scene, String? layer, String? tx}) =>
      Selection(scene: scene ?? this.scene, layer: layer ?? this.layer, tx: tx ?? this.tx);
}

class SelectionNotifier extends Notifier<Selection> {
  @override
  Selection build() => const Selection();

  void scene(String id) => state = state.copyWith(scene: id, layer: '');
  void layer(String id) => state = state.copyWith(layer: id);
  void tx(String id) => state = state.copyWith(tx: id);
}

final selectionProvider = NotifierProvider<SelectionNotifier, Selection>(SelectionNotifier.new);

/// Which page the desktop app shows (the top bar's icon tabs).
enum AppPage { studio, settings }

class PageNotifier extends Notifier<AppPage> {
  @override
  AppPage build() => AppPage.studio;

  void show(AppPage p) => state = p;
}

final pageProvider = NotifierProvider<PageNotifier, AppPage>(PageNotifier.new);
