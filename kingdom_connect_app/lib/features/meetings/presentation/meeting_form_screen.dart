import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing/printing.dart';

import '../../../core/utils/clock.dart';
import '../../../core/utils/ids.dart';
import '../../../data/models/meeting.dart';
import '../../../data/models/records.dart';
import '../../../services/export/exporters.dart';
import '../../../shared/providers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../application/meeting_sections.dart';

/// TAB 2: the Meeting Form. One column of five section cards; each shows whether it is filled in and folds away.
/// It edits a copy: nothing is stored until Save, and leaving with unsaved changes asks first.
class MeetingFormScreen extends ConsumerStatefulWidget {
  const MeetingFormScreen({super.key, this.uid, this.ministryUid});

  /// The meeting to edit; null for a new one.
  final String? uid;
  final String? ministryUid;

  @override
  ConsumerState<MeetingFormScreen> createState() => _MeetingFormScreenState();
}

class _MeetingFormScreenState extends ConsumerState<MeetingFormScreen> {
  Meeting? _draft;
  var _loading = true;
  var _dirty = false;
  var _saving = false;
  final _open = <MeetingSection>{MeetingSection.details};
  final _keys = {for (final s in MeetingSection.values) s: GlobalKey()};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    Meeting? m;
    if (widget.uid != null) {
      final stored = await ref.read(databaseProvider).meetings.byUid(widget.uid!);
      if (stored != null) m = copyMeeting(stored);
    }
    m ??= Meeting()
      ..date = dayOf(ref.read(clockProvider).now())
      ..ministryUid = widget.ministryUid;
    if (widget.uid != null && m.name.isNotEmpty) _open.addAll(MeetingSection.values);
    if (mounted) {
      setState(() {
        _draft = m;
        _loading = false;
      });
    }
  }

  bool get _isNew => widget.uid == null;

  void _change(void Function(Meeting m) edit) => setState(() {
        edit(_draft!);
        _dirty = true;
      });

  Future<void> _save() async {
    final m = _draft!;
    final problem = validateMeeting(m);
    if (problem != null) {
      setState(() => _open.add(MeetingSection.details));
      showFailure(context, problem);
      return;
    }
    setState(() => _saving = true);
    try {
      final saved = await ref.read(databaseProvider).meetings.save(m);
      if (!mounted) return;
      setState(() {
        _dirty = false;
        _saving = false;
      });
      showDone(context, _isNew ? 'Meeting saved' : 'Changes saved');
      if (_isNew) context.go('/meetings/${saved.uid}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showFailure(context, e);
    }
  }

  Future<void> _delete() async {
    if (!await confirm(context, title: 'Delete this meeting?', message: 'It disappears from every list and the dashboard.')) return;
    await ref.read(databaseProvider).meetings.delete(widget.uid!);
    if (mounted) context.go('/meetings');
  }

  Future<void> _pdf() async {
    final m = _draft!;
    final bytes = await exportMeetingPdf(m,
        ministry: ref.read(ministryNamesProvider)[m.ministryUid] ?? '', church: ref.read(settingsProvider).churchName);
    await Printing.sharePdf(bytes: bytes, filename: '${m.displayTitle.replaceAll(RegExp(r'[^\w\- ]'), '')}.pdf');
  }

  Future<bool> _confirmLeave() async =>
      !_dirty ||
      await confirm(context, title: 'Leave without saving?', message: 'Your changes to this meeting are not saved yet.', ok: 'Leave');

  void _jump(MeetingSection s) {
    setState(() => _open.add(s));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _keys[s]!.currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), alignment: 0.05);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final m = _draft!;
    final wide = isWide(context);
    final sections = [
      for (final s in MeetingSection.values)
        Padding(
          key: _keys[s],
          padding: const EdgeInsets.only(bottom: KC.s4),
          child: _SectionPanel(
            section: s,
            complete: isSectionComplete(m, s),
            open: _open.contains(s),
            onToggle: () => setState(() => _open.contains(s) ? _open.remove(s) : _open.add(s)),
            child: switch (s) {
              MeetingSection.details => _Details(m, _change),
              MeetingSection.attendees => _Attendees(m, _change),
              MeetingSection.discussion => _Discussion(m, _change),
              MeetingSection.actionItems => _Actions(m, _change),
              MeetingSection.spiritual => _Spiritual(m, _change),
            },
          ),
        ),
    ];

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop && await _confirmLeave() && context.mounted) context.go('/meetings');
      },
      child: CallbackShortcuts(
        bindings: {const SingleActivator(LogicalKeyboardKey.keyS, control: true): _save},
        child: Focus(
          autofocus: true,
          child: Scaffold(
            appBar: AppBar(
              leading: IconButton(
                tooltip: 'Back to meetings',
                icon: const Icon(Icons.arrow_back),
                onPressed: () async {
                  if (await _confirmLeave() && context.mounted) context.go('/meetings');
                },
              ),
              title: Text(_isNew ? 'New meeting' : m.displayTitle, overflow: TextOverflow.ellipsis),
              actions: [
                if (!_isNew) ...[
                  IconButton(tooltip: 'Share as PDF', icon: const Icon(Icons.picture_as_pdf_outlined), onPressed: _pdf),
                  IconButton(tooltip: 'Delete meeting', icon: const Icon(Icons.delete_outline), onPressed: _delete),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: KC.s3),
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.check),
                    label: const Text('Save'),
                  ),
                ),
              ],
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(4),
                child: LinearProgressIndicator(
                  value: completeness(m),
                  minHeight: 4,
                  semanticsLabel: 'Meeting form ${(completeness(m) * 100).round()} % complete',
                ),
              ),
            ),
            body: SingleChildScrollView(
              padding: EdgeInsets.all(isCompact(context) ? KC.s4 : KC.s6),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: wide ? KC.formWidth + 280 + KC.s6 : KC.formWidth),
                  child: wide
                      ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Expanded(child: Column(children: sections)),
                          const SizedBox(width: KC.s6),
                          SizedBox(width: 280, child: _Outline(meeting: m, onJump: _jump)),
                        ])
                      : Column(children: sections),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

