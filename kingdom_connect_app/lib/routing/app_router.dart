import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/dashboard/presentation/dashboard_screen.dart';
import '../features/follow_ups/presentation/follow_ups_screen.dart';
import '../features/meetings/presentation/meeting_form_screen.dart';
import '../features/meetings/presentation/meetings_screen.dart';
import '../features/ministries/presentation/ministries_screen.dart';
import '../features/prayer/presentation/prayer_screen.dart';
import '../features/presenter/presentation/presenter_screen.dart';
import '../features/schedules/presentation/schedules_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/volunteers/presentation/volunteers_screen.dart';
import 'app_shell.dart';

/// One destination of the app's navigation.
class Destination {
  const Destination(this.path, this.label, this.icon, this.selectedIcon, {this.primary = false});

  final String path;
  final String label;
  final IconData icon;
  final IconData selectedIcon;

  /// Shown in the phone's bottom bar (the others are in the drawer).
  final bool primary;
}

const destinations = [
  Destination('/dashboard', 'Dashboard', Icons.space_dashboard_outlined, Icons.space_dashboard, primary: true),
  Destination('/meetings', 'Meetings', Icons.event_note_outlined, Icons.event_note, primary: true),
  Destination('/follow-ups', 'Follow-ups', Icons.connect_without_contact_outlined, Icons.connect_without_contact,
      primary: true),
  Destination('/prayer', 'Prayer', Icons.volunteer_activism_outlined, Icons.volunteer_activism),
  Destination('/volunteers', 'Volunteers', Icons.groups_outlined, Icons.groups),
  Destination('/ministries', 'Ministries', Icons.church_outlined, Icons.church),
  Destination('/schedules', 'Schedules', Icons.calendar_month_outlined, Icons.calendar_month),
  Destination('/presenter', 'Presenter', Icons.cast_outlined, Icons.cast),
  Destination('/settings', 'Settings', Icons.settings_outlined, Icons.settings),
];

GoRouter buildRouter({String initialLocation = '/dashboard'}) => GoRouter(
      initialLocation: initialLocation,
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => AppShell(shell: shell),
          branches: [
            _branch('/dashboard', (_) => const DashboardScreen()),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/meetings',
                builder: (_, _) => const MeetingsScreen(),
                routes: [
                  GoRoute(path: 'new', builder: (_, s) => MeetingFormScreen(ministryUid: s.uri.queryParameters['ministry'])),
                  GoRoute(path: ':uid', builder: (_, s) => MeetingFormScreen(uid: s.pathParameters['uid'])),
                ],
              ),
            ]),
            _branch('/follow-ups', (_) => const FollowUpsScreen()),
            _branch('/prayer', (_) => const PrayerScreen()),
            _branch('/volunteers', (_) => const VolunteersScreen()),
            _branch('/ministries', (_) => const MinistriesScreen()),
            _branch('/schedules', (_) => const SchedulesScreen()),
            _branch('/presenter', (_) => const PresenterScreen()),
            _branch('/settings', (_) => const SettingsScreen()),
          ],
        ),
      ],
    );

StatefulShellBranch _branch(String path, Widget Function(BuildContext) page) =>
    StatefulShellBranch(routes: [GoRoute(path: path, builder: (c, _) => page(c))]);
