import 'dart:io';

import 'package:flutter/foundation.dart';

/// Opens [url] in the system's browser (used for the Presenter Studio on 127.0.0.1). Desktop only.
Future<bool> openInBrowser(Uri url) async {
  if (kIsWeb) return false;
  try {
    if (Platform.isWindows) {
      await Process.start('rundll32', ['url.dll,FileProtocolHandler', url.toString()]);
    } else if (Platform.isMacOS) {
      await Process.start('open', [url.toString()]);
    } else if (Platform.isLinux) {
      await Process.start('xdg-open', [url.toString()]);
    } else {
      return false;
    }
    return true;
  } on ProcessException {
    return false;
  }
}