typedef _Edit = void Function(void Function(Meeting m) edit);

/// One section of the form: its title, a completeness tick and its fields (folds open and closed).
class _SectionPanel extends StatelessWidget {
  const _SectionPanel({
    required this.section,
    required this.complete,
    required this.open,
    required this.onToggle,
    required this.child,
  });

  final MeetingSection section;
  final bool complete;
  final bool open;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        InkWell(
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.all(KC.s4 + KC.s1),
            child: Row(children: [
              Icon(complete ? Icons.check_circle : Icons.radio_button_unchecked,
                  color: complete ? KC.success : c.outline, semanticLabel: complete ? 'Complete' : 'Not filled in yet'),
              const SizedBox(width: KC.s3),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(section.title, style: Theme.of(context).textTheme.titleMedium),
                  Text(section.hint, style: TextStyle(color: c.onSurfaceVariant, fontSize: 13)),
                ]),
              ),
              Icon(open ? Icons.expand_less : Icons.expand_more),
            ]),
          ),
        ),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 180),
          crossFadeState: open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
          firstChild: const SizedBox(width: double.infinity),
          secondChild: Padding(padding: const EdgeInsets.fromLTRB(KC.s5, 0, KC.s5, KC.s5), child: child),
        ),
      ]),
    );
  }
}

/// Text field bound to a draft value. Keeps its own controller so typing never loses the cursor.
class _Text extends StatefulWidget {
  const _Text(this.label, this.value, this.onChanged, {this.lines = 1, this.icon, this.hint, this.keyboard});

  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final int lines;
  final IconData? icon;
  final String? hint;
  final TextInputType? keyboard;

  @override
  State<_Text> createState() => _TextState();
}

class _TextState extends State<_Text> {
  late final _c = TextEditingController(text: widget.value);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: KC.s4),
        child: TextField(
          controller: _c,
          minLines: widget.lines,
          maxLines: widget.lines == 1 ? 1 : widget.lines + 4,
          keyboardType: widget.keyboard ?? (widget.lines > 1 ? TextInputType.multiline : TextInputType.text),
          textInputAction: widget.lines > 1 ? TextInputAction.newline : TextInputAction.next,
          decoration: InputDecoration(
            labelText: widget.label,
            hintText: widget.hint,
            alignLabelWithHint: widget.lines > 1,
            prefixIcon: widget.icon == null ? null : Icon(widget.icon),
          ),
          onChanged: widget.onChanged,
        ),
      );
}

