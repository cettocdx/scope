import AVFoundation
import ExpoModulesCore
import UIKit
import Vision

/**
 * SCOPE's camera. AVFoundation preview + photo capture, and a few times a
 * second Apple Vision's objectness saliency finds the things in frame. Their
 * boxes (in view points) go to JS, which draws the brackets; when the main
 * object holds still the view focuses on it and reports `stable`.
 *
 * On iPhones with several back cameras the virtual device is used, starting
 * at the wide lens ("1×"), so iOS can switch to macro for close-ups.
 */
final class ScopeCameraView: ExpoView,
  AVCaptureVideoDataOutputSampleBufferDelegate,
  AVCaptureMetadataOutputObjectsDelegate,
  AVCapturePhotoCaptureDelegate
{
  let onObjects = EventDispatcher()
  let onBarcode = EventDispatcher()
  let onReady = EventDispatcher()
  let onError = EventDispatcher()

  private let session = AVCaptureSession()
  private let previewLayer: AVCaptureVideoPreviewLayer
  private let photoOutput = AVCapturePhotoOutput()
  private let videoOutput = AVCaptureVideoDataOutput()
  private let metadataOutput = AVCaptureMetadataOutput()
  private let sessionQueue = DispatchQueue(label: "scope.camera.session")
  private let visionQueue = DispatchQueue(label: "scope.camera.vision", qos: .userInitiated)

  private var device: AVCaptureDevice?
  private var baseZoom: CGFloat = 1
  private var configured = false
  private var wantActive = true
  private var photoPromise: Promise?

  // Vision bookkeeping (vision queue).
  private var frameCount = 0
  private var busy = false

  // Stability (main queue).
  private var lastPrimary: CGRect?
  private var steadySince: CFTimeInterval?
  private var focusedOnLock = false
  private let steadyFor: CFTimeInterval = 0.6

  required init(appContext: AppContext? = nil) {
    previewLayer = AVCaptureVideoPreviewLayer(session: session)
    super.init(appContext: appContext)
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
    clipsToBounds = true
    sessionQueue.async { [weak self] in
      self?.configure()
      self?.updateRunning()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    previewLayer.frame = bounds
    CATransaction.commit()
  }

  override func removeFromSuperview() {
    super.removeFromSuperview()
    sessionQueue.async { [weak self] in self?.session.stopRunning() }
  }

  // MARK: - Setup

  private func pickDevice() -> AVCaptureDevice? {
    let types: [AVCaptureDevice.DeviceType] = [
      .builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera,
    ]
    return AVCaptureDevice.DiscoverySession(
      deviceTypes: types, mediaType: .video, position: .back
    ).devices.first
  }

  private func configure() {
    session.beginConfiguration()
    session.sessionPreset = .photo
    guard let dev = pickDevice(), let input = try? AVCaptureDeviceInput(device: dev),
      session.canAddInput(input)
    else {
      session.commitConfiguration()
      DispatchQueue.main.async { self.onError(["message": "No camera available"]) }
      return
    }
    session.addInput(input)
    device = dev

    if session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      photoOutput.maxPhotoQualityPrioritization = .balanced
    }

    videoOutput.alwaysDiscardsLateVideoFrames = true
    videoOutput.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    videoOutput.setSampleBufferDelegate(self, queue: visionQueue)
    if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

    if session.canAddOutput(metadataOutput) {
      session.addOutput(metadataOutput)
      metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
      let wanted: [AVMetadataObject.ObjectType] = [.ean13, .ean8, .upce]
      metadataOutput.metadataObjectTypes = wanted.filter {
        metadataOutput.availableMetadataObjectTypes.contains($0)
      }
    }
    session.commitConfiguration()

    do {
      try dev.lockForConfiguration()
      // On multi-camera iPhones zoom 1.0 is the ultra wide; start on the wide
      // lens like the Camera app does at "1×".
      if let first = dev.virtualDeviceSwitchOverVideoZoomFactors.first {
        baseZoom = CGFloat(truncating: first)
      }
      dev.videoZoomFactor = max(dev.minAvailableVideoZoomFactor, baseZoom)
      if dev.isFocusModeSupported(.continuousAutoFocus) { dev.focusMode = .continuousAutoFocus }
      if dev.isExposureModeSupported(.continuousAutoExposure) {
        dev.exposureMode = .continuousAutoExposure
      }
      dev.unlockForConfiguration()
    } catch {}

    configured = true
    DispatchQueue.main.async { self.onReady([:]) }
  }

  private func updateRunning() {
    guard configured else { return }
    if wantActive && !session.isRunning {
      session.startRunning()
    } else if !wantActive && session.isRunning {
      session.stopRunning()
    }
  }

  // MARK: - Props

  func setActive(_ active: Bool) {
    wantActive = active
    sessionQueue.async { [weak self] in self?.updateRunning() }
  }

  func setTorch(_ on: Bool) {
    sessionQueue.async { [weak self] in
      guard let dev = self?.device, dev.hasTorch else { return }
      try? dev.lockForConfiguration()
      dev.torchMode = on ? .on : .off
      dev.unlockForConfiguration()
    }
  }

  /** 1 = the wide lens ("1×"); larger zooms in. */
  func setZoom(_ zoom: Double) {
    sessionQueue.async { [weak self] in
      guard let self = self, let dev = self.device else { return }
      let target = self.baseZoom * CGFloat(max(1, zoom))
      let limit = min(dev.maxAvailableVideoZoomFactor, self.baseZoom * 10)
      try? dev.lockForConfiguration()
      dev.videoZoomFactor = min(max(target, dev.minAvailableVideoZoomFactor), limit)
      dev.unlockForConfiguration()
    }
  }

  // MARK: - Vision

  func captureOutput(
    _ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    frameCount += 1
    // ~6 analyses a second at 30 fps is plenty for brackets that glide.
    guard frameCount % 5 == 0, !busy, let pixels = CMSampleBufferGetImageBuffer(sampleBuffer)
    else { return }
    busy = true
    defer { busy = false }

    let request = VNGenerateObjectnessBasedSaliencyImageRequest()
    let handler = VNImageRequestHandler(cvPixelBuffer: pixels, orientation: .up, options: [:])
    try? handler.perform([request])
    let observation = request.results?.first as? VNSaliencyImageObservation
    // Vision: normalized, origin bottom-left, in the (landscape) buffer.
    let boxes = (observation?.salientObjects ?? []).map { $0.boundingBox }
    DispatchQueue.main.async { [weak self] in self?.publish(boxes) }
  }

  private func publish(_ visionBoxes: [CGRect]) {
    guard bounds.width > 0 else { return }
    let viewArea = bounds.width * bounds.height
    let rects: [CGRect] = visionBoxes.compactMap { b in
      // Metadata-output space has its origin top-left.
      let meta = CGRect(x: b.minX, y: 1 - b.maxY, width: b.width, height: b.height)
      let r = previewLayer.layerRectConverted(fromMetadataOutputRect: meta).intersection(bounds)
      let share = (r.width * r.height) / viewArea
      return (share > 0.02 && share < 0.92) ? r : nil
    }
    // The main object: big and near the centre.
    let center = CGPoint(x: bounds.midX, y: bounds.midY)
    let ranked = rects.sorted { score($0, center) > score($1, center) }.prefix(3)

    var stable = false
    if let primary = ranked.first {
      if let last = lastPrimary, iou(last, primary) > 0.8 {
        if steadySince == nil { steadySince = CACurrentMediaTime() }
        stable = CACurrentMediaTime() - (steadySince ?? 0) >= steadyFor
      } else {
        steadySince = nil
        focusedOnLock = false
      }
      lastPrimary = primary
      if stable && !focusedOnLock {
        focusedOnLock = true
        focus(at: CGPoint(x: primary.midX, y: primary.midY))
      }
    } else {
      lastPrimary = nil
      steadySince = nil
      focusedOnLock = false
    }

    onObjects([
      "objects": ranked.enumerated().map { i, r in
        ["x": r.minX, "y": r.minY, "width": r.width, "height": r.height, "primary": i == 0]
      },
      "stable": stable,
    ])
  }

  private func score(_ r: CGRect, _ c: CGPoint) -> CGFloat {
    let area = r.width * r.height
    let dx = (r.midX - c.x) / bounds.width
    let dy = (r.midY - c.y) / bounds.height
    return area * (1 - min(0.9, sqrt(dx * dx + dy * dy) * 1.6))
  }

  private func iou(_ a: CGRect, _ b: CGRect) -> CGFloat {
    let i = a.intersection(b)
    if i.isNull { return 0 }
    let inter = i.width * i.height
    return inter / (a.width * a.height + b.width * b.height - inter)
  }

  private func focus(at point: CGPoint) {
    let devicePoint = previewLayer.captureDevicePointConverted(fromLayerPoint: point)
    sessionQueue.async { [weak self] in
      guard let dev = self?.device else { return }
      try? dev.lockForConfiguration()
      if dev.isFocusPointOfInterestSupported {
        dev.focusPointOfInterest = devicePoint
        if dev.isFocusModeSupported(.continuousAutoFocus) { dev.focusMode = .continuousAutoFocus }
      }
      if dev.isExposurePointOfInterestSupported {
        dev.exposurePointOfInterest = devicePoint
        if dev.isExposureModeSupported(.continuousAutoExposure) {
          dev.exposureMode = .continuousAutoExposure
        }
      }
      dev.unlockForConfiguration()
    }
  }

  // MARK: - Barcodes

  func metadataOutput(
    _ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject],
    from connection: AVCaptureConnection
  ) {
    guard let code = metadataObjects.compactMap({ $0 as? AVMetadataMachineReadableCodeObject })
      .first?.stringValue
    else { return }
    onBarcode(["data": code])
  }

  // MARK: - Photo

  func takePhoto(_ promise: Promise) {
    guard configured, photoPromise == nil else {
      promise.reject("E_NOT_READY", "The camera isn't ready yet")
      return
    }
    photoPromise = promise
    sessionQueue.async { [weak self] in
      guard let self = self else { return }
      let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
      settings.photoQualityPrioritization = .balanced
      self.photoOutput.capturePhoto(with: settings, delegate: self)
    }
  }

  func photoOutput(
    _ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    guard let promise = photoPromise else { return }
    photoPromise = nil
    if let error = error {
      promise.reject("E_CAPTURE", error.localizedDescription)
      return
    }
    guard let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else {
      promise.reject("E_CAPTURE", "No photo data")
      return
    }
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("scope-\(UUID().uuidString).jpg")
    do {
      try data.write(to: url)
      // UIImage applies the EXIF orientation: these are the upright dimensions.
      promise.resolve([
        "uri": url.absoluteString,
        "width": image.size.width * image.scale,
        "height": image.size.height * image.scale,
      ])
    } catch {
      promise.reject("E_CAPTURE", error.localizedDescription)
    }
  }
}
