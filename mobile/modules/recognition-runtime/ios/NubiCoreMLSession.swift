#if NUBI_COREML_BENCHMARK
import CoreML
import Darwin
import Foundation

final class NubiCoreMLSession {
  private let model: MLModel
  private static let inputShape = [1, 3, 256, 256]
  private static let outputWidths = ["buildingLogits": 3, "partLogits": 3, "focusLogits": 5]

  init(modelURL: URL) throws {
    let configuration = MLModelConfiguration()
    configuration.computeUnits = .all
    model = try MLModel(contentsOf: modelURL, configuration: configuration)
    let description = model.modelDescription
    guard Set(description.inputDescriptionsByName.keys) == Set(["image"]),
          let input = description.inputDescriptionsByName["image"]?.multiArrayConstraint,
          input.dataType == .float32,
          input.shape.map(\.intValue) == Self.inputShape,
          Set(description.outputDescriptionsByName.keys) == Set(Self.outputWidths.keys) else {
      throw RecognitionFailure.incompatibleModel
    }
    for (name, width) in Self.outputWidths {
      guard let output = description.outputDescriptionsByName[name]?.multiArrayConstraint,
            output.shape.map(\.intValue) == [1, width] else {
        throw RecognitionFailure.incompatibleModel
      }
    }
  }

  func run(_ tensor: Data) throws -> [String: [NSNumber]] {
    let input = try MLMultiArray(shape: Self.inputShape.map { NSNumber(value: $0) }, dataType: .float32)
    let capacity = input.count * MemoryLayout<Float>.stride
    guard tensor.count == capacity else { throw RecognitionFailure.incompatibleModel }
    _ = tensor.copyBytes(to: UnsafeMutableRawBufferPointer(start: input.dataPointer, count: capacity))
    let features = try MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(multiArray: input)])
    let outputs = try model.prediction(from: features)
    var result: [String: [NSNumber]] = [:]
    for (name, width) in Self.outputWidths {
      guard let array = outputs.featureValue(for: name)?.multiArrayValue,
            array.count == width else { throw RecognitionFailure.incompatibleModel }
      let values = (0..<width).map { array[$0] }
      guard values.allSatisfy({ $0.doubleValue.isFinite }) else { throw RecognitionFailure.unavailable }
      result[name] = values
    }
    return result
  }

  static func footprintKiB() -> Int? {
    var info = task_vm_info_data_t()
    let words = MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size
    var count = mach_msg_type_number_t(words)
    let status = withUnsafeMutablePointer(to: &info) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: words) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return status == KERN_SUCCESS ? Int(info.phys_footprint / 1024) : nil
  }
}
#endif
