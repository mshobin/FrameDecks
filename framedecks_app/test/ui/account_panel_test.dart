// Settings → FrameDecks account: what it shows not set up, signed out and signed in (the Windows panel's words).
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/backend.dart';
import 'package:framedecks/engine/cloud_client.dart';
import 'package:framedecks/ui/settings_screen.dart';
import 'package:framedecks/ui/theme.dart';

void main() {
  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('fd-account'));
  tearDown(() => dir.deleteSync(recursive: true));

  Future<CloudLink> link(WidgetTester t, {String? api}) async {
    final client = CloudClient(
      dir: dir,
      appVersion: '6.10',
      platform: 'macos',
      secret: FileTokenStore(File('${dir.path}/kc-cloud-token')),
      api: api,
      environment: const {},
    );
    await t.runAsync(client.start);
    return CloudLink(client, LocalBackend(File('${dir.path}/kc-saved-content.json')));
  }

  Future<void> show(WidgetTester t, CloudLink l) => t.pumpWidget(
    MaterialApp(
      theme: kcTheme(),
      home: Scaffold(body: SingleChildScrollView(child: AccountPanel(link: l))),
    ),
  );

  testWidgets('no cloud address: not set up, nothing to sign in to', (t) async {
    await show(t, await link(t));
    expect(find.textContaining('Not set up on this computer yet.'), findsOneWidget);
    expect(find.text('Email me a code'), findsNothing);
  });

  testWidgets('signed out: an email code, or the browser', (t) async {
    await show(t, await link(t, api: 'https://api.example.org'));
    expect(find.text('Email me a code'), findsOneWidget);
    expect(find.text('Google, Microsoft or Apple…'), findsOneWidget);
  });

  testWidgets('signed in: the sync status, who, and the two switches (meeting details off)', (t) async {
    File('${dir.path}/kc-cloud-token').writeAsStringSync('r1');
    File('${dir.path}/kc-cloud.json').writeAsStringSync(
      jsonEncode({
        'computerName': 'Home Mac',
        'account': {
          'user': {'email': 'ann@example.org'},
          'workspace': {'name': "Ann's ministry"},
          'runtime': {'id': 'r_1'},
        },
      }),
    );
    await show(t, await link(t, api: 'https://api.example.org'));
    expect(find.text('Synced not yet'), findsOneWidget);
    expect(find.text('Sync now'), findsOneWidget);
    expect(find.text('ann@example.org'), findsOneWidget);
    expect(find.text("Ann's ministry"), findsOneWidget);
    expect(find.text('Home Mac'), findsOneWidget);
    expect(find.text('Sync meeting details'), findsOneWidget);
    expect(t.widget<Checkbox>(find.byType(Checkbox).first).value, isFalse);
    expect(find.text('Pause sync while something is on screen'), findsOneWidget);
    expect(find.text('Sign out of this computer'), findsOneWidget);
    await t.pumpWidget(const SizedBox()); // the panel's clock stops
  });
}
