/// Media Content (images and videos): where their files live and which of them are on the program. The same rules
/// as the Windows app: server.py keeps every file a Content shows in the data folder's `layers` folder
/// (LAYERS_DIR = DATA / "layers"), a Content's `c.file` is a name in that folder (vcam/layers.py
/// `self.folder / l["file"]`), and the live Frame's live Deck decides what is drawn (server.py scene_media).
library;

import 'dart:io';
import 'dart:math';

import 'model.dart';
import 'scenes.dart' as sc;

/// The media folder inside the data folder (server.py LAYERS_DIR).
const mediaFolderName = 'layers';

/// The files a Content may use, by kind (server.py upload_layer_file accepts these; the camera draws images and
/// videos with OpenCV).
const imageExtensions = ['.png', '.jpg', '.jpeg'];
const videoExtensions = ['.mp4', '.mov', '.webm'];

/// The data folder's media folder.
Directory mediaDir(String dataDir) => Directory('$dataDir${Platform.pathSeparator}$mediaFolderName');

/// The file a Content's `file` names, or null when it names none. Like Windows, a name is relative to the media
/// folder; a name that tries to leave the folder (an absolute path, `..`) names nothing.
File? mediaFile(String dataDir, Object? name) {
  final n = (name ?? '').toString().trim();
  if (n.isEmpty || n.startsWith('/') || n.startsWith(r'\') || RegExp(r'^[A-Za-z]:').hasMatch(n)) return null;
  if (n.split(RegExp(r'[/\\]')).contains('..')) return null;
  return File('${mediaDir(dataDir).path}${Platform.pathSeparator}$n');
}

/// The extension of a file name, lower case with its dot ('' when none).
String extensionOf(String name) {
  final base = name.split(RegExp(r'[/\\]')).last;
  final i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.substring(i).toLowerCase();
}

/// The name a file gets in the media folder (server.py upload_layer_file): letters, digits, `_`, `-` and spaces
/// of its name (60 at most, else "file"), its extension in lower case, and " (2)", " (3)"… when the name is taken.
String mediaName(Directory folder, String original) {
  final base = original.split(RegExp(r'[/\\]')).last;
  final ext = extensionOf(base);
  final stem = ext.isEmpty ? base : base.substring(0, base.length - ext.length);
  final clean = stem.replaceAll(RegExp(r'[^\p{L}\p{N}_\- ]+', unicode: true), '');
  var safe = clean.substring(0, min(60, clean.length)).trim();
  if (safe.isEmpty) safe = 'file';
  var name = '$safe$ext';
  for (var n = 2; File('${folder.path}${Platform.pathSeparator}$name').existsSync(); n++) {
    name = '$safe ($n)$ext';
  }
  return name;
}

/// Copies a file into the media folder the way the Windows Studio stores an upload, and returns its name there (what
/// the Content's `file` keeps). Throws a [FileSystemException] when the file cannot be read.
Future<String> importMedia(String dataDir, File source) async {
  final folder = mediaDir(dataDir);
  await folder.create(recursive: true);
  final name = mediaName(folder, source.path);
  final target = File('${folder.path}${Platform.pathSeparator}$name');
  final part = File('${target.path}.part');
  await source.copy(part.path);
  await part.rename(target.path); // never a half-copied file under the real name
  return name;
}

/// Image and video Content of the program, bottom first (server.py scene_media, for the kinds this app draws): the
/// live Frame's live Deck only, with a file chosen. Hidden Content is listed too (Windows keeps a hidden video
/// playing, it is just not drawn); see [mediaShown].
List<Json> liveMedia(Json st) {
  final s = sc.liveScene(st);
  if (s == null) return const [];
  final deck = sc.liveDeckId(st, s);
  return [
    for (final l in sc.layersOf(s).reversed)
      if ((l['kind'] == 'image' || l['kind'] == 'video') &&
          sc.deckOf(s, l) == deck &&
          (sc.cOf(l)['file'] ?? '').toString().trim().isNotEmpty)
        l,
  ];
}

/// Is this media Content drawn (vcam/layers.py compose: visible, and not fully faded)?
bool mediaShown(Json l) => l['visible'] != false && mediaOpacity(l) > 0;

/// The Content's opacity, 0..1 (store.js cleanLayer).
double mediaOpacity(Json l) => _num(l['opacity'], 0, 1, 1);

/// Where and how a media Content sits in the picture (vcam/layers.py clean_layer, with its limits):
/// x, y = its centre as fractions of the picture; w = its width as a fraction of the picture's width; h = its
/// height as a fraction of the picture's height (0: from the picture's own shape); rotation in degrees (clockwise);
/// radius = the corner radius as a fraction of the picture's height; fit = 'cover' or 'contain' when h is set.
({double x, double y, double w, double h, double rotation, double radius, String fit, bool loop}) mediaBox(Json l) {
  final c = sc.cOf(l);
  final p = c['props'] is Map ? c['props'] as Map : const {};
  return (
    x: _num(c['x'], -.5, 1.5, .5),
    y: _num(c['y'], -.5, 1.5, .5),
    w: _num(c['w'], .01, 2, .3),
    h: _num(c['h'], 0, 2, 0),
    rotation: _num(c['rotation'], -360, 360, 0),
    radius: _num(c['radius'], 0, .5, 0),
    fit: p['fit'] == 'cover' ? 'cover' : 'contain',
    loop: c['loop'] != false,
  );
}

double _num(Object? v, double lo, double hi, double d) {
  final n = v is num ? v.toDouble() : double.tryParse('${v ?? ''}');
  return n == null || n.isNaN ? d : n.clamp(lo, hi).toDouble();
}
