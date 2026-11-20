import CoreGraphics
import CryptoKit
import Darwin
import ExpoModulesCore
import Foundation
import ImageIO
import UIKit
import UniformTypeIdentifiers

@MainActor
private final class ModelDocumentPicker: NSObject, UIDocumentPickerDelegate {
  let completion: (URL?) -> Void

  init(completion: @escaping (URL?) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    completion(urls.first)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(nil)
  }
}

public final class NubiIOSRecognitionModule: Module {
  private static let modelSize = 501_360_338
  private static let modelHash = "b5a040e0339c3be06ee2d62956f75a9c132e71b7f41755ebd02890f0ca7ab560"
  private let worker = DispatchQueue(label: "org.nubi.recognition", qos: .userInitiated)
  private var session: NubiORTSession?
  private var installedFileVerified = false
  @MainActor private var pickerDelegate: ModelDocumentPicker?

  public func definition() -> ModuleDefinition {
    Name("NubiIOSRecognition")

    AsyncFunction("modelPresent") { (promise: Promise) in
      self.submit(promise) {
        let file = try self.modelDirectory().appendingPathComponent("model.onnx")
        return FileManager.default.fileExists(atPath: file.path)
      }
    }

    AsyncFunction("importModel") { (promise: Promise) in
      Task { @MainActor in self.presentPicker(promise) }
    }

    AsyncFunction("analyze") { (uri: String, promise: Promise) in
      self.submit(promise) {
        guard let url = URL(string: uri), url.isFileURL else { throw RecognitionFailure.unreadablePhoto }
        let tensor = try autoreleasepool { try FitPad.decode(url) }
        let session = try self.loadedSession()
        var result = try session.run(Self.data(tensor)).mapValues { $0.map(\.doubleValue) } as [String: Any]
        result["onnxSha256"] = Self.modelHash
        return result
      }
    }

    AsyncFunction("checkReferences") { (promise: Promise) in
      self.submit(promise) { try self.checkReferences() }
    }
  }

  private func submit(_ promise: Promise, work: @escaping () throws -> Any) {
    worker.async {
      do {
        let result = try autoreleasepool { try work() }
        promise.resolve(result)
      } catch let failure as RecognitionFailure {
        promise.reject(failure.code, failure.localizedDescription)
      } catch {
        promise.reject(RecognitionFailure.unavailable.code, "iOS recognition could not finish")
      }
    }
  }