class _Number extends StatelessWidget {
  const _Number(this.label, this.value, this.onChanged, {required this.icon});

  final String label;
  final int value;
  final ValueChanged<int> onChanged;
  final IconData icon;

  @override
  Widget build(BuildContext context) => _Text(
        label,
        value == 0 ? '' : '$value',
        (v) => onChanged(int.tryParse(v.trim()) ?? 0),
        icon: icon,
        hint: '0',
        keyboard: TextInputType.number,
      );
}

class _Details extends ConsumerWidget {
  const _Details(this.m, this.edit);

  final Meeting m;
  final _Edit edit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ministries = ref.watch(ministriesProvider).value ?? const <Ministry>[];
    final active = ministries.where((x) => x.active || x.uid == m.ministryUid).toList()..sort((a, b) => a.name.compareTo(b.name));
    final twoCols = !isCompact(context);
    final date = DateField(label: 'Date', value: m.date, allowClear: false, onChanged: (d) => edit((x) => x.date = d));
    final time = _Text('Time', m.startTime, (v) => edit((x) => x.startTime = v), icon: Icons.schedule, hint: '19:00');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _Text('Meeting name', m.name, (v) => edit((x) => x.name = v), icon: Icons.title, hint: 'e.g. Youth leaders · March'),
      Padding(
        padding: const EdgeInsets.only(bottom: KC.s4),
        child: DropdownButtonFormField<String?>(
          initialValue: active.any((x) => x.uid == m.ministryUid) ? m.ministryUid : null,
          decoration: const InputDecoration(labelText: 'Ministry', prefixIcon: Icon(Icons.church_outlined)),
          items: [
            const DropdownMenuItem<String?>(value: null, child: Text('No particular ministry')),
            for (final x in active) DropdownMenuItem<String?>(value: x.uid, child: Text(x.name)),
          ],
          onChanged: (v) => edit((x) => x.ministryUid = v),
        ),
      ),
      if (twoCols)
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Padding(padding: const EdgeInsets.only(bottom: KC.s4), child: date)),
          const SizedBox(width: KC.s4),
          Expanded(child: time),
        ])
      else ...[
        Padding(padding: const EdgeInsets.only(bottom: KC.s4), child: date),
        time,
      ],
      _Text('Location', m.location, (v) => edit((x) => x.location = v), icon: Icons.place_outlined,
          hint: 'Fellowship hall, or a Zoom / Teams link'),
      _Text('Speaker or leader', m.speaker, (v) => edit((x) => x.speaker = v), icon: Icons.record_voice_over_outlined),
      Padding(
        padding: const EdgeInsets.only(bottom: KC.s2),
        child: SegmentedButton<MeetingStatus>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(value: MeetingStatus.draft, label: Text('Draft')),
            ButtonSegment(value: MeetingStatus.planned, label: Text('Planned')),
            ButtonSegment(value: MeetingStatus.held, label: Text('Held')),
          ],
          selected: {m.status},
          onSelectionChanged: (s) => edit((x) => x.status = s.first),
        ),
      ),
    ]);
  }
}

class _Attendees extends StatelessWidget {
  const _Attendees(this.m, this.edit);

  final Meeting m;
  final _Edit edit;

  @override
  Widget build(BuildContext context) {
    final fields = [
      _Number('Attendance', m.attendance.count, (v) => edit((x) => x.attendance.count = v), icon: Icons.groups_outlined),
      _Number('Visitors', m.attendance.visitors, (v) => edit((x) => x.attendance.visitors = v), icon: Icons.waving_hand_outlined),
      _Number('New members', m.attendance.newMembers, (v) => edit((x) => x.attendance.newMembers = v),
          icon: Icons.person_add_alt),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (isCompact(context))
        ...fields
      else
        Row(children: [
          for (var i = 0; i < fields.length; i++) ...[
            if (i > 0) const SizedBox(width: KC.s4),
            Expanded(child: fields[i]),
          ],
        ]),
      _Text('Attendance notes', m.attendance.notes, (v) => edit((x) => x.attendance.notes = v), lines: 2),
    ]);
  }
}

