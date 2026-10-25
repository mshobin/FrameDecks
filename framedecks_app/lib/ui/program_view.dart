import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../engine/media.dart';
import '../engine/model.dart';
import '../engine/scenes.dart' as sc;
import 'program_media.dart';
import 'theme.dart';

/// The program picture (what the audience sees): the Windows app's overlay (app/js/overlay.js + css/overlay.css)
/// drawn natively. Everything is sized in the overlay's unit u = 1% of the picture's width, so the canvas, the Share
/// Window and a 4K screen show the same layout. Image and video Content of the live Deck are drawn under the cards,
/// as the Windows camera draws them (see [ProgramMediaLayer]).
class ProgramView extends StatefulWidget {
  const ProgramView({
    super.key,
    required this.state,
    this.background = ProgramBackground.preview,
    this.dataDir,
    this.videoFactory = playerVideo,
    this.volume = 0,
  });

  final Json state;
  final ProgramBackground background;

  /// The data folder whose media folder holds the files image and video Content name (null: no media is drawn,
  /// e.g. on the phone remote, which has no files).
  final String? dataDir;

  final ProgramVideoFactory videoFactory;

  /// Video sound, 0..1. The Windows camera plays videos muted (vcam/layers.py VideoSource reads no audio), so the
  /// program does too.
  final double volume;

  @override
  State<ProgramView> createState() => _ProgramViewState();
}

enum ProgramBackground {
  /// The overlay page's preview picture (a person-shaped placeholder), as the Studio canvas shows it.
  preview,

  /// Plain dark (the Share Window's picture behind the cards).
  dark,

  /// Transparent (for a capture tool's chroma or a window behind).
  none,
}

