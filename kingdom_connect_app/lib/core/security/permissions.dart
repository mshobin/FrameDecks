/// Role-based permissions, ready for the enterprise edition (docs/project/flutter-platform-plan.md §2).
///
/// The personal edition runs as [AppUser.owner] with [OpenPolicy], so every check passes. The checks are still made
/// everywhere, so turning on a stricter policy later needs no changes in the features.
enum Role { owner, admin, leader, volunteer, viewer }

enum Permission {
  viewDashboard,
  editMeetings,
  deleteRecords,
  editPeople,
  viewPrivatePrayer,
  exportData,
  exportPersonalData,
  importData,
  manageSettings,
}

class AppUser {
  const AppUser({required this.id, required this.name, required this.role});

  final String id;
  final String name;
  final Role role;

  /// The only user of the personal edition: this device's owner.
  static const owner = AppUser(id: 'local-owner', name: 'This device', role: Role.owner);
}

abstract class PermissionPolicy {
  bool can(AppUser user, Permission permission);
}

/// Personal edition: everything is allowed.
class OpenPolicy implements PermissionPolicy {
  const OpenPolicy();

  @override
  bool can(AppUser user, Permission permission) => true;
}

/// Enterprise edition (not enabled yet): what each role may do.
class RolePolicy implements PermissionPolicy {
  const RolePolicy();

  static const _grants = <Role, Set<Permission>>{
    Role.owner: {...Permission.values},
    Role.admin: {...Permission.values},
    Role.leader: {
      Permission.viewDashboard,
      Permission.editMeetings,
      Permission.editPeople,
      Permission.viewPrivatePrayer,
      Permission.exportData,
      Permission.importData,
    },
    Role.volunteer: {Permission.viewDashboard, Permission.editMeetings},
    Role.viewer: {Permission.viewDashboard},
  };

  @override
  bool can(AppUser user, Permission permission) => _grants[user.role]?.contains(permission) ?? false;
}
