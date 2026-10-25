// Media files: where a Content's file is, and how a file is stored in the media folder (server.py LAYERS_DIR and
// upload_layer_file).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:framedecks/engine/media.dart';

void main() {
  late Directory data;
  setUp(() => data = Directory.systemTemp.createTempSync('framedecks-media-'));
  tearDown(() => data.deleteSync(recursive: true));

  test('a file name is in the data folder\'s layers folder; nothing outside it', () {
    expect(mediaFile(data.path, 'logo.png')!.path, '${data.path}${Platform.pathSeparator}layers${Platform.pathSeparator}logo.png');
    expect(mediaFile(data.path, ''), isNull);
    expect(mediaFile(data.path, null), isNull);
    expect(mediaFile(data.path, '../kc-saved-content.json'), isNull);
    expect(mediaFile(data.path, '/etc/hosts'), isNull);
    expect(mediaFile(data.path, r'C:\Users\x.png'), isNull);
  });

  test('a copied file gets the Windows name: plain letters, lower-case extension, (2) when taken', () async {
    final src = File('${data.path}/My Logo!.PNG')..writeAsBytesSync([1, 2, 3]);
    expect(await importMedia(data.path, src), 'My Logo.png');
    expect(await importMedia(data.path, src), 'My Logo (2).png');
    expect(File('${mediaDir(data.path).path}/My Logo (2).png').readAsBytesSync(), [1, 2, 3]);
    expect(mediaName(mediaDir(data.path), '/x/***.mp4'), 'file.mp4');
    expect(mediaName(mediaDir(data.path), 'Psalm 23 – Grüße.mov'), 'Psalm 23  Grüße.mov');
  });

  test('extensions', () {
    expect(extensionOf('/a/b.c/Clip.MP4'), '.mp4');
    expect(extensionOf('noext'), '');
  });
}