class _ProgramViewState extends State<ProgramView> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _syncTimer();
  }

  @override
  void didUpdateWidget(ProgramView old) {
    super.didUpdateWidget(old);
    _syncTimer();
  }

  /// Countdowns tick once a second while one is on the program.
  void _syncTimer() {
    final need = sc.liveText(widget.state).any((l) => l['kind'] == 'countdown');
    if (need && _tick == null) {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
    } else if (!need) {
      _tick?.cancel();
      _tick = null;
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.state;
    final live = sc.liveOf(st);
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth, h = box.maxHeight;
        final u = (w / 100).clamp(0.0, h * 1.7778 / 100);
        final layout = st['layout'] as Json;
        final panel = ((layout['panel'] as num?) ?? 92) / 100;
        final q = st['question'] as Json, v = st['verse'] as Json, b = st['birthday'] as Json;
        final qOn = q['visible'] == true && (q['text'] ?? '').toString().trim().isNotEmpty;
        final vOn = v['visible'] == true && (v['text'] ?? '').toString().trim().isNotEmpty;
        final bOn = b['visible'] == true && (b['greeting'] ?? '').toString().trim().isNotEmpty;
        final brand = st['brand'] as Json;
        final dur = Duration(milliseconds: live['tx'] == 'cut' ? 0 : 450);

        Widget fade(bool on, Widget child) => IgnorePointer(
          child: AnimatedOpacity(opacity: on ? 1 : 0, duration: dur, curve: Curves.easeOut, child: child),
        );

        return ClipRect(
          child: Stack(
            fit: StackFit.expand,
            children: [
              _Backdrop(kind: widget.background),
              // image and video Content, bottom first, under every card (vcam/layers.py: layers under the cards)
              if (widget.dataDir != null)
                Positioned.fill(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      for (final l in liveMedia(st))
                        ProgramMediaLayer(
                          key: ValueKey('${live['scene']}/${l['id']}'),
                          layer: l,
                          dataDir: widget.dataDir!,
                          width: w,
                          height: h,
                          videoFactory: widget.videoFactory,
                          volume: widget.volume,
                        ),
                    ],
                  ),
                ),
              // focus verse: centred at verseY% of the height
              Positioned(
                left: 4 * u,
                right: 4 * u,
                top: h * (((layout['verseY'] as num?) ?? 40) / 100),
                child: FractionalTranslation(
                  translation: const Offset(0, -0.5),
                  child: Align(
                    alignment: switch (layout['verseAlign']) {
                      'left' => Alignment.centerLeft,
                      'right' => Alignment.centerRight,
                      _ => Alignment.center,
                    },
                    child: fade(vOn, _VerseCard(v: v, u: u, w: w, h: h, layout: layout, panel: panel)),
                  ),
                ),
              ),
              // discussion question: qBottom% from the bottom
              Positioned(
                left: 4 * u,
                right: 4 * u,
                bottom: h * (((layout['qBottom'] as num?) ?? 10) / 100),
                child: Center(
                  child: fade(qOn, _QuestionCard(q: q, u: u, w: w, h: h, layout: layout, panel: panel)),
                ),
              ),
              if (bOn) _birthday(b, layout, u, w, h, panel),
              for (final l in sc.liveText(st)) _textCard(st, l, u, w, h, panel, brand),
              for (final l in sc.liveBrand(st)) _brandCard(st, l, u, w, h, panel, brand),
              // emergency screen, then blackout above everything
              fade(live['emergency'] == true, _Emergency(text: (live['message'] ?? '').toString(), u: u)),
              fade(live['blackout'] == true, const ColoredBox(color: Colors.black)),
            ],
          ),
        );
      },
    );
  }

  Widget _birthday(Json b, Json layout, double u, double w, double h, double panel) {
    final card = _BirthdayCard(b: b, u: u, w: w, h: h, scale: ((layout['bdayScale'] as num?) ?? 1).toDouble(), panel: panel);
    return switch (layout['bdayPos']) {
      'center' => Positioned.fill(child: Center(child: card)),
      'bottom' => Positioned(
        left: 0,
        right: 0,
        bottom: h * (((layout['qBottom'] as num?) ?? 10) / 100),
        child: Center(child: card),
      ),
      _ => Positioned(
        left: 0,
        right: 0,
        top: h * .06,
        child: Center(child: card),
      ),
    };
  }

  Widget _place(String pos, double u, double h, double margin, Widget child) {
    final top = pos == 'top' || pos == 'upper-left' || pos == 'upper-right';
    final bottom = pos == 'bottom' || pos == 'lower-left' || pos == 'lower-right';
    final align = pos.endsWith('left') ? Alignment.centerLeft : (pos.endsWith('right') ? Alignment.centerRight : Alignment.center);
    final row = Padding(
      padding: EdgeInsets.symmetric(horizontal: margin),
      child: Align(alignment: align, child: child),
    );
    if (top) return Positioned(left: 0, right: 0, top: h * .06, child: row);
    if (bottom) return Positioned(left: 0, right: 0, bottom: h * .08, child: row);
    return Positioned.fill(child: Center(child: row));
  }

  Widget _textCard(Json st, Json l, double u, double w, double h, double panel, Json brand) {
    final c = sc.cOf(l);
    final kind = l['kind'] as String;
    final s = u * ((c['scale'] as num?) ?? 1).toDouble();
    final title = kind == 'countdown' ? sc.brandText(st, c['title']) : sc.brandText(st, c['title']);
    final text = kind == 'countdown' ? sc.countdownText(st, l) : sc.brandText(st, c['text']);
    final showLabel = c['label'] == true && title.trim().isNotEmpty;
    final lower = kind == 'lowerthird';
    final logo = c['logo'] == true ? _logo(brand, s * 1.35 * 1.9) : null;
    return _place(
      (c['pos'] ?? 'center').toString(),
      u,
      h,
      4 * u,
      _Card(
        u: u,
        panel: panel,
        width: w * (((c['w'] as num?) ?? 70) / 100),
        maxHeight: h * .44,
        padding: EdgeInsets.fromLTRB(2.4 * s, (lower ? 1.1 : 1.35) * s, 2.4 * s, (lower ? 1.3 : 1.7) * s),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (showLabel || logo != null)
              Row(
                children: [
                  if (showLabel)
                    Flexible(
                      child: lower
                          ? Text(
                              title,
                              style: TextStyle(fontFamily: K.sans, fontWeight: FontWeight.w700, color: Colors.white, fontSize: s * 1.9, height: 1),
                            )
                          : _Label(text: title, icon: _kindIcon(kind), size: s * 1.35, u: u),
                    ),
                  if (logo != null) ...[const Spacer(), logo],
                ],
              ),
            if (showLabel)
              _Rule(
                margin: EdgeInsets.only(top: (lower ? .7 : 1.0) * s, bottom: (lower ? .8 : 1.2) * s),
              ),
            if (text.trim().isNotEmpty)
              Text(
                text,
                style: TextStyle(
                  fontFamily: K.sans,
                  fontWeight: lower ? FontWeight.w500 : (kind == 'countdown' ? FontWeight.w700 : FontWeight.w600),
                  color: lower ? K.goldText : Colors.white,
                  fontSize: s * (lower ? 1.6 : 2.15),
                  height: 1.36,
                  fontFeatures: kind == 'countdown' ? const [FontFeature.tabularFigures()] : null,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _brandCard(Json st, Json l, double u, double w, double h, double panel, Json brand) {
    final c = sc.cOf(l);
    final s = u * ((c['scale'] as num?) ?? 1).toDouble();
    final pad = ((c['pad'] as num?) ?? 1).toDouble();
    final margin = ((c['margin'] as num?) ?? 4).toDouble();
    final logo = c['logo'] == true ? _logo(brand, s * 4.4) : null;
    final name = c['name'] == true ? (brand['meeting'] ?? '').toString() : '';
    final org = c['org'] == true ? (brand['org'] ?? '').toString() : '';
    final plate = c['plate'] != false;
    final shadow = plate ? null : [Shadow(color: Colors.black.withValues(alpha: .85), blurRadius: u * .4, offset: Offset(0, u * .08))];
    final body = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ?logo,
        if (logo != null && (name.isNotEmpty || org.isNotEmpty)) SizedBox(width: s * 1.1),
        if (name.isNotEmpty || org.isNotEmpty)
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (name.isNotEmpty)
                Text(
                  name,
                  style: TextStyle(
                    fontFamily: K.sans,
                    fontWeight: FontWeight.w700,
                    fontSize: s * 1.9,
                    height: 1.25,
                    color: K.verseInk,
                    shadows: shadow,
                  ),
                ),
              if (org.isNotEmpty)
                Text(
                  org,
                  style: TextStyle(
                    fontFamily: K.sans,
                    fontWeight: FontWeight.w600,
                    fontSize: s * 1.35,
                    height: 1.25,
                    color: K.goldText,
                    shadows: shadow,
                  ),
                ),
            ],
          ),
      ],
    );
    final pos = (c['pos'] ?? 'upper-right').toString();
    final top = pos == 'top' || pos.startsWith('upper');
    final bottom = pos == 'bottom' || pos.startsWith('lower');
    final align = pos.endsWith('left') ? Alignment.centerLeft : (pos.endsWith('right') ? Alignment.centerRight : Alignment.center);
    final card = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: w * .6),
      child: plate
          ? _Card(u: u, panel: panel, padding: EdgeInsets.all(s * 1.3 * pad), radius: s * 1.1, child: body)
          : Padding(padding: EdgeInsets.all(s * 1.3 * pad), child: body),
    );
    final row = Padding(
      padding: EdgeInsets.symmetric(horizontal: u * margin),
      child: Align(alignment: align, child: card),
    );
    if (top) return Positioned(left: 0, right: 0, top: u * margin, child: row);
    if (bottom) return Positioned(left: 0, right: 0, bottom: u * margin, child: row);
    return Positioned.fill(child: Center(child: row));
  }
}

