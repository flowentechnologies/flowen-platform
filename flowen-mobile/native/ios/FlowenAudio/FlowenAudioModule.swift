import AVFoundation
import AudioToolbox
import Foundation
import React

// ── FlowenAudioModule ─────────────────────────────────────────────────────────
//
// iOS native audio capture using RemoteIO Audio Unit for minimum-latency
// PCM acquisition. Targets <5 ms hardware-to-JS round-trip.
//
// Pipeline:
//   RemoteIO kAudioUnitSubType_RemoteIO
//     → real-time render callback (audio thread)
//     → linear interpolation downsampler → 16 kHz / mono / Int16
//     → RMS + VAD calculation
//     → RCTEventEmitter on JS thread
//
// All DSP runs on the real-time audio thread; only event dispatch touches the
// React Native bridge thread.

@objc(FlowenAudio)
final class FlowenAudioModule: RCTEventEmitter {

  // ── Constants ───────────────────────────────────────────────────────────────

  private static let targetSampleRate: Double = 16_000
  private static let frameSamples: Int        = 160     // 10 ms at 16 kHz
  private static let vadThreshold: Float      = 0.005

  // ── State ───────────────────────────────────────────────────────────────────

  fileprivate var audioUnit:  AudioComponentInstance?
  private var isRunning       = false
  private var hardwareSampleRate: Double = 0

  // Downsampler state — all mutated only on the real-time audio thread.
  private var phase:          Double = 0
  private var ratio:          Double = 1     // hardwareSampleRate / 16000
  private var prevSample:     Float  = 0

  // Output frame accumulator (audio thread only).
  private var frameBuffer    = [Int16](repeating: 0, count: frameSamples)
  private var frameWritePos: Int = 0

  // VAD edge detection (audio thread only).
  private var lastVAD = false

  // ── RCTEventEmitter ─────────────────────────────────────────────────────────

