/// The time source. Tests replace it so dates in KPIs and "overdue" are predictable.
abstract class Clock {
  DateTime now();
}

class SystemClock implements Clock {
  const SystemClock();

  @override
  DateTime now() => DateTime.now();
}

class FixedClock implements Clock {
  FixedClock(this.value);

  DateTime value;

  @override
  DateTime now() => value;
}

/// Midnight at the start of [d] (local time).
DateTime dayOf(DateTime d) => DateTime(d.year, d.month, d.day);
