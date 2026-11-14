package expo.modules.photoglass

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PhotoGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PhotoGlass")
    Constant("isSupported") { Build.VERSION.SDK_INT >= 33 }
    View(PhotoGlassView::class) {
      Prop("assetKey") { view: PhotoGlassView, value: String -> view.setAssetKey(value) }
      Prop("imageRect") { view: PhotoGlassView, value: List<Double> -> view.setImageRect(value) }
      Prop("clipRect") { view: PhotoGlassView, value: List<Double> -> view.setClipRect(value) }
      Prop("cornerRadius") { view: PhotoGlassView, value: Double -> view.setCornerRadius(value) }
      Prop("tintAmount") { view: PhotoGlassView, value: Double -> view.setTintAmount(value) }
    }
  }
}
