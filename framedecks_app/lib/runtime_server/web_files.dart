/// The remote's own pages (remote.html and what it and its preview frames load), copied from app/ by
/// tools/sync_runtime_web.py into framedecks_app/assets/web/. The app reads them as Flutter assets; the CLI and the
/// tests read the folder on disk.
library;

import 'dart:io';

abstract class WebFiles {
  /// The bytes of [path] ('remote.html', 'js/store.js', …), or null when there is no such file.
  Future<List<int>?> read(String path);
}

/// A safe relative path inside the web folder ('js/store.js'), or null (empty, `..`, backslashes, drive letters).
String? safeWebPath(String path) {
  final parts = path.split('/');
  if (parts.isEmpty || parts.any((p) => p.isEmpty || p == '.' || p == '..' || p.contains('\\') || p.contains(':') || p.contains('\x00'))) {
    return null;
  }
  return parts.join('/');
}

class DirectoryWebFiles implements WebFiles {
  DirectoryWebFiles(this.root);

  final Directory root;

  @override
  Future<List<int>?> read(String path) async {
    final rel = safeWebPath(path);
    if (rel == null) return null;
    final f = File('${root.path}${Platform.pathSeparator}${rel.replaceAll('/', Platform.pathSeparator)}');
    try {
      if (await FileSystemEntity.type(f.path, followLinks: false) != FileSystemEntityType.file) return null;
      return await f.readAsBytes();
    } on FileSystemException {
      return null;
    }
  }
}
