import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'data/database/app_database.dart';
import 'services/settings/app_settings.dart';
import 'shared/providers.dart';

/// Start-up (budget: under 2 s to the dashboard). The database and the preferences open in parallel; nothing else
/// waits before the first frame (the engine status, charts and lists load lazily).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final results = await Future.wait<Object>([AppDatabase.open(), SharedPreferences.getInstance()]);
  runApp(ProviderScope(
    overrides: [
      databaseProvider.overrideWithValue(results[0] as AppDatabase),
      settingsStoreProvider.overrideWithValue(SettingsStore(results[1] as SharedPreferences)),
    ],
    child: const KingdomConnectApp(),
  ));
}
