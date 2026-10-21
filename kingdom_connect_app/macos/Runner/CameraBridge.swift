// The KingdomConnect camera on the Mac, seen from the app (channel "kingdom_connect/camera", lib/ui/camera/mac_camera.dart):
//   status     → {supported, installed, watched, message}
//   install    → asks macOS to add the camera (the person approves it once in System Settings)
//   uninstall  → removes it
//   send       → {rgba, width, height}: one picture of the program; true when the camera took it
// The camera itself is the system extension in macos/KingdomConnectCamera. Pictures go to its sink stream through
// CoreMedia IO (adapted from ldenoue/cameraextension, MIT licence).
import Accelerate
import AVFoundation
import CoreMediaIO
import FlutterMacOS
import Foundation
import SystemExtensions

final class CameraBridge: NSObject, OSSystemExtensionRequestDelegate {
    static let cameraName = "KingdomConnect"
    private let channel: FlutterMethodChannel
    private var message = ""
    private var activating = true

    private var deviceID: CMIODeviceID?
    private var sourceStream: CMIOStreamID?
    private var sinkStream: CMIOStreamID?
    private var sinkQueue: CMSimpleQueue?
    private var pool: CVPixelBufferPool?
    private var poolSize = (0, 0)
    private var format: CMFormatDescription?

    init(messenger: FlutterBinaryMessenger) {
        channel = FlutterMethodChannel(name: "kingdom_connect/camera", binaryMessenger: messenger)
        super.init()
        allowVirtualCameras()
        channel.setMethodCallHandler { [weak self] call, result in
            guard let self else { return }
            switch call.method {
            case "status": result(self.status())
            case "install": self.submit(activate: true); result(nil)
            case "uninstall": self.submit(activate: false); result(nil)
            case "send":
                guard let args = call.arguments as? [String: Any], let data = args["rgba"] as? FlutterStandardTypedData,
                      let w = args["width"] as? Int, let h = args["height"] as? Int
                else { return result(false) }
                result(self.send(rgba: data.data, width: w, height: h))
            default: result(FlutterMethodNotImplemented)
            }
        }
    }

    // ---------- status ----------

    private var supported: Bool {
        if #available(macOS 12.3, *) { return true }
        return false
    }

    private func status() -> [String: Any] {
        guard supported else {
            return ["supported": false, "installed": false, "watched": false, "message": "The KingdomConnect camera needs macOS 12.3 or later."]
        }
        let installed = connect()
        return ["supported": true, "installed": installed, "watched": installed && watched(), "message": message]
    }