  @MainActor
  private func presentPicker(_ promise: Promise) {
    guard pickerDelegate == nil, let controller = appContext?.utilities?.currentViewController() else {
      promise.reject("MODEL_IMPORT_FAILED", "Could not open Files")
      return
    }
    let delegate = ModelDocumentPicker { [weak self] source in
      guard let self else {
        promise.reject("MODEL_IMPORT_FAILED", "The import screen is no longer available")
        return
      }
      guard let source else {
        self.pickerDelegate = nil
        promise.resolve(false)
        return
      }
      self.worker.async {
        defer { DispatchQueue.main.async { self.pickerDelegate = nil } }
        do {
          try self.install(source)
          promise.resolve(true)
        } catch RecognitionFailure.incompatibleModel {
          promise.reject("MODEL_INCOMPATIBLE", "Model size or SHA-256 does not match")
        } catch {
          promise.reject("MODEL_IMPORT_FAILED", "Could not copy the model from Files")
        }
      }
    }
    pickerDelegate = delegate
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data], asCopy: false)
    picker.delegate = delegate
    controller.present(picker, animated: true)
  }

  private func modelDirectory() throws -> URL {
    let files = FileManager.default
    var path = try files.url(for: .applicationSupportDirectory, in: .userDomainMask,
                              appropriateFor: nil, create: true).appendingPathComponent("NubiRecognition", isDirectory: true)
    try files.createDirectory(at: path, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try path.setResourceValues(values)
    return path
  }

  private func install(_ source: URL) throws {
    let scoped = source.startAccessingSecurityScopedResource()
    defer { if scoped { source.stopAccessingSecurityScopedResource() } }
    let directory = try modelDirectory()
    let target = directory.appendingPathComponent("model.onnx")
    let pending = directory.appendingPathComponent(UUID().uuidString)
    let files = FileManager.default
    guard files.createFile(atPath: pending.path, contents: nil) else { throw RecognitionFailure.importFailed }
    defer { try? files.removeItem(at: pending) }
    var coordinationError: NSError?
    var importResult: Result<Void, Error>?
    NSFileCoordinator().coordinate(readingItemAt: source, options: [], error: &coordinationError) { coordinated in
      importResult = Result {
        let writer = try FileHandle(forWritingTo: pending)
        defer { try? writer.close() }
        try Self.verify(coordinated, copyTo: writer)
      }
    }
    if let coordinationError { throw coordinationError }
    guard let importResult else { throw RecognitionFailure.importFailed }
    try importResult.get()
    // Atomically replace only a verified model. A failed import leaves the previous model usable.
    guard rename(pending.path, target.path) == 0 else { throw RecognitionFailure.importFailed }
    installedFileVerified = true
  }

  private static func verify(_ url: URL, copyTo target: FileHandle? = nil) throws {
    let reader = try FileHandle(forReadingFrom: url)
    defer { try? reader.close() }
    var digest = SHA256()
    var bytes = 0
    while let block = try reader.read(upToCount: 1024 * 1024), !block.isEmpty {
      bytes += block.count
      guard bytes <= modelSize else { throw RecognitionFailure.incompatibleModel }
      digest.update(data: block)
      try target?.write(contentsOf: block)
    }
    let hash = digest.finalize().map { String(format: "%02x", $0) }.joined()
    guard bytes == modelSize, hash == modelHash else { throw RecognitionFailure.incompatibleModel }
  }

  private func loadedSession() throws -> NubiORTSession {
    if let session { return session }
    let url = try modelDirectory().appendingPathComponent("model.onnx")
    guard FileManager.default.fileExists(atPath: url.path) else { throw RecognitionFailure.missingModel }
    if !installedFileVerified {
      try Self.verify(url)
      installedFileVerified = true
    }
    do {
      let loaded = try NubiORTSession(modelPath: url.path)
      session = loaded
      return loaded
    } catch {
      throw RecognitionFailure.incompatibleModel
    }
  }

  private func checkReferences() throws -> [String: Any] {
    let alreadyLoaded = session != nil
    let start = DispatchTime.now()
    let session = try loadedSession()
    let loadMs = Self.elapsed(start)
    let controls = [
      (id: "generated-landscape", width: 384, height: 192, rotate: false),
      (id: "generated-orientation-6", width: 256, height: 256, rotate: true),
    ]
    let cases: [[String: Any]] = try controls.map { control in
      let expected = try FitPad.tensor(width: control.width, height: control.height, pixel: Self.controlPixel)
      let source = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".tiff")
      defer { try? FileManager.default.removeItem(at: source) }
      try Self.writeControl(to: source, width: control.width, height: control.height, rotate: control.rotate)
      let tensorStart = DispatchTime.now()
      let logits = try session.run(Self.data(expected)).mapValues { $0.map(\.doubleValue) }
      let inferenceMs = Self.elapsed(tensorStart)
      let photoStart = DispatchTime.now()
      let actual = try autoreleasepool { try FitPad.decode(source) }
      let preprocessingMs = Self.elapsed(photoStart)
      let photoLogits = try session.run(Self.data(actual)).mapValues { $0.map(\.doubleValue) }
      let difference = zip(actual, expected).reduce(Float.zero) { max($0, abs($1.0 - $1.1)) }
      return ["id": control.id, "logits": logits, "photoLogits": photoLogits, "inferenceMs": inferenceMs,
              "preprocessingMs": preprocessingMs, "maxInputDelta": difference]
    }
    return ["runtimeVersion": NubiORTSession.runtimeVersion(), "sessionAlreadyLoaded": alreadyLoaded,
            "loadMs": loadMs, "cases": cases]
  }

  private static func controlPixel(_ x: Int, _ y: Int) -> Int {
    ((x & 255) << 16) | ((y & 255) << 8) | ((x ^ y) & 255)
  }

  private static func writeControl(to url: URL, width: Int, height: Int, rotate: Bool) throws {
    var rgba = Data(capacity: width * height * 4)
    for y in 0..<height {
      for x in 0..<width {
        let pixel = rotate ? controlPixel(height - 1 - y, x) : controlPixel(x, y)
        rgba.append(UInt8((pixel >> 16) & 255))
        rgba.append(UInt8((pixel >> 8) & 255))
        rgba.append(UInt8(pixel & 255))
        rgba.append(255)
      }
    }
    guard let provider = CGDataProvider(data: rgba as CFData),
          let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                              bytesPerRow: width * 4, space: colorSpace,
                              bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                              provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.tiff.identifier as CFString, 1, nil)
    else { throw RecognitionFailure.unavailable }
    CGImageDestinationAddImage(destination, image, [kCGImagePropertyOrientation as String: rotate ? 6 : 1] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw RecognitionFailure.unavailable }
  }

  private static func elapsed(_ start: DispatchTime) -> Double {
    Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
  }

  private static func data(_ floats: [Float]) -> Data {
    floats.withUnsafeBufferPointer { Data(buffer: $0) }
  }
}