/// The brand logo (a data: URL in the state, as the Windows app keeps it).
Widget? _logo(Json brand, double height) {
  final src = (brand['logo'] ?? '').toString();
  final comma = src.indexOf(',');
  if (!src.startsWith('data:image/') || comma < 0) return null;
  try {
    return Image.memory(base64Decode(src.substring(comma + 1)), height: height, fit: BoxFit.contain, gaplessPlayback: true);
  } on FormatException {
    return null;
  }
}

IconData _kindIcon(String kind) => switch (kind) {
  'scripture' || 'verse' => Icons.menu_book_outlined,
  'question' => Icons.chat_bubble_outline,
  'birthday' => Icons.cake_outlined,
  'announcement' => Icons.campaign_outlined,
  'prayer' => Icons.favorite_border,
  'lowerthird' => Icons.call_to_action_outlined,
  'countdown' => Icons.timer_outlined,
  'brand' => Icons.star_border,
  'camera' => Icons.videocam_outlined,
  'screen' => Icons.desktop_windows_outlined,
  'window' => Icons.web_asset,
  'image' => Icons.image_outlined,
  'video' => Icons.movie_outlined,
  'pdf' => Icons.slideshow_outlined,
  'background' => Icons.format_color_fill,
  'text' => Icons.text_fields,
  'rect' => Icons.crop_square,
  'ellipse' => Icons.circle_outlined,
  _ => Icons.layers_outlined,
};

