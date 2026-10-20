import 'package:uuid/uuid.dart';

const _uuid = Uuid();

/// A new record identity (UUID v4): unique across devices, so imported and synced records never collide.
String newUid() => _uuid.v4();
