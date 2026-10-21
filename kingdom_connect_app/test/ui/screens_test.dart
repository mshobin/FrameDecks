// The Studio and the remote, built from a real saved file, with the app's fonts (so a screenshot looks like the app).
// KC_SHOTS=<folder> also writes PNG screenshots there.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/engine/backend.dart';
import 'package:kingdom_connect/engine/model.dart';
import 'package:kingdom_connect/engine/normalize.dart';
import 'package:kingdom_connect/engine/scenes.dart' as sc;
import 'package:kingdom_connect/ui/providers.dart';
import 'package:kingdom_connect/ui/remote/remote_home.dart';
import 'package:kingdom_connect/ui/studio/studio_screen.dart';
import 'package:kingdom_connect/ui/theme.dart';

Future<void> loadFonts() async {
  Future<void> font(String family, List<String> files) async {
    final l = FontLoader(family);
    for (final f in files) {
      l.addFont(Future.value(ByteData.sublistView(File(f).readAsBytesSync())));
    }
    await l.load();
  }

  await font('KC Sans', ['assets/fonts/SourceSans3.ttf']);
  await font('KC Serif', ['assets/fonts/EBGaramond.ttf']);
  final root = Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter-sdk/flutter';
  final icons = File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (icons.existsSync()) await font('MaterialIcons', [icons.path]);
}

/// A Bible Study evening: four Frames, the first one live with question 2 on screen.
Json demoState() {
  final st = normalize(null);
  final bs = sc.createScene(st, 'bible-study', name: 'Bible Study', group: 'Romans · Week 5');
  final v = sc.firstOf(bs, 'scripture')!, q = sc.firstOf(bs, 'question')!;
  sc.cOf(v)['items'] = [
    {
      'id': 'va',
      'ref': 'Romans 8:28',
      'version': 'KJV',
      'text': 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
    },
  ];
  sc.cOf(q)['items'] = [
    {'id': 'qa', 'text': 'What does this passage reveal about the character of God?'},
    {'id': 'qb', 'text': 'How could the truth of this passage change the way you respond to a situation you face right now?'},
    {'id': 'qc', 'text': 'What is one step you will take this week?'},
  ];
  sc.cOf(q)['label'] = 'Application';
  bs['notes'] = 'Welcome everyone. Read Romans 8:28 slowly, then ask the first question.';
  final w = sc.createScene(st, 'countdown', name: 'Welcome', group: 'Romans · Week 5');
  final cd = sc.firstOf(w, 'countdown')!;
  sc.cOf(cd)['title'] = 'Starting in';
  sc.createScene(st, 'prayer', name: 'Prayer', group: 'Romans · Week 5');
  final b = sc.createScene(st, 'birthday', name: 'Birthdays');
  (st['birthday'] as Json)
    ..['name'] = 'Grace'
    ..['greeting'] = 'Happy Birthday, Grace!'
    ..['message'] = 'We thank God for you.';
  b['fav'] = true;
  (st['scenes'] as List).remove(w);
  (st['scenes'] as List).insert(0, w);
  sc.take(st, bs['id']);
  sc.showItem(st, 'question', 'qb');
  (st['brand'] as Json)['meeting'] = 'Tuesday Bible Study';
  return st;
}

Future<void> shot(WidgetTester tester, String name) async {
  final dir = Platform.environment['KC_SHOTS'];
  if (dir == null) return;
  // images (the logo) decode on real time: let them, then draw
  await tester.runAsync(() async {
    for (final e in find.byType(Image).evaluate()) {
      await precacheImage((e.widget as Image).image, e);
    }
  });
  await tester.pump();
  await tester.runAsync(() async {
    final ro = tester.renderObject<RenderRepaintBoundary>(find.byKey(const ValueKey('shot')));
    final img = await ro.toImage(pixelRatio: 1);
    final png = await img.toByteData(format: ui.ImageByteFormat.png);
    File('$dir/$name.png').writeAsBytesSync(png!.buffer.asUint8List());
  });
}