/// The Content kind's icon (the same pictures as the Windows app's Lucide icons).
IconData kindIcon(String kind) => _kindIcon(kind);

/// The navy card with the gold ring (overlay.css .card).
class _Card extends StatelessWidget {
  const _Card({
    required this.u,
    required this.panel,
    required this.child,
    required this.padding,
    this.width,
    this.maxWidth,
    this.maxHeight,
    this.radius,
  });

  final double u;
  final double panel;
  final Widget child;
  final EdgeInsets padding;
  final double? width, maxWidth, maxHeight, radius;

  @override
  Widget build(BuildContext context) {
    final bw = (u * .13).clamp(2.0, double.infinity);
    final r = radius ?? u * 1.1;
    final a = panel.clamp(0.0, 1.0);
    final textShadow = (1 - a) * 2.2;
    return Container(
      width: width,
      constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity, maxHeight: maxHeight ?? double.infinity),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(r),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [K.gold1, K.gold2, K.gold3, K.gold4, K.gold2],
          stops: [0, .28, .52, .76, 1],
        ),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .38), blurRadius: u * 2.8, offset: Offset(0, u * .8))],
      ),
      padding: EdgeInsets.all(bw),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(r - bw),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFF182C54).withValues(alpha: a),
              const Color(0xFF0C1A38).withValues(alpha: a),
            ],
          ),
        ),
        padding: padding,
        child: DefaultTextStyle.merge(
          style: TextStyle(
            shadows: textShadow > 0
                ? [
                    Shadow(
                      color: Colors.black.withValues(alpha: textShadow.clamp(0, .85)),
                      blurRadius: u * .35,
                      offset: Offset(0, u * .06),
                    ),
                  ]
                : null,
          ),
          child: ClipRect(child: child),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.text, required this.icon, required this.size, required this.u, this.center = false});

  final String text;
  final IconData icon;
  final double size, u;
  final bool center;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: center ? MainAxisSize.min : MainAxisSize.max,
    mainAxisAlignment: center ? MainAxisAlignment.center : MainAxisAlignment.start,
    children: [
      Icon(icon, size: size * 1.5, color: K.goldText),
      SizedBox(width: u * .9),
      Flexible(
        child: Text(
          text.toUpperCase(),
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontFamily: K.sans, fontWeight: FontWeight.w700, color: K.goldText, fontSize: size, letterSpacing: size * .08, height: 1),
        ),
      ),
    ],
  );
}

class _Rule extends StatelessWidget {
  const _Rule({required this.margin, this.width, this.faded = false});

  final EdgeInsets margin;
  final double? width;
  final bool faded;

  @override
  Widget build(BuildContext context) => Container(
    margin: margin,
    height: 1,
    width: width,
    decoration: BoxDecoration(
      color: faded ? null : Colors.white.withValues(alpha: .8),
      gradient: faded
          ? LinearGradient(
              colors: [Colors.transparent, Colors.white.withValues(alpha: .85), Colors.white.withValues(alpha: .85), Colors.transparent],
              stops: const [0, .18, .82, 1],
            )
          : null,
    ),
  );
}

bool _labelOn(Json d) => d['showLabel'] == true && (d['label'] ?? '').toString().trim().isNotEmpty;

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.q, required this.u, required this.w, required this.h, required this.layout, required this.panel});

  final Json q, layout;
  final double u, w, h, panel;

  @override
  Widget build(BuildContext context) {
    final s = u * ((layout['qScale'] as num?) ?? 1).toDouble();
    final label = _labelOn(q);
    return _Card(
      u: u,
      panel: panel,
      width: w * (((layout['qWidth'] as num?) ?? 84) / 100),
      maxHeight: h * .36,
      padding: EdgeInsets.fromLTRB(2.4 * s, 1.35 * s, 2.4 * s, 1.7 * s),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (label) _Label(text: q['label'].toString(), icon: Icons.chat_bubble_outline, size: s * 1.35, u: u),
          if (label)
            _Rule(
              margin: EdgeInsets.only(top: s * 1.0, bottom: s * 1.2),
            ),
          Flexible(
            child: _FitText(
              (q['text'] ?? '').toString(),
              style: TextStyle(fontFamily: K.sans, fontWeight: FontWeight.w600, color: Colors.white, fontSize: s * 2.15, height: 1.36),
            ),
          ),
        ],
      ),
    );
  }
}