  override func supportedEvents() -> [String]! {
    return ["onPCMFrame", "onRMSUpdate", "onVADChange", "onAudioError"]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  // ── JS-callable methods ──────────────────────────────────────────────────────

  @objc
  func startCapture(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard !isRunning else { resolve(nil); return }

    do {
      try configureAudioSession()
      try buildAudioUnit()
      let status = AudioOutputUnitStart(audioUnit!)
      guard status == noErr else {
        throw NSError(domain: "FlowenAudio", code: Int(status),
                      userInfo: [NSLocalizedDescriptionKey: "AudioOutputUnitStart failed: \(status)"])
      }
      isRunning = true
      resolve(nil)
    } catch {
      reject("START_FAILED", error.localizedDescription, error)
    }
  }

  @objc
  func stopCapture(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard isRunning else { resolve(nil); return }
    teardownAudioUnit()
    isRunning = false
    resolve(nil)
  }

  @objc
  func getSampleRate(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(FlowenAudioModule.targetSampleRate)
  }

  // ── AVAudioSession ───────────────────────────────────────────────────────────

  private func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .measurement, options: [])
    // Prefer 10 ms hardware buffer — minimises capture latency.
    try session.setPreferredIOBufferDuration(0.01)
    try session.setPreferredSampleRate(FlowenAudioModule.targetSampleRate)
    try session.setActive(true)
    hardwareSampleRate = session.sampleRate
  }

  // ── AudioUnit construction ───────────────────────────────────────────────────

  private func buildAudioUnit() throws {
    var desc = AudioComponentDescription(
      componentType:         kAudioUnitType_Output,
      componentSubType:      kAudioUnitSubType_RemoteIO,
      componentManufacturer: kAudioUnitManufacturer_Apple,
      componentFlags:        0,
      componentFlagsMask:    0
    )

    guard let component = AudioComponentFindNext(nil, &desc) else {
      throw NSError(domain: "FlowenAudio", code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "RemoteIO component not found"])
    }

    var unit: AudioComponentInstance?
    var status = AudioComponentInstanceNew(component, &unit)
    guard status == noErr, let unit else {
      throw NSError(domain: "FlowenAudio", code: Int(status),
                    userInfo: [NSLocalizedDescriptionKey: "AudioComponentInstanceNew failed"])
    }
    audioUnit = unit

    // Enable microphone input (bus 1).
    var enableInput: UInt32 = 1
    status = AudioUnitSetProperty(unit,
      kAudioOutputUnitProperty_EnableIO,
      kAudioUnitScope_Input, 1,
      &enableInput, UInt32(MemoryLayout<UInt32>.size))
    guard status == noErr else { throw auError(status, "EnableIO input") }

    // Disable output (bus 0) — we never play audio.
    var disableOutput: UInt32 = 0
    status = AudioUnitSetProperty(unit,
      kAudioOutputUnitProperty_EnableIO,
      kAudioUnitScope_Output, 0,
      &disableOutput, UInt32(MemoryLayout<UInt32>.size))
    guard status == noErr else { throw auError(status, "DisableIO output") }

    // Set input ASBD: native-rate, mono, non-interleaved Float32.
    var asbd = AudioStreamBasicDescription(
      mSampleRate:       hardwareSampleRate,
      mFormatID:         kAudioFormatLinearPCM,
      mFormatFlags:      kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
      mBytesPerPacket:   4,
      mFramesPerPacket:  1,
      mBytesPerFrame:    4,
      mChannelsPerFrame: 1,
      mBitsPerChannel:   32,
      mReserved:         0
    )
    status = AudioUnitSetProperty(unit,
      kAudioUnitProperty_StreamFormat,
      kAudioUnitScope_Output, 1,
      &asbd, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
    guard status == noErr else { throw auError(status, "StreamFormat") }

    // Set downsampler ratio.
    ratio = hardwareSampleRate / FlowenAudioModule.targetSampleRate

    // Wire up the input callback.
    var callbackStruct = AURenderCallbackStruct(
      inputProc:       audioInputCallback,
      inputProcRefCon: Unmanaged.passUnretained(self).toOpaque()
    )
    status = AudioUnitSetProperty(unit,
      kAudioOutputUnitProperty_SetInputCallback,
      kAudioUnitScope_Global, 1,
      &callbackStruct, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
    guard status == noErr else { throw auError(status, "InputCallback") }

    status = AudioUnitInitialize(unit)
    guard status == noErr else { throw auError(status, "Initialize") }
  }

  private func teardownAudioUnit() {
    guard let unit = audioUnit else { return }
    AudioOutputUnitStop(unit)
    AudioUnitUninitialize(unit)
    AudioComponentInstanceDispose(unit)
    audioUnit = nil
    phase = 0
    prevSample = 0
    frameWritePos = 0
  }

  private func auError(_ status: OSStatus, _ context: String) -> NSError {
    NSError(domain: "FlowenAudio", code: Int(status),
            userInfo: [NSLocalizedDescriptionKey: "\(context) failed: \(status)"])
  }

  // ── Real-time DSP (audio thread — NO ObjC/Swift allocations) ────────────────

  // Called on the real-time audio thread by the AudioUnit engine.
  func processInputBuffer(bufferList: UnsafePointer<AudioBufferList>,
                          frameCount: UInt32) {
    let bl    = bufferList.pointee
    guard bl.mNumberBuffers >= 1 else { return }

    let buf   = bl.mBuffers
    guard let rawData = buf.mData else { return }
    let count = Int(buf.mDataByteSize) / MemoryLayout<Float32>.size
    let input = rawData.bindMemory(to: Float32.self, capacity: count)

    var sumSq: Float = 0

    for i in 0 ..< count {
      let sample = input[i]
      sumSq += sample * sample

      // Linear interpolation downsampler.
      phase += 1.0
      while phase >= ratio {
        phase -= ratio
        let t = Float(phase / ratio)
        let out = prevSample + t * (sample - prevSample)

        // Scale Float32 [-1, 1] → Int16.
        let s16 = Int16(clamping: Int32(out * 32767))
        frameBuffer[frameWritePos] = s16
        frameWritePos += 1

        if frameWritePos == FlowenAudioModule.frameSamples {
          dispatchFrame(rms: sqrtf(sumSq / Float(count)))
          sumSq = 0
          frameWritePos = 0
        }
      }
      prevSample = sample
    }
  }

  // Dispatches a completed 10 ms frame to JS. Must be non-allocating for the
  // hot path; only the bridge dispatch allocates (happens on bridge queue).
  private func dispatchFrame(rms: Float) {
    let db        = rms > 0 ? 20 * log10f(max(rms, 1e-10)) : -100
    let vadActive = rms > FlowenAudioModule.vadThreshold

    // Encode Int16 frame as base64 for the JS bridge.
    let frameData = Data(bytes: frameBuffer, count: FlowenAudioModule.frameSamples * 2)
    let b64       = frameData.base64EncodedString()
    let ts        = Date().timeIntervalSince1970 * 1000

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.sendEvent(withName: "onPCMFrame", body: [
        "data": b64,
        "rms":  rms,
        "ts":   ts,
      ])
      self.sendEvent(withName: "onRMSUpdate", body: [
        "rms": rms,
        "db":  db,
      ])
      if vadActive != self.lastVAD {
        self.lastVAD = vadActive
        self.sendEvent(withName: "onVADChange", body: ["active": vadActive])
      }
    }
  }
}

// ── C-compatible render callback ──────────────────────────────────────────────

private func audioInputCallback(
  refCon:            UnsafeMutableRawPointer,
  actionFlags:       UnsafeMutablePointer<AudioUnitRenderActionFlags>,
  timeStamp:         UnsafePointer<AudioTimeStamp>,
  busNumber:         UInt32,
  inNumberFrames:    UInt32,
  ioData:            UnsafeMutablePointer<AudioBufferList>?
) -> OSStatus {

  let module = Unmanaged<FlowenAudioModule>.fromOpaque(refCon).takeUnretainedValue()
  guard let unit = module.audioUnit else { return noErr }

  // Allocate buffer list on the stack (no heap allocation).
  var bufferList = AudioBufferList()
  bufferList.mNumberBuffers = 1
  var buffer = AudioBuffer()
  buffer.mNumberChannels = 1
  buffer.mDataByteSize   = inNumberFrames * 4
  buffer.mData           = UnsafeMutableRawPointer.allocate(byteCount: Int(inNumberFrames * 4), alignment: 4)
  defer { buffer.mData?.deallocate() }

  bufferList.mBuffers = buffer

  let status = AudioUnitRender(unit, actionFlags, timeStamp, busNumber,
                               inNumberFrames, &bufferList)
  guard status == noErr else { return status }

  withUnsafePointer(to: bufferList) { ptr in
    module.processInputBuffer(bufferList: ptr, frameCount: inNumberFrames)
  }

  return noErr
}