class _Discussion extends StatelessWidget {
  const _Discussion(this.m, this.edit);

  final Meeting m;
  final _Edit edit;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _Text('Agenda', m.discussion.agenda, (v) => edit((x) => x.discussion.agenda = v), lines: 3,
            hint: 'One topic per line'),
        _Text('Notes', m.discussion.notes, (v) => edit((x) => x.discussion.notes = v), lines: 4),
        _Text('Decisions', m.discussion.decisions, (v) => edit((x) => x.discussion.decisions = v), lines: 3),
      ]);
}

class _Actions extends StatelessWidget {
  const _Actions(this.m, this.edit);

  final Meeting m;
  final _Edit edit;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (m.actionItems.isEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: KC.s3),
          child: Text('No action items yet.', style: TextStyle(color: c.onSurfaceVariant)),
        ),
      for (final a in m.actionItems)
        Card(
          key: ValueKey(a.uid),
          color: c.surfaceContainerHighest.withValues(alpha: 0.35),
          margin: const EdgeInsets.only(bottom: KC.s3),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(KC.s4, KC.s4, KC.s2, 0),
            child: Column(children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: _Text('What needs doing', a.title, (v) => edit((_) => a.title = v), icon: Icons.task_alt)),
                IconButton(
                  tooltip: 'Remove this action item',
                  icon: const Icon(Icons.close),
                  onPressed: () => edit((x) => x.actionItems = [...x.actionItems]..remove(a)),
                ),
              ]),
              Padding(
                padding: const EdgeInsets.only(right: KC.s3),
                child: Wrap(spacing: KC.s4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  SizedBox(width: 220, child: _Text('Owner', a.owner, (v) => edit((_) => a.owner = v), icon: Icons.person_outline)),
                  SizedBox(
                    width: 220,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: KC.s4),
                      child: DateField(label: 'Due', value: a.dueDate, onChanged: (d) => edit((_) => a.dueDate = d)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: KC.s4),
                    child: SegmentedButton<ActionStatus>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(value: ActionStatus.open, label: Text('Open')),
                        ButtonSegment(value: ActionStatus.inProgress, label: Text('Doing')),
                        ButtonSegment(value: ActionStatus.done, label: Text('Done')),
                      ],
                      selected: {a.status},
                      onSelectionChanged: (s) => edit((_) => a.status = s.first),
                    ),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: () => edit((x) => x.actionItems = [...x.actionItems, ActionItem()..uid = newUid()]),
          icon: const Icon(Icons.add),
          label: const Text('Add an action item'),
        ),
      ),
    ]);
  }
}

class _Spiritual extends StatelessWidget {
  const _Spiritual(this.m, this.edit);

  final Meeting m;
  final _Edit edit;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _Text('Prayer requests', m.spiritual.prayerRequests, (v) => edit((x) => x.spiritual.prayerRequests = v),
            lines: 3, icon: Icons.volunteer_activism_outlined),
        _Text('Testimonies', m.spiritual.testimonies, (v) => edit((x) => x.spiritual.testimonies = v),
            lines: 3, icon: Icons.auto_awesome_outlined),
        _Text('People to follow up', m.spiritual.followUps, (v) => edit((x) => x.spiritual.followUps = v),
            lines: 3, icon: Icons.connect_without_contact, hint: 'Names, and why. Add them to Follow-ups to track them.'),
      ]);
}

/// Desktop only: the sections with their state, to jump between them.
class _Outline extends StatelessWidget {
  const _Outline({required this.meeting, required this.onJump});

  final Meeting meeting;
  final ValueChanged<MeetingSection> onJump;

  @override
  Widget build(BuildContext context) {
    final pct = (completeness(meeting) * 100).round();
    return SectionCard(
      title: 'This meeting',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$pct % complete', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: KC.s3),
        for (final s in MeetingSection.values)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: Icon(isSectionComplete(meeting, s) ? Icons.check_circle : Icons.radio_button_unchecked,
                size: 20, color: isSectionComplete(meeting, s) ? KC.success : null),
            title: Text(s.title),
            onTap: () => onJump(s),
          ),
        const Divider(height: KC.s5),
        Text('Ctrl+S saves.', style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}