class _VerseCard extends StatelessWidget {
  const _VerseCard({required this.v, required this.u, required this.w, required this.h, required this.layout, required this.panel});

  final Json v, layout;
  final double u, w, h, panel;

  @override
  Widget build(BuildContext context) {
    final s = u * ((layout['verseScale'] as num?) ?? 1).toDouble();
    final label = _labelOn(v);
    final centre = layout['verseAlign'] != 'left' && layout['verseAlign'] != 'right';
    final ref = (v['ref'] ?? '').toString().trim();
    final ver = (v['version'] ?? '').toString().trim();
    final gold = TextStyle(fontFamily: K.sans, fontWeight: FontWeight.w700, color: K.goldText, fontSize: s * 1.45, letterSpacing: s * 1.45 * .05);
    Widget dash() => Container(width: s * 2.2, height: 1, color: K.goldText.withValues(alpha: .6));
    return _Card(
      u: u,
      panel: panel,
      maxWidth: w * (((layout['verseWidth'] as num?) ?? 70) / 100),
      maxHeight: h * .62,
      padding: EdgeInsets.fromLTRB(3 * s, 1.9 * s, 3 * s, 2.1 * s),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: centre ? CrossAxisAlignment.center : CrossAxisAlignment.start,
        children: [
          if (label) _Label(text: v['label'].toString(), icon: Icons.menu_book_outlined, size: s * 1.0, u: u, center: centre),
          if (label)
            _Rule(
              margin: EdgeInsets.only(top: s * 1.1, bottom: s * 1.6),
              width: s * 26,
              faded: centre,
            ),
          Flexible(
            child: _FitText(
              (v['text'] ?? '').toString(),
              textAlign: centre ? TextAlign.center : TextAlign.left,
              style: TextStyle(fontFamily: K.serif, fontWeight: FontWeight.w500, color: K.verseInk, fontSize: s * 2.85, height: 1.34),
            ),
          ),
          if (ref.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(top: s * 1.4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (centre) ...[dash(), SizedBox(width: s * .8)],
                  Text(ref, style: gold),
                  if (ver.isNotEmpty) ...[
                    SizedBox(width: s * .8),
                    Text(
                      ver,
                      style: gold.copyWith(fontWeight: FontWeight.w500, color: K.goldText.withValues(alpha: .75), letterSpacing: s * 1.45 * .06),
                    ),
                  ],
                  if (centre) ...[SizedBox(width: s * .8), dash()],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _BirthdayCard extends StatelessWidget {
  const _BirthdayCard({required this.b, required this.u, required this.w, required this.h, required this.scale, required this.panel});

  final Json b;
  final double u, w, h, scale, panel;

  @override
  Widget build(BuildContext context) {
    final s = u * scale;
    final label = _labelOn(b);
    final g = (b['greeting'] ?? '').toString().trim(), name = (b['name'] ?? '').toString().trim();
    final at = name.isEmpty ? -1 : g.indexOf(name);
    final base = TextStyle(fontFamily: K.serif, fontWeight: FontWeight.w600, color: K.verseInk, fontSize: s * 3.3, height: 1.18);
    final greeting = Text.rich(
      at < 0
          ? TextSpan(text: g)
          : TextSpan(
              children: [
                TextSpan(text: g.substring(0, at)),
                TextSpan(
                  text: name,
                  style: const TextStyle(color: K.goldText),
                ),
                TextSpan(text: g.substring(at + name.length)),
              ],
            ),
      textAlign: TextAlign.center,
      style: base,
    );
    final msg = (b['message'] ?? '').toString().trim(), country = (b['country'] ?? '').toString().trim();
    return _Card(
      u: u,
      panel: panel,
      maxWidth: w * .72,
      maxHeight: h * .46,
      padding: EdgeInsets.fromLTRB(6.2 * s, 1.8 * s, 6.2 * s, 2 * s),
      child: ConstrainedBox(
        constraints: BoxConstraints(minWidth: w * .42 - 12.4 * s),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (label) _Label(text: b['label'].toString(), icon: Icons.cake_outlined, size: s * 1.0, u: u, center: true),
            if (label)
              _Rule(
                margin: EdgeInsets.only(top: s * 1.0, bottom: s * 1.3),
                width: s * 24,
                faded: true,
              ),
            greeting,
            if (msg.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: s * 1.0),
                child: Text(
                  msg,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontFamily: K.sans, fontWeight: FontWeight.w500, color: const Color(0xFFEFE8D6), fontSize: s * 1.55, height: 1.4),
                ),
              ),
            if (country.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: s * 1.0),
                child: Text(
                  country.toUpperCase(),
                  style: TextStyle(
                    fontFamily: K.sans,
                    fontWeight: FontWeight.w700,
                    color: K.goldText,
                    fontSize: s * 1.05,
                    letterSpacing: s * 1.05 * .08,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Text that shrinks (to 40% at most) until it fits its card, like overlay.js fit().
class _FitText extends StatelessWidget {
  const _FitText(this.text, {required this.style, this.textAlign = TextAlign.left});

  final String text;
  final TextStyle style;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      var f = 1.0;
      if (box.maxHeight.isFinite && box.maxWidth.isFinite) {
        while (f > .4) {
          final tp = TextPainter(
            text: TextSpan(
              text: text,
              style: style.copyWith(fontSize: style.fontSize! * f),
            ),
            textDirection: TextDirection.ltr,
            textAlign: textAlign,
          )..layout(maxWidth: box.maxWidth);
          final fits = tp.height <= box.maxHeight + 1;
          tp.dispose();
          if (fits) break;
          f -= .04;
        }
      }
      return Text(
        text,
        textAlign: textAlign,
        style: style.copyWith(fontSize: style.fontSize! * f),
      );
    },
  );
}

class _Emergency extends StatelessWidget {
  const _Emergency({required this.text, required this.u});

  final String text;
  final double u;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: const Color(0xFF0B1222),
    child: Center(
      child: Container(
        constraints: BoxConstraints(maxWidth: u * 70),
        padding: EdgeInsets.symmetric(horizontal: u * 4, vertical: u * 2.4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(u * 1.1),
          gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF182C54), Color(0xFF0C1A38)]),
          border: Border.all(color: K.gold2, width: (u * .13).clamp(2.0, double.infinity)),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(fontFamily: K.sans, fontWeight: FontWeight.w600, color: Colors.white, fontSize: u * 3.2, height: 1.3),
        ),
      ),
    ),
  );
}

class _Backdrop extends StatelessWidget {
  const _Backdrop({required this.kind});

  final ProgramBackground kind;

  @override
  Widget build(BuildContext context) => switch (kind) {
    ProgramBackground.none => const SizedBox.shrink(),
    ProgramBackground.dark => const ColoredBox(color: Color(0xFF0B1222)),
    ProgramBackground.preview => const CustomPaint(painter: _PreviewPainter()),
  };
}

/// overlay.css body.bg-preview: a soft grey gradient with a head-and-shoulders shape, so the cards are seen on a picture.
class _PreviewPainter extends CustomPainter {
  const _PreviewPainter();

  @override
  void paint(Canvas canvas, Size s) {
    final r = Offset.zero & s;
    canvas.drawRect(
      r,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment(-.3, -1),
          end: Alignment(.3, 1),
          colors: [Color(0xFF465063), Color(0xFF262C38)],
        ).createShader(r),
    );
    void blob(double cx, double cy, double rx, double ry, Color a, Color b) {
      final o = Rect.fromCenter(center: Offset(s.width * cx, s.height * cy), width: s.width * rx * 2, height: s.height * ry * 2);
      canvas.drawOval(o, Paint()..shader = RadialGradient(colors: [a, b]).createShader(o));
    }

    blob(.5, .6, .17, .30, const Color(0xFF59606F), const Color(0xFF3A404C));
    blob(.5, .3, .075, .135, const Color(0xFF6B7282), const Color(0xFF555C6B));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