/// Saving goes to a real file on real time: wait until the change has landed (or 5 s), not a fixed delay.
Future<void> waitUntil(WidgetTester tester, bool Function() done) async {
  await tester.runAsync(() async {
    for (var i = 0; i < 100 && !done(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
  });
  await tester.pumpAndSettle();
}

Future<LocalBackend> backendWith(Json st) async {
  final dir = Directory.systemTemp.createTempSync('kc');
  final f = File('${dir.path}/kc-saved-content.json')..writeAsStringSync(jsonEncode(st));
  final b = LocalBackend(f);
  await b.start();
  return b;
}

Widget host(StateBackend b, Widget child) => ProviderScope(
  overrides: [backendProvider.overrideWithValue(b)],
  child: RepaintBoundary(
    key: const ValueKey('shot'),
    child: MaterialApp(debugShowCheckedModeBanner: false, theme: kcTheme(), home: child),
  ),
);

void main() {
  setUpAll(loadFonts);

  testWidgets('the Studio shows the Frames, the live Content, the canvas and the inspector; Go Live and Hide All work', (tester) async {
    tester.view.physicalSize = const Size(1600, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final b = await tester.runAsync(() => backendWith(demoState()));
    await tester.pumpWidget(host(b!, const StudioScreen()));
    await tester.pumpAndSettle();

    expect(find.text('GO LIVE'), findsOneWidget);
    expect(find.text('● On air: Bible Study'), findsOneWidget);
    expect(find.text('Question 2 / 3'), findsOneWidget);
    expect(find.text('Welcome'), findsWidgets);
    expect(find.text('ROMANS · WEEK 5'), findsOneWidget);
    expect(find.textContaining('How could the truth'), findsWidgets); // on the canvas
    await shot(tester, 'studio');

    // the stepper shows the next question
    await tester.runAsync(() async {
      await tester.tap(find.byTooltip('Next item'));
    });
    await waitUntil(tester, () => (b.state['question'] as Json)['itemId'] == 'qc');
    expect((b.state['question'] as Json)['itemId'], 'qc');
    expect(find.text('Question 3 / 3'), findsOneWidget);

    // Hide All with Esc
    await tester.runAsync(() async {
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    });
    await waitUntil(tester, () => (b.state['question'] as Json)['visible'] == false);
    expect((b.state['question'] as Json)['visible'], false);

    // select Welcome, Go Live with T
    await tester.tap(find.text('Welcome').first);
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      await tester.sendKeyEvent(LogicalKeyboardKey.keyT);
    });
    await waitUntil(tester, () => sc.liveScene(b.state)?['name'] == 'Welcome');
    expect(sc.liveScene(b.state)!['name'], 'Welcome');
    await tester.pump(const Duration(seconds: 2));
    await shot(tester, 'studio-welcome');
    // notes shown during runAsync run on real timers: let them finish before the tree goes
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 1700)));
    tester.state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger)).clearSnackBars();
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('the phone remote: Frame 2 of 4, the question on screen, Next Frame takes the next one', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final b = await tester.runAsync(() => backendWith(demoState()));
    await tester.pumpWidget(host(b!, RemoteHome(onDisconnect: () {})));
    await tester.pumpAndSettle();
    expect(find.text('Frame 2 of 4'), findsOneWidget);
    expect(find.text('2 of 3 · ON SCREEN'), findsOneWidget);
    await shot(tester, 'remote');

    await tester.runAsync(() async {
      await tester.tap(find.text('NEXT FRAME'));
    });
    await waitUntil(tester, () => sc.liveScene(b.state)?['name'] == 'Prayer');
    expect(sc.liveScene(b.state)!['name'], 'Prayer');
    expect(find.text('Frame 3 of 4'), findsOneWidget);

    await tester.tap(find.text('Frames'));
    await tester.pumpAndSettle();
    await shot(tester, 'remote-frames');
    // notes shown during runAsync run on real timers: let them finish before the tree goes
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 1700)));
    tester.state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger)).clearSnackBars();
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
  });
}
