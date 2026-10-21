import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engine/backend.dart';
import '../engine/cloud_client.dart';
import '../engine/model.dart';
import '../engine/scenes.dart' as sc;
import 'actions.dart';
import 'fields.dart';
import 'providers.dart';
import 'theme.dart';

const appVersion = '6.10';

/// Settings: Branding, the meeting profile, the Emergency screen's message, where everything is saved, the FrameDecks
/// account, the phone remote.
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
                          ? 'No logo yet. A logo set in FrameDecks on Windows shows here and on the program.'
                          : 'The logo comes from FrameDecks on Windows.',
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
                          ? 'In ${backend.file.path} — the same file format as FrameDecks on Windows (kc-saved-content.json), so you can copy it between computers.'
                          : 'FrameDecks on this PC keeps the file; this window shows and changes the same Frames.',
                      style: const TextStyle(color: K.muted, fontSize: 13, height: 1.45),
                    ),
                  ],
                ),
                _Section(
                  title: 'FrameDecks account',
                  children: [AccountPanel(link: ref.watch(cloudProvider), onThisPc: backend is EngineBackend)],
                ),
                const _Section(
                  title: 'Phone & iPad remote',
                  children: [
                    Text(
                      'Install FrameDecks on the phone or iPad, then enter the PC’s address and the 6-digit PIN shown in FrameDecks '
                      'on Windows (Settings → Phone & iPad Remote). The phone and the PC must be on the same Wi-Fi.',
                      style: TextStyle(color: K.muted, fontSize: 13, height: 1.45),
                    ),
                  ],
                ),
                const _Section(
                  title: 'About',
                  children: [
                    Text('FrameDecks $appVersion', style: TextStyle(fontWeight: FontWeight.w700)),
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

/// Settings → FrameDecks account, as on Windows (app/js/account-panel.js): sign in with an email code or in the browser
/// (Google, Microsoft, Apple), see what is synced, choose whether meeting details sync (off by default, D6), sign out.
class AccountPanel extends StatefulWidget {
  const AccountPanel({super.key, required this.link, this.onThisPc = false});

  final CloudLink? link;

  /// FrameDecks on this PC keeps the Frames (and its own sign-in).
  final bool onThisPc;

  @override
  State<AccountPanel> createState() => _AccountPanelState();
}

class _AccountPanelState extends State<AccountPanel> {
  final _email = TextEditingController(), _code = TextEditingController();
  var _step = 'email', _busy = false;
  String? _browserUrl;
  StreamSubscription<void>? _sub;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _sub = widget.link?.changes.listen((_) {
      if (mounted) setState(() {});
    });
    _tick = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) setState(() {}); // "Synced 2 min ago" keeps up
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _tick?.cancel();
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  void _toast(String text, {bool bad = false}) => toast(ScaffoldMessenger.maybeOf(context), text, bad: bad);

  Future<void> _act(Future<void> Function() fn) async {
    setState(() => _busy = true);
    try {
      await fn();
    } catch (e) {
      _toast(e.toString(), bad: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  static String ago(int t) {
    final s = ((DateTime.now().millisecondsSinceEpoch - t) / 1000).round().clamp(0, 1 << 31);
    if (t == 0) return 'not yet';
    if (s < 10) return 'just now';
    if (s < 60) return '$s s ago';
    if (s < 3600) return '${(s / 60).round()} min ago';
    return '${(s / 3600).round()} h ago';
  }

  static const _plain = TextStyle(color: K.muted, fontSize: 13, height: 1.45);
  static const _hint = TextStyle(color: K.faint, fontSize: 12.5, height: 1.4);

  Widget _alert(String text, {bool warn = false, String? bold}) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: warn ? const Color(0x1FDC2626) : K.raised,
      borderRadius: BorderRadius.circular(K.rSmall),
      border: Border.all(color: warn ? const Color(0x66DC2626) : K.line),
    ),
    child: Text.rich(
      TextSpan(
        children: [
          if (bold != null) TextSpan(text: bold, style: const TextStyle(fontWeight: FontWeight.w700)),
          TextSpan(text: text),
        ],
      ),
      style: TextStyle(color: warn ? K.redText : K.ink, fontSize: 13, height: 1.45),
    ),
  );

  Widget _field(TextEditingController c, String hint, {TextInputType? type, int? max, VoidCallback? onSubmit}) => SizedBox(
    width: 260,
    child: TextField(
      controller: c,
      keyboardType: type,
      maxLength: max,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(hintText: hint, counterText: ''),
      onSubmitted: (_) => onSubmit?.call(),
    ),
  );

  Widget _row(List<Widget> kids) => Wrap(spacing: 10, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: kids);

  @override
  Widget build(BuildContext context) {
    final link = widget.link;
    if (link == null) {
      return Text(
        widget.onThisPc
            ? 'FrameDecks on this PC keeps the Frames and their sync: sign in there (Settings → FrameDecks account).'
            : 'Sync is not available in this window.',
        style: _plain,
      );
    }
    final c = link.client;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final w in (c.signedIn ? _signedIn(link) : _signedOut(link)))
          Padding(padding: const EdgeInsets.only(bottom: 10), child: w),
        if (!c.signedIn && c.lastError.isNotEmpty) Text(c.lastError, style: _hint),
      ],
    );
  }

  List<Widget> _signedOut(CloudLink link) {
    final c = link.client;
    if (!c.configured) {
      return [
        _alert(
          'The FrameDecks cloud address comes with the version of FrameDecks that turns accounts on. Until then everything '
          'stays on this computer, as before.',
          bold: 'Not set up on this computer yet. ',
        ),
      ];
    }
    Future<void> start() => _act(() async {
      final r = await c.emailStart(_email.text);
      setState(() => _step = 'code');
      if (r['devCode'] != null) _toast('Test code: ${r['devCode']}');
    });
    Future<void> verify() => _act(() async {
      await c.emailVerify(_email.text, _code.text);
      _code.clear();
      setState(() => _step = 'email');
      _toast('Signed in. Your Frames are syncing.');
    });
    return [
      const Text(
        'One account keeps your Frames, Decks, templates and settings the same on every computer you sign in on. Media '
        'files, what is on screen and your members list stay on this computer.',
        style: _plain,
      ),
      if (_step == 'email')
        _row([
          _field(_email, 'you@example.org', type: TextInputType.emailAddress, onSubmit: _busy ? null : start),
          FilledButton(onPressed: _busy ? null : start, child: const Text('Email me a code')),
        ])
      else ...[
        Text('We sent a code to ${_email.text.trim()}. It works for 10 minutes.', style: _plain),
        _row([
          _field(_code, '6-digit code', type: TextInputType.number, max: 6, onSubmit: _busy ? null : verify),
          FilledButton(onPressed: _busy ? null : verify, child: const Text('Sign in')),
          TextButton(onPressed: () => setState(() => _step = 'email'), child: const Text('Use another email')),
        ]),
      ],
      const Text('Or continue in your browser:', style: _hint),
      _row([
        OutlinedButton(
          onPressed: _busy || c.browserSignIn
              ? null
              : () => _act(() async {
                  final url = await c.browserStart();
                  setState(() => _browserUrl = url);
                }),
          child: Text(c.browserSignIn ? 'Waiting for the browser…' : 'Google, Microsoft or Apple…'),
        ),
        if (c.browserSignIn) TextButton(onPressed: c.cancelBrowser, child: const Text('Cancel')),
      ]),
      // No browser opener in this app yet: the page's address is shown to open (or copy) by hand
      if (c.browserSignIn && _browserUrl != null) ...[
        const Text('Open this page in your browser to sign in:', style: _hint),
        _row([
          SelectableText(_browserUrl!, style: const TextStyle(fontSize: 13)),
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: _browserUrl!));
              _toast('Copied');
            },
            child: const Text('Copy link'),
          ),
        ]),
      ],
    ];
  }

  List<Widget> _signedIn(CloudLink link) {
    final c = link.client, info = link.info, ok = info.error.isEmpty;
    Future<void> setting({bool? syncMeeting, bool? pauseLive}) => _act(() async {
      await c.setSettings(syncMeeting: syncMeeting, pauseLive: pauseLive);
      _toast('Saved');
      unawaited(link.syncNow());
    });
    Widget fact(String k, String v) => Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text(k, style: const TextStyle(color: K.muted, fontSize: 13))),
          Expanded(child: Text(v, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600))),
        ],
      ),
    );
    final user = c.user;
    return [
      _row([
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: ok ? K.liveSoft : const Color(0x1FDC2626),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.circle, size: 8, color: ok ? K.liveText : K.redText),
              const SizedBox(width: 6),
              Text(ok ? 'Synced ${ago(info.lastSync)}' : 'Not synced', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
        OutlinedButton(onPressed: _busy ? null : () => _act(link.syncNow), child: const Text('Sync now')),
      ]),
      if (!ok) _alert('${info.error} Presenting is not affected; it tries again in a minute.', warn: true),
      if (info.copies.isNotEmpty) _alert('Changed on two computers at once, so both were kept: ${info.copies.join(', ')}.'),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          fact('Signed in as', (user?['email'] ?? user?['name'] ?? '').toString()),
          fact('Ministry', (c.workspace?['name'] ?? '').toString()),
          fact('This computer', c.computerName),
        ],
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CheckRow(value: c.syncMeeting, label: 'Sync meeting details', onChanged: (v) => setting(syncMeeting: v)),
          const Padding(
            padding: EdgeInsets.only(left: 36),
            child: Text('(presenter, contact, attendees, notes). Off unless you turn it on.', style: _hint),
          ),
        ],
      ),
      CheckRow(value: c.pauseLive, label: 'Pause sync while something is on screen', onChanged: (v) => setting(pauseLive: v)),
      const Text(
        'Synced: Frames with their Decks and Content, templates, saved questions and scriptures, branding, layout and card '
        'looks. Never synced: media files, what is on screen, your members list.',
        style: _hint,
      ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: () async {
            final yes = await showDialog<bool>(
              context: context,
              builder: (d) => AlertDialog(
                content: const Text('Sign this computer out? Your Frames stay on it.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
                  FilledButton(onPressed: () => Navigator.pop(d, true), child: const Text('Sign out')),
                ],
              ),
            );
            if (yes == true) {
              await _act(() async {
                await c.logout();
                _toast('Signed out');
              });
            }
          },
          child: const Text('Sign out of this computer'),
        ),
      ),
    ];
  }
}
