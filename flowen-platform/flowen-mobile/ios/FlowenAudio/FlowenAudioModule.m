#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Exposes FlowenAudioModule (Swift) to the React Native bridge.
// The Swift class is declared with @objc(FlowenAudio) and inherits RCTEventEmitter,
// so we only need the extern module declaration and method exports here.

RCT_EXTERN_MODULE(FlowenAudio, RCTEventEmitter)

RCT_EXTERN_METHOD(
  startCapture:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  stopCapture:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  getSampleRate:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)
