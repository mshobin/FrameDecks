import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  private var camera: CameraBridge?   // the FrameCast camera (CameraBridge.swift)

  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)
    camera = CameraBridge(messenger: flutterViewController.engine.binaryMessenger)

    super.awakeFromNib()
  }
}
