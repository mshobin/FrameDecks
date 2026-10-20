import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/errors/app_failure.dart';
import '../theme/app_theme.dart';

final dayFormat = DateFormat('EEE d MMM yyyy');
final shortDay = DateFormat('d MMM');

String formatDay(DateTime? d) => d == null ? 'No date' : dayFormat.format(d);

bool isWide(BuildContext context) => MediaQuery.sizeOf(context).width >= KC.desktopWidth;
bool isCompact(BuildContext context) => MediaQuery.sizeOf(context).width < KC.tabletWidth;

/// The top of every page: a title, a line of context and the page's actions.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.actions = const []});

  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final heading = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: isCompact(context) ? t.headlineSmall : t.headlineMedium),
      if (subtitle != null)
        Padding(
          padding: const EdgeInsets.only(top: KC.s1),
          child: Text(subtitle!, style: t.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
    ]);
    if (actions.isEmpty) return heading;
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: KC.s3,
      spacing: KC.s4,
      children: [heading, Wrap(spacing: KC.s2, runSpacing: KC.s2, children: actions)],
    );
  }
}

/// A content card with an optional title row.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.trailing, required this.child, this.padding = KC.s5});

  final String? title;
  final Widget? trailing;
  final Widget child;
  final double padding;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: EdgeInsets.all(padding),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            if (title != null)
              Padding(
                padding: const EdgeInsets.only(bottom: KC.s4),
                child: Row(children: [
                  Expanded(child: Text(title!, style: Theme.of(context).textTheme.titleMedium)),
                  ?trailing,
                ]),
              ),
            child,
          ]),
        ),
      );
}

/// What to show when a list is empty: what it is for and the next step.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KC.s6),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CircleAvatar(radius: 32, backgroundColor: c.primary.withValues(alpha: 0.1), child: Icon(icon, size: 30, color: c.primary)),
            const SizedBox(height: KC.s4),
            Text(title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: KC.s2),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: c.onSurfaceVariant)),
            if (action != null) ...[const SizedBox(height: KC.s5), action!],
          ]),
        ),
      ),
    );
  }
}

/// A small coloured status label.
class StatusPill extends StatelessWidget {
  const StatusPill(this.label, {super.key, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: KC.s2 + 2, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(99)),
        child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
      );
}

/// Page body: scrolls, centred, with the page padding of the 8 px grid.
class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children, this.maxWidth = 1280});

  final List<Widget> children;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final pad = isCompact(context) ? KC.s4 : KC.s6;
    return ListView(
      padding: EdgeInsets.fromLTRB(pad, pad, pad, KC.s8 + KC.s6),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
          ),
        ),
      ],
    );
  }
}

/// Shows a failure in plain words: a message ([String]), an [AppFailure], or any other error.
void showFailure(BuildContext context, Object error) {
  final message = switch (error) {
    final String m => m,
    final AppFailure f => f.message,
    _ => 'Something went wrong: $error',
  };
  _say(context, message);
}

void showDone(BuildContext context, String message) => _say(context, message);

/// One message at a time: a new one replaces the one showing (a stale warning never delays "Saved").
void _say(BuildContext context, String message) => ScaffoldMessenger.of(context)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));

/// Asks before something that cannot be undone from the screen.
Future<bool> confirm(BuildContext context, {required String title, required String message, String ok = 'Delete'}) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(ok)),
        ],
      ),
    ) ??
    false;

/// Opens an editor: a full-height sheet on phones, a dialog on tablets and desktops.
Future<T?> showEditor<T>(BuildContext context, {required String title, required Widget Function(BuildContext) builder}) {
  if (isCompact(context)) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (c) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(c).bottom),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(KC.s5, 0, KC.s5, KC.s5),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: KC.s4),
            builder(c),
          ]),
        ),
      ),
    );
  }
  return showDialog<T>(
    context: context,
    builder: (c) => Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(KC.s6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: KC.s5),
            builder(c),
          ]),
        ),
      ),
    ),
  );
}

/// A date field that opens the platform date picker.
class DateField extends StatelessWidget {
  const DateField({super.key, required this.label, required this.value, required this.onChanged, this.allowClear = true});

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final bool allowClear;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(KC.radiusSmall),
        onTap: () async {
          final now = DateTime.now();
          final picked = await showDatePicker(
            context: context,
            initialDate: value ?? now,
            firstDate: DateTime(now.year - 20),
            lastDate: DateTime(now.year + 5),
          );
          if (picked != null) onChanged(picked);
        },
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            prefixIcon: const Icon(Icons.event_outlined),
            suffixIcon: value != null && allowClear
                ? IconButton(tooltip: 'Clear the date', icon: const Icon(Icons.close), onPressed: () => onChanged(null))
                : null,
          ),
          child: Text(value == null ? 'Choose a date' : formatDay(value)),
        ),
      );
}
