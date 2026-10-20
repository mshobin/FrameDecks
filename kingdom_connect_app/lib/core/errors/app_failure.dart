/// A failure the user can read. Every error that reaches the UI is one of these, never a raw exception.
class AppFailure implements Exception {
  const AppFailure(this.message, {this.cause});

  /// What happened and what to do, in plain words.
  final String message;
  final Object? cause;

  @override
  String toString() => message;
}

/// The action needs a permission the current user does not have (enterprise edition only).
class PermissionDenied extends AppFailure {
  const PermissionDenied(String action) : super('You do not have permission to $action.');
}
