import ExpoModulesCore

public class ScopeCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScopeCamera")

    View(ScopeCameraView.self) {
      Events("onObjects", "onBarcode", "onReady", "onError")

      Prop("torch") { (view: ScopeCameraView, on: Bool) in
        view.setTorch(on)
      }
      Prop("zoom") { (view: ScopeCameraView, zoom: Double) in
        view.setZoom(zoom)
      }
      Prop("active") { (view: ScopeCameraView, active: Bool) in
        view.setActive(active)
      }

      AsyncFunction("takePhoto") { (view: ScopeCameraView, promise: Promise) in
        view.takePhoto(promise)
      }
    }
  }
}
