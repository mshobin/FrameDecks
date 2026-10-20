/// App-wide constants. One place for the version and the limits the UI relies on.
class AppConfig {
  const AppConfig._();

  static const appName = 'Kingdom Connect';
  static const version = '1.0.0';

  /// The Windows presentation engine (the existing Kingdom Connect program) listens here.
  static const enginePorts = [8750, 8751, 8752, 8753, 8754, 8755, 8756, 8757, 8758, 8759, 8760];

  /// Lists load this many records at a time.
  static const pageSize = 50;

  /// Recent activity on the dashboard.
  static const recentActivity = 8;

  /// "Recent" for KPIs and the attendance trend.
  static const trendWeeks = 8;
}
