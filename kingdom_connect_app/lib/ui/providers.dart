import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engine/backend.dart';
import '../engine/model.dart';
import '../engine/scenes.dart' as sc;

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
  const Selection({this.scene = '', this.layer = '', this.tx = '', this.deck = ''});

  final String scene;
  final String layer;

  /// '' = the Frame's own transition ("Frame default").
  final String tx;

  /// The chosen Deck of the selected Frame ('' = the default, see [selectedDeck]).
  final String deck;

  Selection copyWith({String? scene, String? layer, String? tx, String? deck}) =>
      Selection(scene: scene ?? this.scene, layer: layer ?? this.layer, tx: tx ?? this.tx, deck: deck ?? this.deck);
}

class SelectionNotifier extends Notifier<Selection> {
  @override
  Selection build() => const Selection();

  void scene(String id) => state = id == state.scene ? state.copyWith(layer: '') : state.copyWith(scene: id, layer: '', deck: '');
  void layer(String id) => state = state.copyWith(layer: id);
  void tx(String id) => state = state.copyWith(tx: id);
  void deck(String id) => state = state.copyWith(deck: id);
}

/// The Deck new Content goes into and the canvas previews: the chosen one; else the live Deck when the Frame is live;
/// else the Deck of the selected Content; else the first.
String selectedDeck(Json st, Json? scene, Selection sel) {
  if (scene == null) return '';
  if (sel.deck.isNotEmpty && sc.deckById(scene, sel.deck) != null) return sel.deck;
  if (sc.isLive(st, scene['id'])) return sc.liveDeckId(st, scene);
  final l = sc.layerOf(scene, sel.layer);
  if (l != null) return sc.deckOf(scene, l);
  return sc.decksOf(scene).first['id'] as String;
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
