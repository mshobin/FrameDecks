import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/app.dart';
import 'package:kingdom_connect/core/utils/clock.dart';
import 'package:kingdom_connect/data/database/app_database.dart';
import 'package:kingdom_connect/data/models/meeting.dart';
import 'package:kingdom_connect/data/models/records.dart';
import 'package:kingdom_connect/services/settings/app_settings.dart';
import 'package:kingdom_connect/shared/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

final now = DateTime(2026, 10, 21, 10);

Future<AppDatabase> seeded() async {
  final db = AppDatabase.memory(clock: FixedClock(now));
  final youth = await db.ministries.save(Ministry()..name = 'Youth');
  await db.meetings.save(Meeting()
    ..name = 'Youth night'
    ..ministryUid = youth.uid
    ..date = DateTime(2026, 10, 14)
    ..attendance = (MeetingAttendance()..count = 32..visitors = 3));
  await db.meetings.save(Meeting()
    ..name = 'Leaders planning'
    ..date = DateTime(2026, 10, 28)
    ..location = 'Room 2');
  await db.followUps.save(FollowUp()..personName = 'Grace'..dueDate = DateTime(2026, 10, 18));
  await db.volunteers.save(Volunteer()..name = 'Ann');
  await db.volunteers.save(Volunteer()..name = 'Ben');
  return db;
}

Future<void> pumpApp(WidgetTester tester, AppDatabase db, Size size, {String at = '/dashboard', bool dark = false}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'kc.churchName': 'Grace Fellowship', if (dark) 'kc.themeMode': 'dark'});
  final prefs = await SharedPreferences.getInstance();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      databaseProvider.overrideWithValue(db),
      settingsStoreProvider.overrideWithValue(SettingsStore(prefs)),
      clockProvider.overrideWithValue(FixedClock(now)),
    ],
    child: KingdomConnectApp(initialLocation: at),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('desktop: rail, church name and live KPIs', (tester) async {
    await pumpApp(tester, await seeded(), const Size(1440, 1000));
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.text('GRACE FELLOWSHIP'), findsOneWidget);
    expect(find.text('TOTAL MEETINGS'), findsOneWidget);
    expect(find.text('Upcoming meetings'), findsOneWidget);
    expect(find.text('Leaders planning'), findsOneWidget);      // upcoming
    expect(find.text('1 overdue'), findsOneWidget);             // Grace, due on the 18th
    expect(find.text('Attendance trend'), findsOneWidget);
    expect(find.textContaining('Added Ann'), findsOneWidget);   // recent activity
  });

  testWidgets('phone: bottom navigation, More opens the drawer', (tester) async {
    await pumpApp(tester, await seeded(), const Size(390, 844));
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationDrawer), findsOneWidget);
    await tester.tap(find.text('Volunteers').last);
    await tester.pumpAndSettle();
    expect(find.text('Ann'), findsOneWidget);
    expect(find.text('Ben'), findsOneWidget);
  });

  testWidgets('meeting form: name and date are required, then it saves and lists', (tester) async {
    final db = AppDatabase.memory(clock: FixedClock(now));
    await pumpApp(tester, db, const Size(1440, 1000), at: '/meetings/new');
    expect(find.text('Meeting details'), findsWidgets);
    await tester.tap(find.text('Save'));
    await tester.pump(const Duration(milliseconds: 400));             // the message slides in
    expect(find.text('Give the meeting a name.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Meeting name'), 'Prayer night');
    await tester.enterText(find.widgetWithText(TextField, 'Location'), 'Chapel');
    await tester.tap(find.text('Attendees').first);
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Attendance'), '18');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    final saved = (await db.meetings.all()).single;
    expect(saved.name, 'Prayer night');
    expect(saved.location, 'Chapel');
    expect(saved.attendance.count, 18);
    expect(find.text('Meeting saved'), findsOneWidget);
  });

  testWidgets('dark mode follows the setting', (tester) async {
    await pumpApp(tester, await seeded(), const Size(1440, 1000));
    final container = ProviderScope.containerOf(tester.element(find.byType(KingdomConnectApp)));
    await container.read(settingsProvider.notifier).setThemeMode(ThemeMode.dark);
    await tester.pumpAndSettle();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
    expect(app.darkTheme!.brightness, Brightness.dark);
  });
}
