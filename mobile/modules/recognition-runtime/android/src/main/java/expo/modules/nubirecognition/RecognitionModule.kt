package expo.modules.nubirecognition

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtException
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.graphics.ColorSpace
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.os.Debug
import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.security.MessageDigest
import java.util.concurrent.Executors
import kotlin.math.abs

class RecognitionModule : Module() {
  // Keep model loading and inference off Expo's shared module queue.
  private val worker = Executors.newSingleThreadExecutor()
  private val modelHash = "b5a040e0339c3be06ee2d62956f75a9c132e71b7f41755ebd02890f0ca7ab560"
  private val inputShape = longArrayOf(1, 3, SIDE.toLong(), SIDE.toLong())
  private val outputSizes = mapOf("buildingLogits" to 3, "partLogits" to 3, "focusLogits" to 5)
  private val controlIds = listOf("exif-6", "landscape", "portrait", "small", "square")
  private var session: OrtSession? = null

  override fun definition() = ModuleDefinition {
    Name("NubiRecognition")

    AsyncFunction("analyze") { photoUri: String, promise: Promise ->
      submit(promise) {
        val uri = Uri.parse(photoUri)
        if (uri.scheme !in listOf("file", "content")) fail("PHOTO_UNREADABLE", "Expected a local photo")
        val model = modelFile()
        val tensor = preparePhoto(uri)
        val output = run(getSession(model), tensor)
        output + ("onnxSha256" to modelHash)
      }
    }

    AsyncFunction("checkReferences") { promise: Promise ->
      submit(promise) {
        val context = context()
        if ((context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
          fail("MODEL_NOT_READY", "Reference checks require a debug build")
        }
        checkReferences()
      }
    }

    OnDestroy {
      worker.execute { session?.close() }
      worker.shutdown()
    }
  }

  private fun submit(promise: Promise, work: () -> Map<String, Any>) {
    worker.execute {
      val response = try {
        work()
      } catch (error: CodedException) {
        promise.reject(error)
        return@execute
      } catch (error: Exception) {
        promise.reject("INFERENCE_FAILED", "Android recognition failed", error)
        return@execute
      } catch (error: OutOfMemoryError) {
        promise.reject("INFERENCE_FAILED", "Not enough memory for recognition", null)
        return@execute
      }
      promise.resolve(response)
    }
  }

  private fun context() = appContext.reactContext
    ?: fail("INFERENCE_FAILED", "Recognition context is unavailable")

  private fun modelFile(): File {
    val file = File(context().filesDir, "nubi-runtime/model.onnx")
    if (!file.isFile) fail("MODEL_NOT_READY", "Local recognition model is missing")
    if (file.length() != 501_360_338L) fail("MODEL_INCOMPATIBLE", "Model size does not match")
    return file
  }

  private fun getSession(file: File): OrtSession {
    session?.let { return it }
    val digest = MessageDigest.getInstance("SHA-256")
    try {
      file.inputStream().use { input ->
        val buffer = ByteArray(1024 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          digest.update(buffer, 0, count)
        }
      }
    } catch (error: IOException) {
      fail("MODEL_NOT_READY", "Local model could not be read", error)
    }
    val hash = digest.digest().joinToString("") { "%02x".format(it) }
    if (hash != modelHash) fail("MODEL_INCOMPATIBLE", "Model SHA-256 does not match")

    val created = try {
      OrtSession.SessionOptions().use { options ->
        options.setIntraOpNumThreads(2)
        options.setInterOpNumThreads(1)
        options.setMemoryPatternOptimization(false)
        options.setCPUArenaAllocator(false)
        OrtEnvironment.getEnvironment().createSession(file.absolutePath, options)
      }
    } catch (error: OrtException) {
      fail("MODEL_INCOMPATIBLE", "ONNX Runtime could not load the model", error)
    } catch (error: LinkageError) {
      fail("MODEL_INCOMPATIBLE", "ONNX Runtime is unavailable for this Android build", error)
    }
    try {
      val validInput = created.inputInfo.keys == setOf("image") &&
        matches(created.inputInfo["image"]?.info, inputShape)
      val validOutputs = created.outputInfo.keys == outputSizes.keys && outputSizes.all { (name, size) ->
        matches(created.outputInfo[name]?.info, longArrayOf(1, size.toLong()))
      }
      if (!validInput || !validOutputs) fail("MODEL_INCOMPATIBLE", "Unexpected tensor metadata")
    } catch (error: Exception) {
      created.close()
      throw error
    }
    session = created
    return created
  }

  private fun matches(info: Any?, shape: LongArray): Boolean =
    info is TensorInfo && info.type == OnnxJavaType.FLOAT && info.shape.contentEquals(shape)

  private fun preparePhoto(uri: Uri): FloatArray {
    if (Build.VERSION.SDK_INT < 28) fail("IMAGE_UNSUPPORTED", "Photo recognition requires Android 9 or later")
    val picture = try {
      // ImageDecoder applies the encoded orientation. Decode pixels before fit/pad to avoid resampling twice.
      ImageDecoder.decodeBitmap(ImageDecoder.createSource(context().contentResolver, uri)) { decoder, info, _ ->
        val (width, height) = info.size.let { it.width to it.height }
        if (width <= 0 || height <= 0 || width > 16384 || height > 16384 || width.toLong() * height > 25_000_000) {
          fail("IMAGE_UNSUPPORTED", "This photo exceeds the decoder size limit")
        }
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        decoder.setTargetColorSpace(ColorSpace.get(ColorSpace.Named.SRGB))
        decoder.isUnpremultipliedRequired = true
      }
    } catch (error: IOException) {
      fail("PHOTO_UNREADABLE", "Could not decode the selected photo", error)
    } catch (error: SecurityException) {
      fail("PHOTO_UNREADABLE", "Could not open the selected photo", error)
    } catch (error: IllegalArgumentException) {
      fail("IMAGE_UNSUPPORTED", "Could not decode this image format", error)
    }
    try {
      return fitPadTensor(picture.width, picture.height) { y, row ->
        picture.getPixels(row, 0, picture.width, 0, y, picture.width, 1)
      }
    } catch (error: IllegalArgumentException) {
      fail("IMAGE_UNSUPPORTED", "Could not resize this photo", error)
    } finally {
      picture.recycle()
    }
  }

  private fun run(ortSession: OrtSession, values: FloatArray): Map<String, List<Float>> {
    try {
      OnnxTensor.createTensor(OrtEnvironment.getEnvironment(), FloatBuffer.wrap(values), inputShape).use { tensor ->
        ortSession.run(mapOf("image" to tensor)).use { result ->
          return outputSizes.mapValues { (name, size) ->
            val output = result.get(name).orElse(null) as? OnnxTensor
              ?: fail("MODEL_INCOMPATIBLE", "Required tensor is missing")
            val data = output.floatBuffer
            if (data.remaining() != size) fail("MODEL_INCOMPATIBLE", "Wrong number of logits")
            List(size) {
              data.get().also { if (!it.isFinite()) fail("INFERENCE_FAILED", "Non-finite logit") }
            }
          }
        }
      }
    } catch (error: OrtException) {
      fail("INFERENCE_FAILED", "ONNX inference failed", error)
    }
  }

  private fun checkReferences(): Map<String, Any> {
    val root = File(context().filesDir, "nubi-runtime/reference")
    val files = controlIds.map { id ->
      val folder = File(root, id)
      val input = File(folder, "input.f32")
      val original = File(folder, if (id == "exif-6") "source.jpg" else "source.png")
      if (input.length() != TENSOR_SIZE * 4L || !original.isFile) {
        fail("MODEL_NOT_READY", "Reference files are missing or incomplete")
      }
      Triple(id, input, original)
    }
    val beforePss = Debug.getPss()
    val alreadyLoaded = session != null
    val loadStart = SystemClock.elapsedRealtime()
    val ort = getSession(modelFile())
    val loadMs = SystemClock.elapsedRealtime() - loadStart
    return mapOf(
      "runtimeVersion" to OrtEnvironment.getEnvironment().version,
      "sessionAlreadyLoaded" to alreadyLoaded,
      "loadMs" to loadMs,
      "beforePssKb" to beforePss,
      "afterLoadPssKb" to Debug.getPss(),
      "cases" to files.map { (id, input, original) ->
        val expected = FloatArray(TENSOR_SIZE)
        ByteBuffer.wrap(input.readBytes()).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(expected)
        val start = SystemClock.elapsedRealtime()
        val logits = run(ort, expected)
        val inferenceMs = SystemClock.elapsedRealtime() - start
        val photoStart = SystemClock.elapsedRealtime()
        val actual = preparePhoto(Uri.fromFile(original))
        val pixelMs = SystemClock.elapsedRealtime() - photoStart
        val maxDelta = actual.indices.maxOf { abs(actual[it] - expected[it]) }
        val photoLogits = run(ort, actual)
        mapOf("id" to id, "logits" to logits, "photoLogits" to photoLogits,
          "inferenceMs" to inferenceMs, "preprocessingMs" to pixelMs, "maxInputDelta" to maxDelta,
          "pssKb" to Debug.getPss())
      }
    )
  }

  private fun fail(code: String, message: String, cause: Throwable? = null): Nothing =
    throw CodedException(code, message, cause)
}
