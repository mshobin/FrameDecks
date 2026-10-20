import 'package:flutter/material.dart';

/// Design tokens: the Kingdom Connect navy and gold, an 8 px spacing grid, one radius scale.
class KC {
  const KC._();

  static const navy = Color(0xFF0F1F3D);
  static const navyDeep = Color(0xFF0A1120);
  static const gold = Color(0xFFE3B75A);
  static const goldDeep = Color(0xFFB8862B);
  static const success = Color(0xFF2E7D4F);
  static const warning = Color(0xFFC77700);
  static const danger = Color(0xFFB3261E);

  // 8 px grid
  static const s1 = 4.0, s2 = 8.0, s3 = 12.0, s4 = 16.0, s5 = 24.0, s6 = 32.0, s7 = 40.0, s8 = 48.0;

  static const radius = 16.0, radiusSmall = 12.0;

  /// Width at which the layout gets its side rail (tablet) and its extended rail with labels (desktop).
  static const tabletWidth = 600.0, desktopWidth = 1024.0;

  /// Readable form width on large screens.
  static const formWidth = 760.0;
}

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: KC.navy,
    brightness: brightness,
    primary: dark ? KC.gold : KC.navy,
    onPrimary: dark ? KC.navyDeep : Colors.white,
    secondary: dark ? const Color(0xFF9FB3D9) : KC.goldDeep,
    tertiary: KC.gold,
    surface: dark ? const Color(0xFF0E1628) : const Color(0xFFF7F8FB),
    error: KC.danger,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  final text = base.textTheme.apply(
    bodyColor: dark ? const Color(0xFFEEF2F9) : const Color(0xFF1B2333),
    displayColor: dark ? const Color(0xFFEEF2F9) : KC.navy,
  );
  final card = dark ? const Color(0xFF141E33) : Colors.white;
  final line = dark ? const Color(0xFF26344F) : const Color(0xFFE2E7F0);

  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    textTheme: text.copyWith(
      headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      labelSmall: text.labelSmall?.copyWith(letterSpacing: 1.1, fontWeight: FontWeight.w700),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KC.radius), side: BorderSide(color: line)),
    ),
    dividerTheme: DividerThemeData(color: line, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF0B1324) : const Color(0xFFF4F6FA),
      contentPadding: const EdgeInsets.symmetric(horizontal: KC.s4, vertical: KC.s4),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(KC.radiusSmall), borderSide: BorderSide(color: line)),
      enabledBorder:
          OutlineInputBorder(borderRadius: BorderRadius.circular(KC.radiusSmall), borderSide: BorderSide(color: line)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KC.radiusSmall), borderSide: BorderSide(color: scheme.primary, width: 2)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: KC.s5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KC.radiusSmall)),
        textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? scheme.primary.withValues(alpha: 0.14) : Colors.transparent),
        foregroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? scheme.primary : scheme.onSurface),
        side: WidgetStatePropertyAll(BorderSide(color: line)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KC.radiusSmall)),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(shape: const StadiumBorder()),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: dark ? KC.navyDeep : Colors.white,
      indicatorColor: scheme.primary.withValues(alpha: 0.14),
      selectedIconTheme: IconThemeData(color: scheme.primary),
      selectedLabelTextStyle: text.labelLarge?.copyWith(color: scheme.primary, fontWeight: FontWeight.w700),
      unselectedLabelTextStyle: text.labelLarge,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? KC.navyDeep : Colors.white,
      indicatorColor: scheme.primary.withValues(alpha: 0.14),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: KC.gold,
      foregroundColor: KC.navyDeep,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KC.radius)),
    ),
  );
}
