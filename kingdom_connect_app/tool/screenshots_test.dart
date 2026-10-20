/// Renders the main screens to PNG files with real fonts, for design review and the docs (not part of `flutter test`).
///
///   flutter test tool/screenshots_test.dart --update-goldens
///
/// Output: tool/screenshots/*.png (desktop, tablet and phone; light and dark).
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../test/widget/app_test.dart' show pumpApp, seeded;

Future<void> _font(String family, List<String> files) async {
  final sdk = Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter-sdk/flutter';
  final loader = FontLoader(family);
  for (final f in files) {
    final bytes = File('$sdk/bin/cache/artifacts/material_fonts/$f').readAsBytesSync();
    loader.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(() async {
    const roboto = ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf', 'Roboto-Black.ttf'];
    await _font('Roboto', roboto);
    // Text without a font family uses the test font (blocks) in tests, and the system font on a device: stand in for it.
    await _font('FlutterTest', roboto);
    await _font('MaterialIcons', ['MaterialIcons-Regular.otf']);
  });

  const shots = {
    'desktop': Size(1440, 1000),
    'tablet': Size(820, 1180),
    'phone': Size(390, 844),
  };
  for (final s in shots.entries) {
    for (final page in ['/dashboard', '/meetings', '/meetings/new', '/follow-ups', '/settings']) {
      for (final dark in [false, true]) {
        if (dark && page != '/dashboard' && page != '/meetings/new') continue;
        final name = '${s.key}-${page.substring(1).replaceAll('/', '-')}${dark ? '-dark' : ''}';
        testWidgets(name, (tester) async {
          await pumpApp(tester, await seeded(), s.value, at: page, dark: dark);
          final ctx = tester.element(find.byType(Scaffold).first);
          await tester.runAsync(() => precacheImage(const AssetImage('assets/brand/kc-mark.png'), ctx));
          await tester.pumpAndSettle();
          await expectLater(find.byType(MaterialApp), matchesGoldenFile('screenshots/$name.png'));
        });
      }
    }
  }
}
