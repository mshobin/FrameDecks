import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../shared/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/brand.dart';
import 'app_router.dart';

/// The frame around every page. One layout per size, the same pages and logic:
/// - phone (< 600 px): bottom navigation bar for the main sections, a drawer for the rest;
/// - tablet: a navigation rail with icons;
/// - desktop (≥ 1024 px): an extended rail with labels and the church's name.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  final _scaffold = GlobalKey<ScaffoldState>();

  StatefulNavigationShell get shell => widget.shell;

  void _go(int index) => shell.goBranch(index, initialLocation: index == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final church = ref.watch(settingsProvider).churchName;

    if (width < KC.tabletWidth) {
      final primary = [for (var i = 0; i < destinations.length; i++) if (destinations[i].primary) i];
      final selected = primary.indexOf(shell.currentIndex);
      return Scaffold(
        key: _scaffold,
        appBar: AppBar(title: BrandTitle(church: church, compact: true)),
        drawer: NavigationDrawer(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) {
            _scaffold.currentState?.closeDrawer();
            _go(i);
          },
          children: [
            Padding(padding: const EdgeInsets.fromLTRB(28, 24, 16, 16), child: BrandTitle(church: church)),
            for (final d in destinations)
              NavigationDrawerDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon), label: Text(d.label)),
          ],
        ),
        body: shell,
        bottomNavigationBar: NavigationBar(
          // a drawer-only section is open: no bottom tab is highlighted, "More" is
          selectedIndex: selected < 0 ? primary.length : selected,
          onDestinationSelected: (i) {
            if (i == primary.length) {
              _scaffold.currentState?.openDrawer();
            } else {
              _go(primary[i]);
            }
          },
          destinations: [
            for (final i in primary)
              NavigationDestination(
                  icon: Icon(destinations[i].icon), selectedIcon: Icon(destinations[i].selectedIcon), label: destinations[i].label),
            const NavigationDestination(icon: Icon(Icons.menu), label: 'More'),
          ],
        ),
      );
    }

    final extended = width >= KC.desktopWidth;
    return Scaffold(
      body: Row(children: [
        NavigationRail(
          extended: extended,
          minExtendedWidth: 248,
          selectedIndex: shell.currentIndex,
          onDestinationSelected: _go,
          labelType: extended ? NavigationRailLabelType.none : NavigationRailLabelType.all,
          leading: Padding(
            padding: const EdgeInsets.symmetric(vertical: KC.s4),
            child: extended ? SizedBox(width: 216, child: BrandTitle(church: church)) : const BrandMark(size: 40),
          ),
          destinations: [
            for (final d in destinations)
              NavigationRailDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon), label: Text(d.label)),
          ],
        ),
        const VerticalDivider(width: 1),
        Expanded(child: shell),
      ]),
    );
  }
}
