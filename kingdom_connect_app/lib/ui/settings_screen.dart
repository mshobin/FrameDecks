import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engine/backend.dart';
import '../engine/model.dart';
import '../engine/scenes.dart' as sc;
import 'actions.dart';
import 'camera/mac_camera.dart';
import 'fields.dart';
import 'providers.dart';
import 'theme.dart';

const appVersion = '6.10';

/// Settings: Branding, the meeting profile, the Emergency screen's message, where everything is saved, the phone remote.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key, required this.state});

  final Json state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = state['brand'] as Json;
    final backend = ref.watch(backendProvider);
    Future<bool> brand(String k, Object v) => act(ref, context, (n) => (n['brand'] as Json)[k] = v);
    return ListView(
      padding: const EdgeInsets.all(28),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 820),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Settings', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                const SizedBox(height: 20),
                _Section(
                  title: 'Branding',
                  children: [
                    StateField(
                      label: 'Meeting name',
                      value: b['meeting'] as String,
                      hint: 'Tuesday Bible Study',
                      onSave: (v) => brand('meeting', v.trim()),
                    ),
                    StateField(label: 'Organisation', value: b['org'] as String, onSave: (v) => brand('org', v.trim())),
                    CheckRow(value: b['auto'] == true, label: 'Put the Branding badge on every new Frame', onChanged: (v) => brand('auto', v)),
                    Text(
                      (b['logo'] ?? '').toString().isEmpty
                          ? 'No logo yet. A logo set in Kingdom Connect on Windows shows here and on the program.'
                          : 'The logo comes from Kingdom Connect on Windows.',
                      style: const TextStyle(color: K.muted, fontSize: 12.5),
                    ),
                  ],
                ),
                _Section(
                  title: 'Meeting profile',
                  children: [
                    SelectRow<String>(
                      label: 'The default transition of every Frame',
                      value: state['profile'] as String,
                      items: [for (final p in profiles) (p.id, '${p.name} · ${sc.txName(p.type)}${p.ms > 0 ? ' ${p.ms} ms' : ''}')],
                      onChanged: (v) => act(ref, context, (n) => n['profile'] = v),
                    ),
                  ],
                ),
                _Section(
                  title: 'Emergency screen',
                  children: [
                    StateField(
                      label: 'Message',
                      value: (sc.liveOf(state)['message'] ?? '').toString(),
                      onSave: (v) =>
                          act(ref, context, (n) => sc.liveOf(n)['message'] = v.trim().isEmpty ? 'Please stand by — we’ll be right back.' : v.trim()),
                    ),
                  ],
                ),
                _Section(
                  title: 'Where your Frames are saved',
                  children: [
                    Text(backend.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(
                      backend is LocalBackend
                          ? 'In ${backend.file.path} — the same file format as Kingdom Connect on Windows (kc-saved-content.json), so you can copy it between computers.'
                          : 'Kingdom Connect on this PC keeps the file; this window shows and changes the same Frames.',
                      style: const TextStyle(color: K.muted, fontSize: 13, height: 1.45),
                    ),
                  ],
                ),
                if (MacCamera.available) const _Section(title: 'KingdomConnect camera', children: [_MacCameraSettings()]),
                const _Section(
                  title: 'Phone & iPad remote',
                  children: [
                    Text(
                      'Install Kingdom Connect on the phone or iPad, then enter the PC’s address and the 6-digit PIN shown in Kingdom Connect '
                      'on Windows (Settings → Phone & iPad Remote). The phone and the PC must be on the same Wi-Fi.',
                      style: TextStyle(color: K.muted, fontSize: 13, height: 1.45),
                    ),
                  ],
                ),
                const _Section(
                  title: 'About',
                  children: [
                    Text('Kingdom Connect $appVersion', style: TextStyle(fontWeight: FontWeight.w700)),
                    Text(
                      'The same Studio on Windows, macOS and Linux; a remote control on iPhone, iPad and Android.',
                      style: TextStyle(color: K.muted, fontSize: 13),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: K.surface,
      borderRadius: BorderRadius.circular(K.r),
      border: Border.all(color: K.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Eyebrow(title),
        const SizedBox(height: 12),
        for (final c in children) Padding(padding: const EdgeInsets.only(bottom: 10), child: c),
      ],
    ),
  );
}

/// Install or remove the KingdomConnect camera on the Mac, and what it is doing.
class _MacCameraSettings extends StatefulWidget {
  const _MacCameraSettings();

  @override
  State<_MacCameraSettings> createState() => _MacCameraSettingsState();
}

class _MacCameraSettingsState extends State<_MacCameraSettings> {
  final _camera = MacCamera();
  CameraStatus? _status;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _refresh();
    _poll = Timer.periodic(const Duration(seconds: 2), (_) => _refresh());
  }

  Future<void> _refresh() async {
    final s = await _camera.status();
    if (mounted) setState(() => _status = s);
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _status;
    if (s == null) return const Text('Checking…', style: TextStyle(color: K.muted, fontSize: 13));
    final state = !s.supported
        ? 'Not available on this Mac.'
        : !s.installed
        ? 'Not installed.'
        : s.watched
        ? 'On: an app is showing the KingdomConnect camera.'
        : 'Installed. Choose “KingdomConnect” as the camera in Zoom, Teams or FaceTime.';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(state, style: const TextStyle(fontWeight: FontWeight.w700)),
        if (s.message.isNotEmpty) ...[const SizedBox(height: 4), Text(s.message, style: const TextStyle(color: K.muted, fontSize: 13, height: 1.45))],
        const SizedBox(height: 10),
        const Text(
          'The camera shows your program — the cards, branding and Black screen — to Zoom, Teams, FaceTime and other apps. '
          'macOS asks you to allow it once (System Settings → General → Login Items & Extensions → Camera Extensions).',
          style: TextStyle(color: K.muted, fontSize: 13, height: 1.45),
        ),
        if (s.supported) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              KButton(
                gold: !s.installed,
                onPressed: () async {
                  await (s.installed ? _camera.uninstall() : _camera.install());
                  await _refresh();
                },
                child: Text(s.installed ? 'Remove the camera' : 'Install the camera'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
