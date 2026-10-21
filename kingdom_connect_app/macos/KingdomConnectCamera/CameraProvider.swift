// The KingdomConnect camera on the Mac. Adapted from ldenoue/cameraextension (MIT licence, see
// LICENSE-cameraextension-MIT.txt), the design Apple describes for camera extensions that show an app's picture:
//
//   - the source stream is what Zoom, Teams, FaceTime, OBS… receive;
//   - the sink stream is where the Kingdom Connect app puts its picture (CameraBridge.swift); every picture that
//     arrives on the sink goes straight out on the source.
//   - while the app sends nothing, the camera shows the app's navy with "Kingdom Connect".
//   - the source stream's "kcon" property says whether anyone is watching ("1"), so the app only draws pictures
//     for the camera while they are needed.
import AppKit
import CoreMediaIO
import Foundation
import IOKit.audio
import os.log

let cameraName = "KingdomConnect"
let cameraWidth: Int32 = 1280
let cameraHeight: Int32 = 720
let cameraFrameRate = 30
/// Read by the app: "1" while an app receives the camera.
let watchingProperty = CMIOExtensionProperty(rawValue: "4cc_kcon_glob_0000")

private let log = OSLog(subsystem: "org.kingdomconnect.kingdomConnect.Camera", category: "camera")

final class CameraDeviceSource: NSObject, CMIOExtensionDeviceSource {
    private(set) var device: CMIOExtensionDevice!
    private(set) var sourceStream: CameraStreamSource!
    private(set) var sinkStream: CameraStreamSink!

    private var watchers = 0
    private var sinkRunning = false
    private var lastSinkFrame = DispatchTime(uptimeNanoseconds: 0)
    private var timer: DispatchSourceTimer?
    private let timerQueue = DispatchQueue(label: "KingdomConnect.camera.idle", qos: .userInteractive)
    private var description_: CMFormatDescription!
    private var pool: CVPixelBufferPool!
    private var idleFrame: CVPixelBuffer?

