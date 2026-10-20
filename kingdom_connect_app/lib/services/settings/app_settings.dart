import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Small preferences (SharedPreferences): theme, the church's name, the storage provider. Nothing personal.
class AppSettings {
  const AppSettings({this.themeMode = ThemeMode.system, this.churchName = '', this.storageProviderId = 'local'});

  final ThemeMode themeMode;
  final String churchName;
  final String storageProviderId;

  AppSettings copyWith({ThemeMode? themeMode, String? churchName, String? storageProviderId}) => AppSettings(
        themeMode: themeMode ?? this.themeMode,
        churchName: churchName ?? this.churchName,
        storageProviderId: storageProviderId ?? this.storageProviderId,
      );
}

class SettingsStore {
  SettingsStore(this._prefs);

  final SharedPreferences _prefs;

  static const _theme = 'kc.themeMode', _church = 'kc.churchName', _provider = 'kc.storageProvider';

  AppSettings read() => AppSettings(
        themeMode: ThemeMode.values.firstWhere((m) => m.name == _prefs.getString(_theme), orElse: () => ThemeMode.system),
        churchName: _prefs.getString(_church) ?? '',
        storageProviderId: _prefs.getString(_provider) ?? 'local',
      );

  Future<void> write(AppSettings s) async {
    await _prefs.setString(_theme, s.themeMode.name);
    await _prefs.setString(_church, s.churchName);
    await _prefs.setString(_provider, s.storageProviderId);
  }
}

/// Secrets (the OS keychain / credential store): future cloud tokens and enterprise sign-in. Kept apart from the
/// settings so they are never in a backup or an export.
class SecretStore {
  SecretStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  Future<String?> read(String key) => _storage.read(key: 'kc.$key');

  Future<void> write(String key, String value) => _storage.write(key: 'kc.$key', value: value);

  Future<void> delete(String key) => _storage.delete(key: 'kc.$key');
}