    /// Lets this app see the camera (CoreMedia IO hides virtual cameras from the app that does not ask).
    private func allowVirtualCameras() {
        var address = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
                                                mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                                mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        var allow: UInt32 = 1
        CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, UInt32(MemoryLayout<UInt32>.size), &allow)
    }

    /// Finds the camera and its two streams (source, then sink). False when the camera is not installed.
    private func connect() -> Bool {
        if let deviceID, deviceAlive(deviceID) { return true }
        deviceID = nil; sourceStream = nil; sinkStream = nil; sinkQueue = nil
        let types: [AVCaptureDevice.DeviceType]
        if #available(macOS 14.0, *) { types = [.external] } else { types = [.externalUnknown] }
        let devices = AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video, position: .unspecified).devices
        guard let camera = devices.first(where: { $0.localizedName == CameraBridge.cameraName }),
              let id = cmioDevice(uid: camera.uniqueID) else { return false }
        let streams = streamIDs(of: id)
        guard streams.count >= 2 else { return false }
        deviceID = id
        sourceStream = streams[0]
        sinkStream = streams[1]
        return true
    }

    private func deviceAlive(_ id: CMIODeviceID) -> Bool {
        var address = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(kCMIODevicePropertyDeviceIsAlive),
                                                mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                                mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        var alive: UInt32 = 0
        var used: UInt32 = 0
        return CMIOObjectGetPropertyData(id, &address, 0, nil, UInt32(MemoryLayout<UInt32>.size), &used, &alive) == 0 && alive != 0
    }

    private func cmioDevice(uid: String) -> CMIODeviceID? {
        var address = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyDevices),
                                                mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                                mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        var size: UInt32 = 0
        var used: UInt32 = 0
        CMIOObjectGetPropertyDataSize(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, &size)
        var ids = [CMIOObjectID](repeating: 0, count: Int(size) / MemoryLayout<CMIOObjectID>.size)
        CMIOObjectGetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, size, &used, &ids)
        address.mSelector = CMIOObjectPropertySelector(kCMIODevicePropertyDeviceUID)
        for id in ids {
            var uidSize: UInt32 = 0
            CMIOObjectGetPropertyDataSize(id, &address, 0, nil, &uidSize)
            var name: CFString = "" as CFString
            CMIOObjectGetPropertyData(id, &address, 0, nil, uidSize, &used, &name)
            if (name as String) == uid { return id }
        }
        return nil
    }

    private func streamIDs(of device: CMIODeviceID) -> [CMIOStreamID] {
        var address = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(kCMIODevicePropertyStreams),
                                                mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                                mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        var size: UInt32 = 0
        var used: UInt32 = 0
        CMIOObjectGetPropertyDataSize(device, &address, 0, nil, &size)
        var ids = [CMIOStreamID](repeating: 0, count: Int(size) / MemoryLayout<CMIOStreamID>.size)
        CMIOObjectGetPropertyData(device, &address, 0, nil, size, &used, &ids)
        return ids
    }

    /// The camera's "kcon" property: "1" while an app receives it (CameraProvider.swift).
    private func watched() -> Bool {
        guard let sourceStream else { return false }
        var address = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(0x6B63_6F6E),   // 'kcon'
                                                mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                                mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        guard CMIOObjectHasProperty(sourceStream, &address) else { return false }
        var size: UInt32 = 0
        var used: UInt32 = 0
        CMIOObjectGetPropertyDataSize(sourceStream, &address, 0, nil, &size)
        var value: CFString = "" as CFString
        CMIOObjectGetPropertyData(sourceStream, &address, 0, nil, size, &used, &value)
        return (value as String) == "1"
    }

    // ---------- install / remove ----------

    private func extensionIdentifier() -> String? {
        let folder = URL(fileURLWithPath: "Contents/Library/SystemExtensions", relativeTo: Bundle.main.bundleURL)
        let found = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil, options: .skipsHiddenFiles)) ?? []
        return found.compactMap { Bundle(url: $0)?.bundleIdentifier }.first
    }

    private func submit(activate: Bool) {
        guard supported else { message = "The KingdomConnect camera needs macOS 12.3 or later."; return }
        guard let id = extensionIdentifier() else {
            message = "This copy of Kingdom Connect was built without the camera."
            return
        }
        activating = activate
        message = activate ? "Waiting for macOS…" : "Removing…"
        let request = activate
            ? OSSystemExtensionRequest.activationRequest(forExtensionWithIdentifier: id, queue: .main)
            : OSSystemExtensionRequest.deactivationRequest(forExtensionWithIdentifier: id, queue: .main)
        request.delegate = self
        OSSystemExtensionManager.shared.submitRequest(request)
    }

    func request(_ request: OSSystemExtensionRequest, actionForReplacingExtension existing: OSSystemExtensionProperties,
                 withExtension ext: OSSystemExtensionProperties) -> OSSystemExtensionRequest.ReplacementAction {
        .replace   // a newer app brings a newer camera
    }

    func requestNeedsUserApproval(_ request: OSSystemExtensionRequest) {
        message = "Allow the KingdomConnect camera in System Settings → General → Login Items & Extensions → Camera Extensions."
    }

    func request(_ request: OSSystemExtensionRequest, didFinishWithResult result: OSSystemExtensionRequest.Result) {
        if result == .willCompleteAfterReboot {
            message = "Restart the Mac to finish."
        } else {
            message = activating ? "The KingdomConnect camera is installed." : "The KingdomConnect camera was removed."
        }
        deviceID = nil
    }

    func request(_ request: OSSystemExtensionRequest, didFailWithError error: Error) {
        let code = (error as NSError).code
        if code == OSSystemExtensionError.Code.unsupportedParentBundleLocation.rawValue {
            message = "Move Kingdom Connect to the Applications folder, open it from there, then try again."
        } else {
            message = "macOS did not \(activating ? "add" : "remove") the camera: \(error.localizedDescription)"
        }
    }

    // ---------- pictures ----------

    private func send(rgba: Data, width: Int, height: Int) -> Bool {
        guard supported, width > 0, height > 0, rgba.count >= width * height * 4 else { return false }
        guard connect(), let deviceID, let sinkStream else { return false }
        if sinkQueue == nil {
            var queue: Unmanaged<CMSimpleQueue>?
            guard CMIOStreamCopyBufferQueue(sinkStream, { _, _, _ in }, nil, &queue) == 0, let q = queue else { return false }
            sinkQueue = q.takeUnretainedValue()
            guard CMIODeviceStartStream(deviceID, sinkStream) == 0 else {
                sinkQueue = nil
                return false
            }
        }
        guard let queue = sinkQueue, CMSimpleQueueGetCount(queue) < CMSimpleQueueGetCapacity(queue) else { return false }
        guard let buffer = pixelBuffer(width: width, height: height) else { return false }

        CVPixelBufferLockBaseAddress(buffer, [])
        rgba.withUnsafeBytes { raw in
            var src = vImage_Buffer(data: UnsafeMutableRawPointer(mutating: raw.baseAddress!), height: vImagePixelCount(height),
                                    width: vImagePixelCount(width), rowBytes: width * 4)
            var dst = vImage_Buffer(data: CVPixelBufferGetBaseAddress(buffer), height: vImagePixelCount(height),
                                    width: vImagePixelCount(width), rowBytes: CVPixelBufferGetBytesPerRow(buffer))
            let rgbaToBgra: [UInt8] = [2, 1, 0, 3]
            vImagePermuteChannels_ARGB8888(&src, &dst, rgbaToBgra, vImage_Flags(kvImageNoFlags))
        }
        CVPixelBufferUnlockBaseAddress(buffer, [])

        var timing = CMSampleTimingInfo()
        timing.presentationTimeStamp = CMClockGetTime(CMClockGetHostTimeClock())
        var sample: CMSampleBuffer?
        guard let format,
              CMSampleBufferCreateForImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: buffer, dataReady: true,
                                                 makeDataReadyCallback: nil, refcon: nil, formatDescription: format,
                                                 sampleTiming: &timing, sampleBufferOut: &sample) == 0,
              let sample
        else { return false }
        return CMSimpleQueueEnqueue(queue, element: Unmanaged.passRetained(sample).toOpaque()) == 0
    }

    private func pixelBuffer(width: Int, height: Int) -> CVPixelBuffer? {
        if pool == nil || poolSize != (width, height) {
            let attributes: NSDictionary = [
                kCVPixelBufferWidthKey: width,
                kCVPixelBufferHeightKey: height,
                kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
                kCVPixelBufferIOSurfacePropertiesKey: [:] as NSDictionary,
            ]
            pool = nil
            CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attributes, &pool)
            format = nil
            CMVideoFormatDescriptionCreate(allocator: kCFAllocatorDefault, codecType: kCVPixelFormatType_32BGRA,
                                           width: Int32(width), height: Int32(height), extensions: nil, formatDescriptionOut: &format)
            poolSize = (width, height)
        }
        guard let pool else { return nil }
        var buffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &buffer)
        return buffer
    }
}
