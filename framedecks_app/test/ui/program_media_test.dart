// Image and video Content on the program view, placed as the Windows camera places them (vcam/layers.py), with the
// files in a temporary data folder's media folder.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/media.dart';
import 'package:framedecks/engine/model.dart';
import 'package:framedecks/engine/normalize.dart';
import 'package:framedecks/engine/scenes.dart' as sc;
import 'package:framedecks/ui/program_media.dart';
import 'package:framedecks/ui/program_view.dart';

/// A 4 x 2 red PNG (twice as wide as high).
final png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGP4z8AARwzIHABvqgf5gNwAKAAAAABJRU5ErkJggg==');

/// A stand-in for package:video_player: counts the players made and closed.
class FakeVideo extends ProgramVideo {
  FakeVideo(this.file) {
    made++;
  }

  static var made = 0, closed = 0;
  static final loops = <bool>[];
  final File file;
  var _ready = false;

  @override
  Future<void> start({required bool loop, required double volume}) async {
    loops.add(loop);
    _ready = true;
    notifyListeners();
  }

  @override
  Future<void> setLooping(bool loop) async => loops.add(loop);

  @override
  Future<void> setVolume(double volume) async {}

  @override
  bool get ready => _ready;

  @override
  double get aspectRatio => 16 / 9;

  @override
  Widget view() => const ColoredBox(key: ValueKey('fake-video'), color: Colors.blue);

  @override
  void dispose() {
    closed++;
    super.dispose();
  }
}

late Directory data;

/// A Frame with two Decks, live on its first Deck, and the given media Content (top first, like the state keeps it).
({Json st, Json scene, String d1, String d2}) frame(List<Json> layers, {String? deck}) {
  final st = normalize(null);
  final s = sc.createScene(st, 'announcement', name: 'Welcome');
  final d1 = sc.decksOf(s).first['id'] as String;
  final d2 = sc.addDeck(s, 'Deck 2')['id'] as String;
  for (final l in layers) {
    l['deck'] ??= d1;
    (s['layers'] as List).insert(0, l);
  }
  sc.take(st, s['id'], 'cut', deck ?? d1);
  return (st: st, scene: s, d1: d1, d2: d2);
}

Json media(String kind, Json c, {bool visible = true, num opacity = 1, String? deck}) {
  final l = sc.newLayer(kind, {'c': c});
  l['visible'] = visible;
  l['opacity'] = opacity;
  if (deck != null) l['deck'] = deck;
  return l;
}

Widget program(Json st, {ProgramVideoFactory videoFactory = FakeVideo.new}) => MaterialApp(
  home: Align(
    alignment: Alignment.topLeft,
    child: SizedBox(
      width: 800,
      height: 450,
      child: ProgramView(state: st, dataDir: data.path, videoFactory: videoFactory, background: ProgramBackground.dark),
    ),
  ),
);

Finder get pictures => find.descendant(of: find.byType(ProgramMediaLayer), matching: find.byType(Image));

