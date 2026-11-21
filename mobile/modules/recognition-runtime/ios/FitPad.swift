import CoreGraphics
import Foundation
import ImageIO

enum RecognitionFailure: Error {
  case unreadablePhoto, unsupportedImage, missingModel, incompatibleModel, importFailed, unavailable

  var code: String {
    switch self {
    case .unreadablePhoto: return "PHOTO_UNREADABLE"
    case .unsupportedImage: return "IMAGE_UNSUPPORTED"
    case .missingModel: return "MODEL_NOT_READY"
    case .incompatibleModel: return "MODEL_INCOMPATIBLE"
    case .importFailed: return "MODEL_IMPORT_FAILED"
    case .unavailable: return "INFERENCE_FAILED"
    }
  }
}

enum FitPad {
  static let side = 256
  private static let weightBits = 22
  private static let weightScale = 1 << weightBits
  private static let padRGB = 0x7B7568
  private static let mean: [Float] = [0.48145466, 0.4578275, 0.40821073]
  private static let deviation: [Float] = [0.26862954, 0.26130258, 0.27577711]

  private struct Weights {
    let start: Int
    let values: [Int]
  }

  private static func weights(input: Int, output: Int) -> [Weights] {
    let scale = Double(input) / Double(output)
    let radius = max(1, scale)
    return (0..<output).map { index in
      let center = (Double(index) + 0.5) * scale
      let start = max(0, Int(center - radius + 0.5))
      let end = min(input, Int(center + radius + 0.5))
      let taps = (start..<end).map { max(0, 1 - abs((Double($0) - center + 0.5) / radius)) }
      let sum = taps.reduce(0, +)
      return Weights(start: start, values: taps.map { Int(0.5 + Double(weightScale) * ($0 / sum)) })
    }
  }

  private static func sample(_ weights: Weights, pixel: (Int) -> Int) -> Int {
    var red = weightScale / 2
    var green = red
    var blue = red
    for (offset, weight) in weights.values.enumerated() {
      let rgb = pixel(weights.start + offset)
      red += ((rgb >> 16) & 255) * weight
      green += ((rgb >> 8) & 255) * weight
      blue += (rgb & 255) * weight
    }
    return (min(255, red >> weightBits) << 16) |
      (min(255, green >> weightBits) << 8) |
      min(255, blue >> weightBits)
  }

  // Match the Pillow-compatible, two-pass Android filter and its integer rounding.
  static func tensor(width: Int, height: Int, pixel: (Int, Int) -> Int) throws -> [Float] {
    let longSide = Double(max(width, height))
    let resizedWidth = Int((Double(width) / longSide * Double(side)).rounded(.toNearestOrEven))
    let resizedHeight = Int((Double(height) / longSide * Double(side)).rounded(.toNearestOrEven))
    guard resizedWidth > 0, resizedHeight > 0 else { throw RecognitionFailure.unsupportedImage }
    let horizontal = width == resizedWidth ? nil : weights(input: width, output: resizedWidth)
    let vertical = height == resizedHeight ? nil : weights(input: height, output: resizedHeight)
    var rows = [Int32](repeating: 0, count: height * resizedWidth)
    for y in 0..<height {
      for x in 0..<resizedWidth {
        let rgb = horizontal.map { sample($0[x]) { pixel($0, y) } } ?? pixel(x, y)
        rows[y * resizedWidth + x] = Int32(rgb)
      }
    }
    let left = (side - resizedWidth) / 2
    let top = (side - resizedHeight) / 2
    let plane = side * side
    var result = [Float](repeating: 0, count: 3 * plane)
    for y in 0..<side {
      for x in 0..<side {
        let imageX = x - left
        let imageY = y - top
        var rgb = padRGB
        if (0..<resizedWidth).contains(imageX), (0..<resizedHeight).contains(imageY) {
          rgb = vertical.map { sample($0[imageY]) { Int(rows[$0 * resizedWidth + imageX]) } }
            ?? Int(rows[imageY * resizedWidth + imageX])
        }
        for channel in 0..<3 {
          let value = (rgb >> ((2 - channel) * 8)) & 255
          result[channel * plane + y * side + x] = (Float(value) / 255 - mean[channel]) / deviation[channel]
        }
      }
    }
    return result
  }

  static func decode(_ url: URL) throws -> [Float] {
    guard url.isFileURL,
          let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
          let width = props[kCGImagePropertyPixelWidth as String] as? Int,
          let height = props[kCGImagePropertyPixelHeight as String] as? Int else {
      throw RecognitionFailure.unreadablePhoto
    }
    guard width > 0, height > 0, width <= 16_384, height <= 16_384, width * height <= 25_000_000 else {
      throw RecognitionFailure.unsupportedImage
    }
    guard let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          image.width == width, image.height == height,
          let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
              CGBitmapInfo.byteOrder32Big.rawValue
          ),
          let pixels = context.data?.assumingMemoryBound(to: UInt8.self) else {
      throw RecognitionFailure.unreadablePhoto
    }
    context.setBlendMode(.copy)
    context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    let orientation = props[kCGImagePropertyOrientation as String] as? Int ?? 1
    let transposed = (5...8).contains(orientation)
    // Keep the original pixel grid and map the encoded EXIF orientation before resizing.
    defer { withExtendedLifetime(context) {} }
    return try tensor(width: transposed ? height : width, height: transposed ? width : height) { x, y in
      let raw: (Int, Int)
      switch orientation {
      case 2: raw = (width - 1 - x, y)
      case 3: raw = (width - 1 - x, height - 1 - y)
      case 4: raw = (x, height - 1 - y)
      case 5: raw = (y, x)
      case 6: raw = (y, height - 1 - x)
      case 7: raw = (width - 1 - y, height - 1 - x)
      case 8: raw = (width - 1 - y, x)
      default: raw = (x, y)
      }
      let offset = (raw.1 * width + raw.0) * 4
      let alpha = Int(pixels[offset + 3])
      if alpha == 0 { return 0 }
      func unpremultiply(_ channel: Int) -> Int {
        min(255, (Int(pixels[offset + channel]) * 255 + alpha / 2) / alpha)
      }
      return (unpremultiply(0) << 16) | (unpremultiply(1) << 8) | unpremultiply(2)
    }
  }
}
