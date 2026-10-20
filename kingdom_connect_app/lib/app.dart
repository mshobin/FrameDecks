import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:responsive_framework/responsive_framework.dart';

import 'core/config/app_config.dart';
import 'routing/app_router.dart';
import 'shared/providers.dart';
import 'theme/app_theme.dart';

class KingdomConnectApp extends ConsumerStatefulWidget {
  const KingdomConnectApp({super.key, this.initialLocation = '/dashboard'});

  final String initialLocation;

  @override
  ConsumerState<KingdomConnectApp> createState() => _KingdomConnectAppState();
}

class _KingdomConnectAppState extends ConsumerState<KingdomConnectApp> {
  late final GoRouter _router = buildRouter(initialLocation: widget.initialLocation);

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(settingsProvider.select((s) => s.themeMode));
    // ScreenUtil: design size of the reference laptop. Text is not scaled by it (the user's text size setting is).
    return ScreenUtilInit(
      designSize: const Size(1440, 900),
      minTextAdapt: false,
      splitScreenMode: true,
      builder: (context, _) => MaterialApp.router(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: mode,
        routerConfig: _router,
        builder: (context, child) => ResponsiveBreakpoints.builder(
          child: child!,
          breakpoints: const [
            Breakpoint(start: 0, end: KC.tabletWidth - 1, name: MOBILE),
            Breakpoint(start: KC.tabletWidth, end: KC.desktopWidth - 1, name: TABLET),
            Breakpoint(start: KC.desktopWidth, end: 1919, name: DESKTOP),
            Breakpoint(start: 1920, end: double.infinity, name: '4K'),
          ],
        ),
      ),
    );
  }
}
