import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:go_router/go_router.dart';

import '../data/models/entity.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// A filter chip on a list page.
class ListFilter<T> {
  const ListFilter(this.label, this.test);

  final String label;
  final bool Function(T) test;
}

/// The list pages (follow-ups, prayer, volunteers, ministries, schedules) share one layout: header, search, filter
/// chips, cards, an empty state and an Add button. `?new=1` in the address opens the editor at once (Quick actions).
class RecordListPage<T extends Entity> extends ConsumerStatefulWidget {
  const RecordListPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.addLabel,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.provider,
    required this.searchText,
    required this.tile,
    required this.onAdd,
    this.filters = const [],
    this.sort,
  });

  final String title;
  final String subtitle;
  final String addLabel;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptyMessage;
  final ProviderListenable<AsyncValue<List<T>>> provider;
  final String Function(T) searchText;
  final Widget Function(BuildContext, T) tile;
  final Future<void> Function(BuildContext) onAdd;
  final List<ListFilter<T>> filters;
  final int Function(T, T)? sort;

  @override
  ConsumerState<RecordListPage<T>> createState() => _RecordListPageState<T>();
}

class _RecordListPageState<T extends Entity> extends ConsumerState<RecordListPage<T>> {
  var _query = '';
  var _filter = 0;
  var _openedFromLink = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final wantsNew = GoRouterState.of(context).uri.queryParameters['new'] == '1';
    if (wantsNew && !_openedFromLink) {
      _openedFromLink = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        await widget.onAdd(context);
        if (mounted) context.go(GoRouterState.of(context).uri.path); // drop ?new=1
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(widget.provider);
    final q = _query.trim().toLowerCase();
    final filter = widget.filters.isEmpty ? null : widget.filters[_filter];
    final items = (async.value ?? <T>[])
        .where((r) => (filter == null || filter.test(r)) && (q.isEmpty || widget.searchText(r).toLowerCase().contains(q)))
        .toList();
    if (widget.sort != null) items.sort(widget.sort);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => widget.onAdd(context),
        icon: const Icon(Icons.add),
        label: Text(widget.addLabel),
      ),
      body: PageBody(children: [
        PageHeader(title: widget.title, subtitle: widget.subtitle),
        const SizedBox(height: KC.s5),
        TextField(
          decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: 'Search ${widget.title.toLowerCase()}'),
          onChanged: (v) => setState(() => _query = v),
        ),
        if (widget.filters.isNotEmpty) ...[
          const SizedBox(height: KC.s3),
          Wrap(spacing: KC.s2, runSpacing: KC.s2, children: [
            for (var i = 0; i < widget.filters.length; i++)
              ChoiceChip(
                label: Text(widget.filters[i].label),
                selected: _filter == i,
                onSelected: (_) => setState(() => _filter = i),
              ),
          ]),
        ],
        const SizedBox(height: KC.s4),
        if (async.isLoading && async.value == null)
          const Center(child: Padding(padding: EdgeInsets.all(KC.s6), child: CircularProgressIndicator()))
        else if (items.isEmpty)
          EmptyState(
            icon: widget.emptyIcon,
            title: q.isEmpty ? widget.emptyTitle : 'Nothing matches “$_query”',
            message: q.isEmpty ? widget.emptyMessage : 'Try another word or another filter.',
          )
        else
          for (final r in items)
            Padding(
              key: ValueKey(r.uid),
              padding: const EdgeInsets.only(bottom: KC.s3),
              child: Card(child: widget.tile(context, r)),
            ),
      ]),
    );
  }
}

/// Buttons at the bottom of an editor: Delete (existing records), Cancel, Save.
class EditorActions extends StatelessWidget {
  const EditorActions({super.key, required this.onSave, this.onDelete, this.saving = false});

  final VoidCallback onSave;
  final VoidCallback? onDelete;
  final bool saving;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: KC.s2),
        child: Row(children: [
          if (onDelete != null)
            TextButton.icon(
              onPressed: onDelete,
              icon: const Icon(Icons.delete_outline),
              label: const Text('Delete'),
              style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
            ),
          const Spacer(),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          const SizedBox(width: KC.s2),
          FilledButton(onPressed: saving ? null : onSave, child: const Text('Save')),
        ]),
      );
}

/// A labelled text field for editors (the record is copied first, so typing changes nothing until Save).
class EditorField extends StatelessWidget {
  const EditorField({
    super.key,
    required this.label,
    required this.initial,
    required this.onChanged,
    this.icon,
    this.lines = 1,
    this.hint,
    this.keyboard,
    this.autofocus = false,
  });

  final String label;
  final String initial;
  final ValueChanged<String> onChanged;
  final IconData? icon;
  final int lines;
  final String? hint;
  final TextInputType? keyboard;
  final bool autofocus;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: KC.s4),
        child: TextFormField(
          initialValue: initial,
          autofocus: autofocus,
          minLines: lines,
          maxLines: lines == 1 ? 1 : lines + 3,
          keyboardType: keyboard,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            alignLabelWithHint: lines > 1,
            prefixIcon: icon == null ? null : Icon(icon),
          ),
          onChanged: onChanged,
        ),
      );
}
