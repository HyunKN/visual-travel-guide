package expo.modules.nubirecognition

import kotlin.math.abs
import kotlin.math.max

internal const val SIDE = 256
internal const val TENSOR_SIZE = 3 * SIDE * SIDE
private const val WEIGHT_BITS = 22
private const val WEIGHT_SCALE = 1 shl WEIGHT_BITS
private val MEAN = floatArrayOf(0.48145466f, 0.4578275f, 0.40821073f)
private val STD = floatArrayOf(0.26862954f, 0.26130258f, 0.27577711f)
private const val PAD_RGB = (123 shl 16) or (117 shl 8) or 104

private data class Weights(val start: Int, val coefficients: IntArray)

private fun bilinearWeights(input: Int, output: Int): List<Weights> {
  val scale = input.toDouble() / output
  // Widen the triangle during downsampling, matching Pillow's separable bilinear filter.
  val radius = max(1.0, scale)
  return List(output) { index ->
    val center = (index + 0.5) * scale
    val start = (center - radius + 0.5).toInt().coerceAtLeast(0)
    val end = (center + radius + 0.5).toInt().coerceAtMost(input)
    val weights = DoubleArray(end - start) { offset ->
      (1.0 - abs((start + offset - center + 0.5) / radius)).coerceAtLeast(0.0)
    }
    val sum = weights.sum()
    Weights(start, IntArray(weights.size) { (0.5 + WEIGHT_SCALE * (weights[it] / sum)).toInt() })
  }
}

private inline fun sample(weights: Weights, pixel: (Int) -> Int): Int {
  var red = WEIGHT_SCALE / 2
  var green = red
  var blue = red
  weights.coefficients.forEachIndexed { offset, weight ->
    val rgb = pixel(weights.start + offset)
    red += ((rgb shr 16) and 255) * weight
    green += ((rgb shr 8) and 255) * weight
    blue += (rgb and 255) * weight
  }
  return ((red shr WEIGHT_BITS).coerceIn(0, 255) shl 16) or
    ((green shr WEIGHT_BITS).coerceIn(0, 255) shl 8) or (blue shr WEIGHT_BITS).coerceIn(0, 255)
}

/** Input rows are oriented RGB pixels. Output is normalized planar RGB (NCHW, batch 1). */
internal fun fitPadTensor(width: Int, height: Int, readRow: (Int, IntArray) -> Unit): FloatArray {
  val longSide = max(width, height)
  val resizedWidth = Math.rint(width.toDouble() / longSide * SIDE).toInt()
  val resizedHeight = Math.rint(height.toDouble() / longSide * SIDE).toInt()
  require(resizedWidth > 0 && resizedHeight > 0) { "Picture aspect ratio is too extreme" }
  val horizontal = if (width == resizedWidth) null else bilinearWeights(width, resizedWidth)
  val vertical = if (height == resizedHeight) null else bilinearWeights(height, resizedHeight)
  val resizedRows = IntArray(resizedWidth * height)
  val row = IntArray(width)
  for (y in 0 until height) {
    readRow(y, row)
    if (horizontal == null) row.copyInto(resizedRows, y * resizedWidth)
    else for (x in 0 until resizedWidth) {
      resizedRows[y * resizedWidth + x] = sample(horizontal[x]) { row[it] }
    }
  }

  val left = (SIDE - resizedWidth) / 2
  val top = (SIDE - resizedHeight) / 2
  val tensor = FloatArray(TENSOR_SIZE)
  for (y in 0 until SIDE) for (x in 0 until SIDE) {
    val imageX = x - left
    val imageY = y - top
    val rgb = if (imageX !in 0 until resizedWidth || imageY !in 0 until resizedHeight) PAD_RGB
    else if (vertical == null) resizedRows[imageY * resizedWidth + imageX]
    else sample(vertical[imageY]) { resizedRows[it * resizedWidth + imageX] }
    for (channel in 0..2) {
      val value = ((rgb shr (16 - 8 * channel)) and 255) / 255f
      tensor[channel * SIDE * SIDE + y * SIDE + x] = (value - MEAN[channel]) / STD[channel]
    }
  }
  return tensor
}
