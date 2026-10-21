// The Mac camera's channel, as the Swift side (macos/Runner/CameraBridge.swift) answers it.
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kingdom_connect/ui/camera/mac_camera.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('kingdom_connect/camera');
  final calls = <MethodCall>[];

  void answer(Object? Function(MethodCall c) reply) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (c) async {
      calls.add(c);
      return reply(c);
    });
  }

  tearDown(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null);
  });

  test('status: installed and watched', () async {
    answer((c) => {'supported': true, 'installed': true, 'watched': true, 'message': 'ok'});
    final s = await MacCamera().status();
    expect([s.supported, s.installed, s.watched, s.message], [true, true, true, 'ok']);
  });

  test('without the Swift side (another platform, an old build) the camera is simply not available', () async {
    final s = await MacCamera().status();
    expect(s.supported, isFalse);
    expect(s.installed, isFalse);
  });

  test('a picture goes over as RGBA with its size', () async {
    answer((c) => true);
    final rgba = Uint8List(MacCamera.width * MacCamera.height * 4);
    expect(await MacCamera().send(rgba, MacCamera.width, MacCamera.height), isTrue);
    final args = calls.single.arguments as Map;
    expect(calls.single.method, 'send');
    expect([args['width'], args['height'], (args['rgba'] as Uint8List).length], [1280, 720, 1280 * 720 * 4]);
  });

  test('install and remove', () async {
    answer((c) => null);
    await MacCamera().install();
    await MacCamera().uninstall();
    expect(calls.map((c) => c.method), ['install', 'uninstall']);
  });
}