    init(localizedName: String) {
        super.init()
        let deviceID = UUID(uuidString: "6A3C2F4E-8B1D-4C55-9E2A-7F1B3D5C9A10")!   // the same camera across restarts
        device = CMIOExtensionDevice(localizedName: localizedName, deviceID: deviceID, legacyDeviceID: deviceID.uuidString, source: self)

        CMVideoFormatDescriptionCreate(allocator: kCFAllocatorDefault, codecType: kCVPixelFormatType_32BGRA,
                                       width: cameraWidth, height: cameraHeight, extensions: nil, formatDescriptionOut: &description_)
        let attributes: NSDictionary = [
            kCVPixelBufferWidthKey: cameraWidth,
            kCVPixelBufferHeightKey: cameraHeight,
            kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
            kCVPixelBufferIOSurfacePropertiesKey: [:] as NSDictionary,
        ]
        CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attributes, &pool)
        let frameDuration = CMTime(value: 1, timescale: Int32(cameraFrameRate))
        let format = CMIOExtensionStreamFormat(formatDescription: description_, maxFrameDuration: frameDuration,
                                               minFrameDuration: frameDuration, validFrameDurations: nil)
        sourceStream = CameraStreamSource(localizedName: "KingdomConnect.Video", streamID: UUID(), streamFormat: format, device: device)
        sinkStream = CameraStreamSink(localizedName: "KingdomConnect.Video.Sink", streamID: UUID(), streamFormat: format, device: device)
        do {
            try device.addStream(sourceStream.stream)
            try device.addStream(sinkStream.stream)
        } catch {
            fatalError("KingdomConnect: could not add the camera's streams: \(error.localizedDescription)")
        }
    }

    var isWatched: Bool { watchers > 0 }

    var availableProperties: Set<CMIOExtensionProperty> { [.deviceTransportType, .deviceModel] }

    func deviceProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionDeviceProperties {
        let p = CMIOExtensionDeviceProperties(dictionary: [:])
        if properties.contains(.deviceTransportType) { p.transportType = kIOAudioDeviceTransportTypeVirtual }
        if properties.contains(.deviceModel) { p.model = "Kingdom Connect" }
        return p
    }

    func setDeviceProperties(_ deviceProperties: CMIOExtensionDeviceProperties) throws {}

    // ---- the source stream (what other apps receive) ----

    func startStreaming() {
        watchers += 1
        guard timer == nil else { return }
        // while the app sends nothing, show the idle picture
        let t = DispatchSource.makeTimerSource(flags: .strict, queue: timerQueue)
        t.schedule(deadline: .now(), repeating: 1.0 / Double(cameraFrameRate), leeway: .milliseconds(2))
        t.setEventHandler { [weak self] in self?.sendIdleFrameIfNeeded() }
        t.resume()
        timer = t
    }

    func stopStreaming() {
        watchers = max(0, watchers - 1)
        if watchers == 0 {
            timer?.cancel()
            timer = nil
        }
    }

    private func sendIdleFrameIfNeeded() {
        // the app's pictures are going out: nothing to do (half a second of silence brings the idle picture back)
        if sinkRunning, DispatchTime.now().uptimeNanoseconds - lastSinkFrame.uptimeNanoseconds < 500_000_000 { return }
        guard let buffer = idleFrame ?? makeIdleFrame() else { return }
        idleFrame = buffer
        var timing = CMSampleTimingInfo()
        timing.presentationTimeStamp = CMClockGetTime(CMClockGetHostTimeClock())
        var sample: CMSampleBuffer?
        let err = CMSampleBufferCreateForImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: buffer, dataReady: true,
                                                     makeDataReadyCallback: nil, refcon: nil, formatDescription: description_,
                                                     sampleTiming: &timing, sampleBufferOut: &sample)
        if err == 0, let sample {
            sourceStream.stream.send(sample, discontinuity: [], hostTimeInNanoseconds: UInt64(timing.presentationTimeStamp.seconds * Double(NSEC_PER_SEC)))
        }
    }

    /// The app's navy (#0B1222) with "Kingdom Connect" in its gold.
    private func makeIdleFrame() -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &buffer) == 0, let buffer else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        let w = CVPixelBufferGetWidth(buffer), h = CVPixelBufferGetHeight(buffer)
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue)
        else { return nil }
        ctx.setFillColor(CGColor(red: 0x0B / 255.0, green: 0x12 / 255.0, blue: 0x22 / 255.0, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        let text = NSAttributedString(string: "Kingdom Connect", attributes: [
            .font: NSFont.systemFont(ofSize: CGFloat(h) / 14, weight: .semibold),
            .foregroundColor: NSColor(red: 0xE3 / 255.0, green: 0xB7 / 255.0, blue: 0x5A / 255.0, alpha: 1),
            .paragraphStyle: style,
        ])
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
        let size = text.size()
        text.draw(in: CGRect(x: 0, y: (CGFloat(h) - size.height) / 2, width: CGFloat(w), height: size.height))
        NSGraphicsContext.restoreGraphicsState()
        return buffer
    }

    // ---- the sink stream (the app's pictures) ----

    func startStreamingSink(client: CMIOExtensionClient) {
        sinkRunning = true
        consume(from: client)
    }

    func stopStreamingSink() {
        sinkRunning = false
    }

    private func consume(from client: CMIOExtensionClient) {
        guard sinkRunning else { return }
        sinkStream.stream.consumeSampleBuffer(from: client) { [weak self] sample, sequence, _, _, error in
            guard let self else { return }
            if let sample {
                self.lastSinkFrame = .now()
                let now = CMClockGetTime(CMClockGetHostTimeClock())
                if self.watchers > 0 {
                    self.sourceStream.stream.send(sample, discontinuity: [], hostTimeInNanoseconds: UInt64(now.seconds * Double(NSEC_PER_SEC)))
                }
                self.sinkStream.stream.notifyScheduledOutputChanged(
                    CMIOExtensionScheduledOutput(sequenceNumber: sequence, hostTimeInNanoseconds: UInt64(now.seconds * Double(NSEC_PER_SEC))))
            } else if let error {
                os_log(.debug, log: log, "sink: %{public}@", error.localizedDescription)
            }
            self.consume(from: client)
        }
    }
}

final class CameraStreamSource: NSObject, CMIOExtensionStreamSource {
    private(set) var stream: CMIOExtensionStream!
    let device: CMIOExtensionDevice
    private let format: CMIOExtensionStreamFormat

    init(localizedName: String, streamID: UUID, streamFormat: CMIOExtensionStreamFormat, device: CMIOExtensionDevice) {
        self.device = device
        format = streamFormat
        super.init()
        stream = CMIOExtensionStream(localizedName: localizedName, streamID: streamID, direction: .source, clockType: .hostTime, source: self)
    }

    var formats: [CMIOExtensionStreamFormat] { [format] }
    var activeFormatIndex: Int = 0
    var availableProperties: Set<CMIOExtensionProperty> { [.streamActiveFormatIndex, .streamFrameDuration, watchingProperty] }

