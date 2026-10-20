import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/audit/audit_log.dart';
import '../core/config/app_config.dart';
import '../core/security/permissions.dart';
import '../core/utils/clock.dart';
import '../data/database/app_database.dart';
import '../data/models/meeting.dart';
import '../data/models/records.dart';
import '../features/dashboard/application/dashboard_metrics.dart';
import '../services/data_tools.dart';
import '../services/engine/engine_client.dart';
import '../services/settings/app_settings.dart';
import '../services/storage/storage_provider.dart';

/// The database. main.dart (and tests) override this with the opened [AppDatabase].
final databaseProvider = Provider<AppDatabase>((ref) => throw StateError('databaseProvider is set in main.dart'));

/// Preferences. main.dart (and tests) override this.
final settingsStoreProvider = Provider<SettingsStore>((ref) => throw StateError('settingsStoreProvider is set in main.dart'));

final clockProvider = Provider<Clock>((ref) => const SystemClock());

final currentUserProvider = Provider<AppUser>((ref) => AppUser.owner);

final permissionPolicyProvider = Provider<PermissionPolicy>((ref) => const OpenPolicy());

class SettingsNotifier extends Notifier<AppSettings> {
  @override
  AppSettings build() => ref.watch(settingsStoreProvider).read();

  Future<void> update(AppSettings next) async {
    state = next;
    await ref.read(settingsStoreProvider).write(next);
  }

  Future<void> setThemeMode(ThemeMode mode) => update(state.copyWith(themeMode: mode));

  Future<void> setChurchName(String name) => update(state.copyWith(churchName: name.trim()));
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);

// ---------- live lists (update on every change) ----------
final meetingsProvider = StreamProvider<List<Meeting>>((ref) => ref.watch(databaseProvider).meetings.watchAll());
final ministriesProvider = StreamProvider<List<Ministry>>((ref) => ref.watch(databaseProvider).ministries.watchAll());
final followUpsProvider = StreamProvider<List<FollowUp>>((ref) => ref.watch(databaseProvider).followUps.watchAll());
final prayerProvider = StreamProvider<List<PrayerRequest>>((ref) => ref.watch(databaseProvider).prayer.watchAll());
final volunteersProvider = StreamProvider<List<Volunteer>>((ref) => ref.watch(databaseProvider).volunteers.watchAll());
final schedulesProvider =
    StreamProvider<List<ServiceSchedule>>((ref) => ref.watch(databaseProvider).schedules.watchAll());

final recentActivityProvider = StreamProvider<List<AuditEvent>>(
    (ref) => ref.watch(databaseProvider).audit.watchRecent(AppConfig.recentActivity));

final auditLogProvider = Provider<AuditLog>((ref) => ref.watch(databaseProvider).audit);

/// Ministry uid → name, for labels.
final ministryNamesProvider = Provider<Map<String, String>>((ref) {
  final list = ref.watch(ministriesProvider).value ?? const <Ministry>[];
  return {for (final m in list) m.uid: m.name};
});

/// TAB 1: everything the dashboard shows. Null while the lists are still loading.
final dashboardProvider = Provider<DashboardMetrics?>((ref) {
  final meetings = ref.watch(meetingsProvider).value;
  final ministries = ref.watch(ministriesProvider).value;
  final followUps = ref.watch(followUpsProvider).value;
  final volunteers = ref.watch(volunteersProvider).value;
  final prayer = ref.watch(prayerProvider).value;
  if (meetings == null || ministries == null || followUps == null || volunteers == null || prayer == null) return null;
  return DashboardMetrics.compute(
    meetings: meetings,
    ministries: ministries,
    followUps: followUps,
    volunteers: volunteers,
    prayer: prayer,
    now: ref.watch(clockProvider).now(),
    weeks: AppConfig.trendWeeks,
  );
});

// ---------- platform services ----------
final engineClientProvider = Provider<EngineClient>((ref) {
  final c = EngineClient();
  ref.onDispose(c.close);
  return c;
});

/// The Windows presentation engine's status. Not on the web or on phones (it only runs on a PC).
final engineStatusProvider = FutureProvider<EngineStatus>((ref) async {
  if (kIsWeb || defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS) {
    return const EngineStatus.notRunning();
  }
  return ref.watch(engineClientProvider).status();
});

final localStorageProvider = Provider<StorageProvider>((ref) => LocalProvider());

/// Every storage provider; only the local one is available until sync exists (plan §4, Phase 5).
final storageProvidersProvider = Provider<List<StorageProvider>>((ref) => [
      ref.watch(localStorageProvider),
      oneDriveProvider,
      sharePointProvider,
      googleDriveProvider,
      iCloudProvider,
    ]);

final dataToolsProvider = Provider<DataTools>((ref) => DataTools(
      db: ref.watch(databaseProvider),
      clock: ref.watch(clockProvider),
      user: ref.watch(currentUserProvider),
      policy: ref.watch(permissionPolicyProvider),
    ));
