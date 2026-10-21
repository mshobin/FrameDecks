// The FrameCast camera on the Mac: a CoreMedia IO camera extension (a system extension inside the app).
import CoreMediaIO
import Foundation

let providerSource = CameraProviderSource(clientQueue: nil)
CMIOExtensionProvider.startService(provider: providerSource.provider)
CFRunLoopRun()
