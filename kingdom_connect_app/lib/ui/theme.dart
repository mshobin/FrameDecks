import 'package:flutter/material.dart';

/// The Windows app's design tokens (app/css/theme.css, the navy & gold "Kingdom Connect" block) and the overlay
/// card colours (app/css/overlay.css), so every screen looks the same as on Windows.
class K {
  const K._();

  // ---- app (dark: the Windows app's default) ----
  static const appBg = Color(0xFF0A1120);
  static const chromeBg = Color(0xFF0D1628);
  static const surface = Color(0xFF121C30);
  static const raised = Color(0xFF18233A);
  static const field = Color(0xFF0B1324);
  static const panel = Color(0xFF0F182B);
  static const panel2 = Color(0xFF152039);
  static const line = Color(0xFF26344F);
  static const lineSoft = Color(0xFF1C2840);
  static const lineHover = Color(0xFF344566);
  static const ink = Color(0xFFEEF2F9);
  static const muted = Color(0xFF9FABC2);
  static const faint = Color(0xFF6B7894);
  static const neutralBtn = Color(0xFF223050);
  static const accent = Color(0xFFE3B75A); // gold
  static const accentStrong = Color(0xFFD9A94A);
  static const accentInk = Color(0xFF1A1405);
  static const goldLine = Color(0x4DE3B75A);
  static const take = Color(0xFF5EE08F); // GO LIVE
  static const takeInk = Color(0xFF04210F);
  static const live = Color(0xFF16A34A);
  static const liveSoft = Color(0x1F16A34A);
  static const liveText = Color(0xFF34D17C);
  static const red = Color(0xFFDC2626);
  static const redText = Color(0xFFF26363);

  // ---- overlay cards ----
  static const navyA = Color(0xEB182C54); // rgba(24,44,84,.92)
  static const navyB = Color(0xEB0C1A38); // rgba(12,26,56,.92)
  static const gold1 = Color(0xFFF6E1A0), gold2 = Color(0xFFD9AB4A), gold3 = Color(0xFFA8781F), gold4 = Color(0xFFECCB72);
  static const goldText = Color(0xFFF2C35B);
  static const verseInk = Color(0xFFFBF6EA);

  static const sans = 'KC Sans';
  static const serif = 'KC Serif';

  static const r = 10.0, rSmall = 8.0;
}

ThemeData kcTheme() {
  const scheme = ColorScheme.dark(
    primary: K.accent,
    onPrimary: K.accentInk,
    secondary: K.take,
    surface: K.surface,
    onSurface: K.ink,
    error: K.red,
    outline: K.line,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: K.sans, brightness: Brightness.dark);
  return base.copyWith(
    scaffoldBackgroundColor: K.appBg,
    canvasColor: K.panel,
    dividerTheme: const DividerThemeData(color: K.line, space: 1, thickness: 1),
    textTheme: base.textTheme.apply(bodyColor: K.ink, displayColor: K.ink, fontFamily: K.sans),
    iconTheme: const IconThemeData(color: K.muted, size: 18),
    tooltipTheme: const TooltipThemeData(
      decoration: BoxDecoration(color: K.raised, borderRadius: BorderRadius.all(Radius.circular(6))),
      textStyle: TextStyle(color: K.ink, fontSize: 12, fontFamily: K.sans),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: K.field,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      hintStyle: const TextStyle(color: K.faint),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(K.rSmall),
        borderSide: const BorderSide(color: K.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(K.rSmall),
        borderSide: const BorderSide(color: K.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(K.rSmall),
        borderSide: const BorderSide(color: K.accent, width: 1.5),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? K.accent : Colors.transparent),
      checkColor: const WidgetStatePropertyAll(K.accentInk),
      side: const BorderSide(color: K.lineHover, width: 1.5),
    ),
    popupMenuTheme: const PopupMenuThemeData(
      color: K.raised,
      textStyle: TextStyle(color: K.ink, fontSize: 13.5, fontFamily: K.sans),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(10)),
        side: BorderSide(color: K.line),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: K.raised,
      contentTextStyle: TextStyle(color: K.ink, fontFamily: K.sans),
      behavior: SnackBarBehavior.floating,
    ),
    scrollbarTheme: const ScrollbarThemeData(thumbColor: WidgetStatePropertyAll(K.line)),
  );
}

/// Small uppercase section label ("FRAMES", "CONTENT", "STUDIO CANVAS").
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color = K.muted});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1.3),
  );
}

/// The green LIVE badge.
class LiveBadge extends StatelessWidget {
  const LiveBadge({super.key, this.small = false});

  final bool small;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: small ? 6 : 8, vertical: 2),
    decoration: BoxDecoration(color: K.live, borderRadius: BorderRadius.circular(5)),
    child: Text(
      'LIVE',
      style: TextStyle(color: Colors.white, fontSize: small ? 10 : 11, fontWeight: FontWeight.w800, letterSpacing: 1),
    ),
  );
}

/// A keyboard hint (T, ESC).
class Kbd extends StatelessWidget {
  const Kbd(this.text, {super.key, this.color = Colors.white});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
    decoration: BoxDecoration(
      border: Border.all(color: color.withValues(alpha: 0.45)),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(
      text,
      style: TextStyle(color: color.withValues(alpha: 0.85), fontSize: 10, fontWeight: FontWeight.w700),
    ),
  );
}

/// The app's plain dark buttons (bordered, raised fill).
class KButton extends StatelessWidget {
  const KButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.gold = false,
    this.outlineGold = false,
    this.height = 36,
    this.tooltip,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final bool gold;
  final bool outlineGold;
  final double height;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final b = Material(
      color: gold ? K.accent : K.raised,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(K.rSmall),
        side: BorderSide(color: gold ? K.accent : (outlineGold ? K.accent : K.line)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(K.rSmall),
        onTap: onPressed,
        child: SizedBox(
          height: height,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Center(
              child: DefaultTextStyle.merge(
                style: TextStyle(color: gold ? K.accentInk : (outlineGold ? K.accent : K.ink), fontWeight: FontWeight.w700, fontSize: 13.5),
                child: IconTheme.merge(
                  data: IconThemeData(color: gold ? K.accentInk : (outlineGold ? K.accent : K.ink), size: 16),
                  child: child,
                ),
              ),
            ),
          ),
        ),
      ),
    );
    return tooltip == null ? b : Tooltip(message: tooltip!, child: b);
  }
}