void main() {
  setUpAll(() {
    data = Directory.systemTemp.createTempSync('framedecks-media-');
    mediaDir(data.path).createSync();
    File('${mediaDir(data.path).path}/logo.png').writeAsBytesSync(png);
    File('${mediaDir(data.path).path}/welcome.mp4').writeAsBytesSync([0, 0, 0, 0]);
  });
  tearDownAll(() => data.deleteSync(recursive: true));
  setUp(() {
    FakeVideo.made = 0;
    FakeVideo.closed = 0;
    FakeVideo.loops.clear();
  });

  testWidgets('an image sits at its centre (x, y) with its box w x h of the picture, faded by its opacity', (t) async {
    final f = frame([
      media('image', {'x': .25, 'y': .5, 'w': .25, 'h': .2, 'file': 'logo.png'}, opacity: .5),
    ]);
    await t.pumpWidget(program(f.st));
    expect(pictures, findsOneWidget);
    // 800 x 450: 200 x 90, centred at (200, 225)
    expect(t.getRect(pictures), const Rect.fromLTWH(100, 180, 200, 90));
    final fade = t.widget<Opacity>(find.ancestor(of: pictures, matching: find.byType(Opacity)).first);
    expect(fade.opacity, .5);
  });

  testWidgets('an image without a height takes its height from the picture', (t) async {
    final f = frame([
      media('image', {'x': .5, 'y': .5, 'w': .5, 'file': 'logo.png'}),
    ]);
    await t.pumpWidget(program(f.st));
    await t.runAsync(() async {
      await precacheImage(FileImage(File('${mediaDir(data.path).path}/logo.png')), t.element(pictures));
    });
    await t.pump();
    // 400 wide; the PNG is 4 x 2, so 200 high, centred at (400, 225)
    expect(t.getRect(pictures), const Rect.fromLTWH(200, 125, 400, 200));
  });

  testWidgets('hidden Content is not drawn', (t) async {
    final f = frame([
      media('image', {'x': .5, 'y': .5, 'w': .25, 'h': .2, 'file': 'logo.png'}, visible: false),
    ]);
    await t.pumpWidget(program(f.st));
    expect(pictures, findsNothing);
  });

  testWidgets('Content of another Deck is not drawn', (t) async {
    final st = normalize(null);
    final s = sc.createScene(st, 'announcement', name: 'Welcome');
    final d2 = sc.addDeck(s, 'Deck 2')['id'] as String;
    (s['layers'] as List).insert(0, media('image', {'x': .5, 'y': .5, 'w': .25, 'h': .2, 'file': 'logo.png'}, deck: d2));
    sc.take(st, s['id'], 'cut', sc.decksOf(s).first['id'] as String);
    await t.pumpWidget(program(st));
    expect(find.byType(ProgramMediaLayer), findsNothing);
    expect(pictures, findsNothing);
    // its own Deck live: it shows
    sc.take(st, s['id'], 'cut', d2);
    await t.pumpWidget(program(deepCopy(st)));
    expect(pictures, findsOneWidget);
  });

  testWidgets('a file that is not on this computer shows nothing and does not throw', (t) async {
    final f = frame([
      media('image', {'x': .5, 'y': .5, 'w': .25, 'h': .2, 'file': 'from-the-pc.png'}),
      media('video', {'x': .5, 'y': .5, 'w': .5, 'file': 'from-the-pc.mp4'}),
    ]);
    await t.pumpWidget(program(f.st));
    await t.pump();
    expect(t.takeException(), isNull);
    expect(pictures, findsNothing);
    expect(find.byKey(const ValueKey('fake-video')), findsNothing);
    expect(FakeVideo.made, 0);
  });

  testWidgets('a video keeps one player across state changes, and closes it when it leaves the program', (t) async {
    final video = media('video', {'x': .5, 'y': .5, 'w': .5, 'file': 'welcome.mp4', 'loop': true});
    final f = frame([video]);
    var st = f.st;
    await t.pumpWidget(program(st));
    await t.pump();
    expect(find.byKey(const ValueKey('fake-video')), findsOneWidget);
    // 400 wide, 16:9: 225 high, centred
    expect(t.getRect(find.byKey(const ValueKey('fake-video'))), const Rect.fromLTWH(200, 112.5, 400, 225));
    for (var i = 0; i < 5; i++) {
      // what a long-poll tick brings: a new copy of the state, with something else changed
      st = deepCopy(st);
      st['rev'] = i + 10;
      (st['question'] as Json)['text'] = 'Question $i';
      await t.pumpWidget(program(st));
    }
    // loop off: the same player, told to play once
    st = deepCopy(st);
    sc.cOf(sc.layerOf(sc.findScene(st, f.scene['id']), video['id'])!)['loop'] = false;
    await t.pumpWidget(program(st));
    expect(FakeVideo.made, 1);
    expect(FakeVideo.closed, 0);
    expect(FakeVideo.loops, [true, false]);
    // the other Deck goes live: the video leaves the program
    st = deepCopy(st);
    sc.take(st, f.scene['id'], 'cut', f.d2);
    await t.pumpWidget(program(st));
    expect(find.byKey(const ValueKey('fake-video')), findsNothing);
    expect(FakeVideo.closed, 1);
  });

  testWidgets('media is drawn under the cards, bottom Content first', (t) async {
    final top = media('image', {'x': .5, 'y': .5, 'w': .25, 'h': .2, 'file': 'logo.png'});
    final bottom = media('video', {'x': .5, 'y': .5, 'w': .5, 'file': 'welcome.mp4'});
    final f = frame([bottom, top]); // inserted at the top one by one: top ends up first
    await t.pumpWidget(program(f.st));
    final order = t.widgetList<ProgramMediaLayer>(find.byType(ProgramMediaLayer)).map((w) => w.layer['id']).toList();
    expect(order, [bottom['id'], top['id']]);
  });
}
