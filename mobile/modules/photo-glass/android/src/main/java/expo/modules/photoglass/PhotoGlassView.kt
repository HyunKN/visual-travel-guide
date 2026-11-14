package expo.modules.photoglass

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import android.util.LruCache
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors

/** Samples registered photos only, never a screenshot or arbitrary URI. */
class PhotoGlassView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var assetKey = ""
  private var request = 0
  private var bitmap: Bitmap? = null
  private var renderer: GlassRenderer? = null
  private var imageRect = floatArrayOf(0f, 0f, 0f, 0f)
  private var clipRect = floatArrayOf(0f, 0f, 0f, 0f)
  private var radius = 24f
  private var tint = .1f
  private val density get() = resources.displayMetrics.density

  init {
    setWillNotDraw(false)
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  fun setAssetKey(value: String) {
    if (assetKey == value) return
    assetKey = value
    loadPhoto()
  }

  fun setImageRect(value: List<Double>) {
    if (value.size != 4 || value.any { !it.isFinite() }) return
    imageRect = value.map { it.toFloat() * density }.toFloatArray()
    invalidate()
  }

  fun setClipRect(value: List<Double>) {
    if (value.size != 4 || value.any { !it.isFinite() }) return
    clipRect = value.map { it.toFloat() * density }.toFloatArray()
    invalidate()
  }

  fun setCornerRadius(value: Double) {
    radius = if (value.isFinite()) value.toFloat().coerceAtLeast(0f) * density else 24f * density
    invalidate()
  }

  fun setTintAmount(value: Double) {
    tint = if (value.isFinite()) value.toFloat().coerceIn(0f, .24f) else .1f
    invalidate()
  }

  private fun loadPhoto() {
    val version = ++request
    val key = assetKey
    bitmap = null
    renderer = null
    invalidate()
    if (key !in allowedAssets || Build.VERSION.SDK_INT < 33) return
    val assetManager = context.assets
    decoder.execute {
      val decoded = cache.get(key) ?: runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        assetManager.open(key).use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        assetManager.open(key).use { BitmapFactory.decodeStream(it, null, options) }
          ?.also { cache.put(key, it) }
      }.getOrNull()
      post {
        if (version == request && key == assetKey) {
          bitmap = decoded
          // Failure leaves the aligned JS photo and white readability fallback visible.
          renderer = decoded?.let { runCatching { GlassRenderer(it) }.getOrNull() }
          invalidate()
        }
      }
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (bitmap == null && assetKey.isNotEmpty()) loadPhoto()
  }

  override fun onDetachedFromWindow() {
    ++request
    bitmap = null
    renderer = null
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (Build.VERSION.SDK_INT < 33 || !canvas.isHardwareAccelerated || width <= 0 || height <= 0
      || imageRect[2] <= 0 || imageRect[3] <= 0) return
    try {
      renderer?.draw(canvas, width.toFloat(), height.toFloat(), imageRect, clipRect, radius, tint, density)
    } catch (_: RuntimeException) {
      renderer = null
      invalidate()
    }
  }

  companion object {
    private val allowedAssets = setOf("geunjeongjeon.jpg", "gyotaejeon.jpg", "gwanghwamun.jpg")
    private val decoder = Executors.newSingleThreadExecutor()
    // Shared bounded photo cache. Never recycle a bitmap a live view may use.
    private val cache = object : LruCache<String, Bitmap>(16 * 1024 * 1024) {
      override fun sizeOf(key: String, value: Bitmap) = value.allocationByteCount
    }
  }
}

/** API 33 objects stay behind the guarded native path. All geometry is physical px. */
@androidx.annotation.RequiresApi(33)
private class GlassRenderer(bitmap: Bitmap) {
  private val shader = RuntimeShader(AGSL)
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

  init {
    val photo = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
    photo.setFilterMode(BitmapShader.FILTER_MODE_LINEAR)
    shader.setInputShader("photo", photo)
    shader.setFloatUniform("bitmapSize", bitmap.width.toFloat(), bitmap.height.toFloat())
    paint.shader = shader
  }

  fun draw(canvas: Canvas, width: Float, height: Float, image: FloatArray, clip: FloatArray, radius: Float, tint: Float, density: Float) {
    val rounded = radius.coerceIn(0f, minOf(width, height) / 2f)
    shader.setFloatUniform("viewSize", width, height)
    shader.setFloatUniform("imageOrigin", image[0], image[1])
    shader.setFloatUniform("imageSize", image[2], image[3])
    shader.setFloatUniform("clipOrigin", clip[0], clip[1])
    shader.setFloatUniform("clipSize", clip[2], clip[3])
    shader.setFloatUniform("radius", rounded)
    shader.setFloatUniform("rimWidth", minOf(12f * density, minOf(width, height) / 2f))
    shader.setFloatUniform("bend", 4f * density)
    shader.setFloatUniform("density", density)
    shader.setFloatUniform("tint", tint)
    canvas.drawRoundRect(0f, 0f, width, height, rounded, rounded, paint)
  }

  companion object {
    // One SDF boundary supplies the normal through the rounded corners.
    // sin² is zero with zero slope at both ends of the rim; the center is exact.
    private const val AGSL = """
      uniform shader photo;
      uniform float2 bitmapSize;
      uniform float2 viewSize;
      uniform float2 imageOrigin;
      uniform float2 imageSize;
      uniform float2 clipOrigin;
      uniform float2 clipSize;
      uniform float radius;
      uniform float rimWidth;
      uniform float bend;
      uniform float density;
      uniform float tint;

      float distanceToRim(float2 p) {
        float2 q = abs(p - viewSize * 0.5) - (viewSize * 0.5 - radius);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      bool insideClip(float2 p) {
        return all(greaterThanEqual(p, clipOrigin)) && all(lessThanEqual(p, clipOrigin + clipSize));
      }

      half4 main(float2 p) {
        float d = distanceToRim(p);
        float e = max(0.5, density * 0.5);
        float2 gradient = float2(distanceToRim(p + float2(e, 0)) - distanceToRim(p - float2(e, 0)),
                                 distanceToRim(p + float2(0, e)) - distanceToRim(p - float2(0, e)));
        float2 normal = gradient / max(length(gradient), 0.0001);
        float t = clamp(-d / max(rimWidth, 0.001), 0.0, 1.0);
        float profile = t >= 1.0 ? 0.0 : sin(3.14159265 * t);
        float2 samplePosition = p - normal * bend * profile * profile;
        float2 uv = (samplePosition - imageOrigin) / imageSize;
        half4 color = half4(0.961, 0.961, 0.953, 1);
        // The stage/photo intersection is authoritative. No letterbox edge smear.
        if (insideClip(p) && insideClip(samplePosition)
          && all(greaterThanEqual(uv, float2(0))) && all(lessThanEqual(uv, float2(1)))) {
          float2 pixel = clamp(uv * bitmapSize, float2(0.5), bitmapSize - 0.5);
          color = photo.eval(pixel);
          color.rgb = mix(color.rgb, half3(1), half(tint));
        }
        float light = dot(normal, normalize(float2(-0.6, -0.8)));
        float edgeLight = exp(-max(-d, 0.0) / max(0.65 * density, 0.001));
        color.rgb = mix(color.rgb, half3(1), half(max(light, 0.0) * edgeLight * 0.25));
        color.rgb *= half(1.0 - max(-light, 0.0) * edgeLight * 0.08);
        return color;
      }
    """
  }
}
