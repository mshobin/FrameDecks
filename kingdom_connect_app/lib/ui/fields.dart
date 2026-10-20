import 'dart:async';

import 'package:flutter/material.dart';

import 'theme.dart';

/// A text box bound to a value in the state: typing saves after a short pause (and on leaving the box); a change
/// made elsewhere (another window, the phone) shows up unless you are typing in it.
class StateField extends StatefulWidget {
  const StateField({super.key, required this.value, required this.onSave, this.label, this.hint, this.lines = 1, this.enabled = true});

  final String value;
  final ValueChanged<String> onSave;
  final String? label, hint;
  final int lines;
  final bool enabled;

  @override
  State<StateField> createState() => _StateFieldState();
}

class _StateFieldState extends State<StateField> {
  late final _c = TextEditingController(text: widget.value);
  final _focus = FocusNode();
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (!_focus.hasFocus) _flush();
    });
  }

  @override
  void didUpdateWidget(StateField old) {
    super.didUpdateWidget(old);
    if (!_focus.hasFocus && _t == null && _c.text != widget.value) _c.text = widget.value;
  }

  void _flush() {
    _t?.cancel();
    _t = null;
    if (_c.text != widget.value) widget.onSave(_c.text);
  }

  @override
  void dispose() {
    _flush();
    _t?.cancel();
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (widget.label != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(widget.label!, style: const TextStyle(color: K.muted, fontSize: 12.5)),
        ),
      TextField(
        controller: _c,
        focusNode: _focus,
        enabled: widget.enabled,
        minLines: widget.lines,
        maxLines: widget.lines == 1 ? 1 : widget.lines + 6,
        style: const TextStyle(fontSize: 14),
        decoration: InputDecoration(hintText: widget.hint),
        onChanged: (_) {
          _t?.cancel();
          _t = Timer(const Duration(milliseconds: 500), _flush);
        },
        onSubmitted: (_) => _flush(),
      ),
    ],
  );
}

/// A labelled check box row ("Favourite").
class CheckRow extends StatelessWidget {
  const CheckRow({super.key, required this.value, required this.label, required this.onChanged});

  final bool value;
  final String label;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => onChanged(!value),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            height: 28,
            child: Checkbox(value: value, onChanged: (v) => onChanged(v ?? false)),
          ),
          const SizedBox(width: 8),
          Flexible(child: Text(label, style: const TextStyle(fontSize: 14))),
        ],
      ),
    ),
  );
}

/// A labelled drop-down.
class SelectRow<T> extends StatelessWidget {
  const SelectRow({super.key, required this.label, required this.value, required this.items, required this.onChanged});

  final String label;
  final T value;
  final List<(T, String)> items;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(label, style: const TextStyle(color: K.muted, fontSize: 12.5)),
      ),
      Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: K.field,
          border: Border.all(color: K.line),
          borderRadius: BorderRadius.circular(K.rSmall),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<T>(
            isExpanded: true,
            value: items.any((i) => i.$1 == value) ? value : items.first.$1,
            dropdownColor: K.raised,
            style: const TextStyle(color: K.ink, fontSize: 14, fontFamily: K.sans),
            items: [for (final i in items) DropdownMenuItem(value: i.$1, child: Text(i.$2))],
            onChanged: (v) {
              if (v != null) onChanged(v);
            },
          ),
        ),
      ),
    ],
  );
}

/// A labelled slider with its value; it saves when you let go.
class SliderRow extends StatefulWidget {
  const SliderRow({
    super.key,
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
    this.unit = '',
    this.step,
  });

  final String label, unit;
  final num value, min, max;
  final double? step;
  final ValueChanged<num> onChanged;

  @override
  State<SliderRow> createState() => _SliderRowState();
}

class _SliderRowState extends State<SliderRow> {
  double? _drag;

  @override
  Widget build(BuildContext context) {
    final w = widget;
    final v = _drag ?? w.value.clamp(w.min, w.max).toDouble();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Text(w.label, style: const TextStyle(color: K.muted, fontSize: 12.5)),
            const Spacer(),
            Text(
              '${v == v.roundToDouble() ? v.toInt() : v.toStringAsFixed(2)}${w.unit}',
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        Slider(
          value: v,
          min: w.min.toDouble(),
          max: w.max.toDouble(),
          divisions: w.step == null ? null : ((w.max - w.min) / w.step!).round(),
          activeColor: K.accent,
          inactiveColor: K.line,
          onChanged: (x) => setState(() => _drag = x),
          onChangeEnd: (x) {
            setState(() => _drag = null);
            w.onChanged(w.step != null && w.step! >= 1 ? x.round() : double.parse(x.toStringAsFixed(2)));
          },
        ),
      ],
    );
  }
}