    func streamProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionStreamProperties {
        let p = CMIOExtensionStreamProperties(dictionary: [:])
        if properties.contains(.streamActiveFormatIndex) { p.activeFormatIndex = 0 }
        if properties.contains(.streamFrameDuration) { p.frameDuration = CMTime(value: 1, timescale: Int32(cameraFrameRate)) }
        if properties.contains(watchingProperty) {
            let watched = (device.source as? CameraDeviceSource)?.isWatched ?? false
            p.setPropertyState(CMIOExtensionPropertyState(value: (watched ? "1" : "0") as NSString), forProperty: watchingProperty)
        }
        return p
    }

    func setStreamProperties(_ streamProperties: CMIOExtensionStreamProperties) throws {
        if let i = streamProperties.activeFormatIndex { activeFormatIndex = i }
    }

    func authorizedToStartStream(for client: CMIOExtensionClient) -> Bool { true }

    func startStream() throws { (device.source as? CameraDeviceSource)?.startStreaming() }

    func stopStream() throws { (device.source as? CameraDeviceSource)?.stopStreaming() }
}

final class CameraStreamSink: NSObject, CMIOExtensionStreamSource {
    private(set) var stream: CMIOExtensionStream!
    let device: CMIOExtensionDevice
    private let format: CMIOExtensionStreamFormat
    private var client: CMIOExtensionClient?

    init(localizedName: String, streamID: UUID, streamFormat: CMIOExtensionStreamFormat, device: CMIOExtensionDevice) {
        self.device = device
        format = streamFormat
        super.init()
        stream = CMIOExtensionStream(localizedName: localizedName, streamID: streamID, direction: .sink, clockType: .hostTime, source: self)
    }

    var formats: [CMIOExtensionStreamFormat] { [format] }
    var activeFormatIndex: Int = 0
    var availableProperties: Set<CMIOExtensionProperty> {
        [.streamActiveFormatIndex, .streamFrameDuration, .streamSinkBufferQueueSize, .streamSinkBuffersRequiredForStartup,
         .streamSinkBufferUnderrunCount, .streamSinkEndOfData]
    }

    func streamProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionStreamProperties {
        let p = CMIOExtensionStreamProperties(dictionary: [:])
        if properties.contains(.streamActiveFormatIndex) { p.activeFormatIndex = 0 }
        if properties.contains(.streamFrameDuration) { p.frameDuration = CMTime(value: 1, timescale: Int32(cameraFrameRate)) }
        if properties.contains(.streamSinkBufferQueueSize) { p.sinkBufferQueueSize = 1 }
        if properties.contains(.streamSinkBuffersRequiredForStartup) { p.sinkBuffersRequiredForStartup = 1 }
        return p
    }

    func setStreamProperties(_ streamProperties: CMIOExtensionStreamProperties) throws {
        if let i = streamProperties.activeFormatIndex { activeFormatIndex = i }
    }

    /// Only the Kingdom Connect app may send pictures (the extension and the app share a team).
    func authorizedToStartStream(for client: CMIOExtensionClient) -> Bool {
        self.client = client
        return true
    }

    func startStream() throws {
        if let client, let source = device.source as? CameraDeviceSource { source.startStreamingSink(client: client) }
    }

    func stopStream() throws { (device.source as? CameraDeviceSource)?.stopStreamingSink() }
}

final class CameraProviderSource: NSObject, CMIOExtensionProviderSource {
    private(set) var provider: CMIOExtensionProvider!
    private var deviceSource: CameraDeviceSource!

    init(clientQueue: DispatchQueue?) {
        super.init()
        provider = CMIOExtensionProvider(source: self, clientQueue: clientQueue)
        deviceSource = CameraDeviceSource(localizedName: cameraName)
        do {
            try provider.addDevice(deviceSource.device)
        } catch {
            fatalError("KingdomConnect: could not add the camera: \(error.localizedDescription)")
        }
    }

    func connect(to client: CMIOExtensionClient) throws {}
    func disconnect(from client: CMIOExtensionClient) {}
    var availableProperties: Set<CMIOExtensionProperty> { [.providerManufacturer] }

    func providerProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionProviderProperties {
        let p = CMIOExtensionProviderProperties(dictionary: [:])
        if properties.contains(.providerManufacturer) { p.manufacturer = "Kingdom Connect" }
        return p
    }

    func setProviderProperties(_ providerProperties: CMIOExtensionProviderProperties) throws {}
}
