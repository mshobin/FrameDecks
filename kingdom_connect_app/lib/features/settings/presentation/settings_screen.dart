import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/security/permissions.dart';
import '../../../services/data_tools.dart';
import '../../../services/export/exporters.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  var _busy = false;
  var _personal = true;
  var _privatePrayer = false;

  Future<void> _run(Future<String?> Function() task) async {
    setState(() => _busy = true);
    try {
      final done = await task();
      if (mounted && done != null) showDone(context, done);
    } catch (e) {
      if (mounted) showFailure(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _backupToDevice() async =>
      'Backup saved: ${await ref.read(dataToolsProvider).backupTo(ref.read(localStorageProvider))}';

  Future<String?> _backupFile() async {
    final tools = ref.read(dataToolsProvider);
    final json = await tools.backupJson();
    final where = await FilePicker.saveFile(
      fileName: tools.backupFileName(),
      bytes: Uint8List.fromList(utf8.encode(json)),
      mimeType: 'application/json',
      dialogTitle: 'Save the backup',
    );
    return where == null ? null : 'Backup saved.';
  }

  Future<String?> _restore() async {
    final file = await FilePicker.pickFile(dialogTitle: 'Choose a Kingdom Connect backup', type: FileType.custom,
        allowedExtensions: const ['json']);
    if (file == null) return null;
    final n = await ref.read(dataToolsProvider).restore(utf8.decode(await file.readAsBytes()));
    return 'Restored $n records.';
  }

  Future<String?> _excel() async {
    final db = ref.read(databaseProvider);
    final options = ExportOptions(includePersonalData: _personal, includePrivatePrayer: _privatePrayer)
        .allowedFor(ref.read(currentUserProvider), ref.read(permissionPolicyProvider));
    final bytes = exportWorkbook(
      meetings: await db.meetings.all(),
      followUps: await db.followUps.all(),
      prayer: await db.prayer.all(),
      volunteers: await db.volunteers.all(),
      ministryNames: ref.read(ministryNamesProvider),
      options: options,
    );
    final where = await FilePicker.saveFile(
      fileName: 'Kingdom Connect report.xlsx',
      bytes: bytes,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Save the Excel report',
    );
    return where == null ? null : 'Excel report saved.';
  }

  Future<String?> _importWindows() async {
    var folder = DataTools.defaultWindowsDataFolder();
    if (folder == null) {
      final path = await FilePicker.getDirectoryPath(dialogTitle: 'Choose the Kingdom Connect data folder');
      if (path == null) return null;
      folder = Directory(path);
    }
    final result = await ref.read(dataToolsProvider).importWindowsFolder(folder);
    return [result.summary, ...result.problems].join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    final db = ref.watch(databaseProvider);
    final providers = ref.watch(storageProvidersProvider);
    final user = ref.watch(currentUserProvider);
    final canImport = ref.watch(permissionPolicyProvider).can(user, Permission.importData);
    final desktop = !kIsWeb && (Platform.isWindows || Platform.isMacOS || Platform.isLinux);

    return Scaffold(
      body: AbsorbPointer(
        absorbing: _busy,
        child: PageBody(maxWidth: 900, children: [
          const PageHeader(title: 'Settings', subtitle: 'Appearance, your church, and your data.'),
          if (_busy) const Padding(padding: EdgeInsets.only(top: KC.s3), child: LinearProgressIndicator()),
          const SizedBox(height: KC.s5),
          SectionCard(
            title: 'Church',
            child: TextFormField(
              initialValue: settings.churchName,
              decoration: const InputDecoration(labelText: 'Church or ministry name', prefixIcon: Icon(Icons.church_outlined)),
              onChanged: notifier.setChurchName,
            ),
          ),
          const SizedBox(height: KC.s4),
          SectionCard(
            title: 'Appearance',
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.system, label: Text('Automatic'), icon: Icon(Icons.brightness_auto)),
                ButtonSegment(value: ThemeMode.light, label: Text('Light'), icon: Icon(Icons.light_mode_outlined)),
                ButtonSegment(value: ThemeMode.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode_outlined)),
              ],
              selected: {settings.themeMode},
              onSelectionChanged: (s) => notifier.setThemeMode(s.first),
            ),
          ),
          const SizedBox(height: KC.s4),
          SectionCard(
            title: 'Your data',
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                db.isPersistent
                    ? 'Everything is stored on this device only. Nothing is sent anywhere.'
                    : 'In a web browser your data lasts until you close the tab. Save a backup file to keep it.',
              ),
              const SizedBox(height: KC.s4),
              Wrap(spacing: KC.s2, runSpacing: KC.s2, children: [
                if (desktop || (!kIsWeb && db.isPersistent))
                  FilledButton.icon(
                    onPressed: () => _run(_backupToDevice),
                    icon: const Icon(Icons.backup_outlined),
                    label: const Text('Back up now'),
                  ),
                OutlinedButton.icon(onPressed: () => _run(_backupFile), icon: const Icon(Icons.save_alt), label: const Text('Save a backup file')),
                OutlinedButton.icon(onPressed: () => _run(_restore), icon: const Icon(Icons.restore), label: const Text('Restore a backup')),
              ]),
            ]),
          ),
          const SizedBox(height: KC.s4),
          SectionCard(
            title: 'Export to Excel',
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Meetings, action items, follow-ups, prayer requests and volunteers, one sheet each.'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Include phone numbers, e-mail addresses and birthdays'),
                value: _personal,
                onChanged: (v) => setState(() => _personal = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Include private prayer requests'),
                value: _privatePrayer,
                onChanged: (v) => setState(() => _privatePrayer = v),
              ),
              const SizedBox(height: KC.s2),
              FilledButton.icon(onPressed: () => _run(_excel), icon: const Icon(Icons.table_view_outlined), label: const Text('Export to Excel')),
            ]),
          ),
          if (desktop && canImport) ...[
            const SizedBox(height: KC.s4),
            SectionCard(
              title: 'Kingdom Connect for Windows',
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Bring in the current meeting and the member list from the Windows program. Its files are '
                    'only read, never changed, so it keeps working exactly as before. Importing again updates the same records.'),
                const SizedBox(height: KC.s4),
                OutlinedButton.icon(
                  onPressed: () => _run(_importWindows),
                  icon: const Icon(Icons.download_outlined),
                  label: const Text('Import from the Windows app'),
                ),
              ]),
            ),
          ],
          const SizedBox(height: KC.s4),
          SectionCard(
            title: 'Storage and sync',
            child: Column(children: [
              for (final p in providers)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(p.isAvailable ? Icons.check_circle : Icons.cloud_off_outlined,
                      color: p.isAvailable ? KC.success : Theme.of(context).colorScheme.outline),
                  title: Text(p.displayName),
                  subtitle: Text(p.isAvailable ? 'In use: backups are kept on this device.' : (p.unavailableReason ?? '')),
                ),
            ]),
          ),
          const SizedBox(height: KC.s4),
          const SectionCard(
            title: 'About',
            child: Text('${AppConfig.appName} ${AppConfig.version} · local-first: no account, no cloud, no tracking.'),
          ),
        ]),
      ),
    );
  }
}
