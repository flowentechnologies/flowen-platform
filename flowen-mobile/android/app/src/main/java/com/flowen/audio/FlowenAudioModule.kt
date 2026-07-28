package com.flowen.audio

import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native bridge for the Oboe-backed native audio engine.
 *
 * Method mapping (JavaScript ↔ JNI):
 *   startCapture() → nativeStart(this)
 *   stopCapture()  → nativeStop()
 *   getSampleRate()→ nativeSampleRate()
 *
 * Events emitted to JS:
 *   onPCMFrame   { data: base64, rms: Float, ts: Long }
 *   onRMSUpdate  { rms: Float, db: Float }
 *   onVADChange  { active: Boolean }
 *   onAudioError { message: String }
 */
class FlowenAudioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FlowenAudio"

  // ── JS-callable methods ──────────────────────────────────────────────────────

  @ReactMethod
  fun startCapture(promise: Promise) {
    try {
      val ok = nativeStart(this)
      if (ok) {
        promise.resolve(null)
      } else {
        promise.reject("START_FAILED", "Native audio engine failed to start")
      }
    } catch (e: Exception) {
      promise.reject("START_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopCapture(promise: Promise) {
    try {
      nativeStop()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("STOP_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun getSampleRate(promise: Promise) {
    promise.resolve(nativeSampleRate())
  }

  // Required by RN to suppress "no listeners" warnings during setup.
  @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}
  @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}

  // ── Event emission (called from C++ JNI on real-time thread) ─────────────────

  @Suppress("unused")   // called from AudioOboeEngine.cpp
  fun emitPCMFrame(pcm: ByteArray, rms: Float, ts: Long) {
    val b64 = Base64.encodeToString(pcm, Base64.NO_WRAP)
    val map = Arguments.createMap().apply {
      putString("data", b64)
      putDouble("rms",  rms.toDouble())
      putDouble("ts",   ts.toDouble())
    }
    emit("onPCMFrame", map)
  }

  @Suppress("unused")
  fun emitRMSUpdate(rms: Float, db: Float) {
    val map = Arguments.createMap().apply {
      putDouble("rms", rms.toDouble())
      putDouble("db",  db.toDouble())
    }
    emit("onRMSUpdate", map)
  }

  @Suppress("unused")
  fun emitVADChange(active: Boolean) {
    val map = Arguments.createMap().apply { putBoolean("active", active) }
    emit("onVADChange", map)
  }

  @Suppress("unused")
  fun emitAudioError(message: String) {
    val map = Arguments.createMap().apply { putString("message", message) }
    emit("onAudioError", map)
  }

  private fun emit(eventName: String, params: WritableMap) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  // ── JNI declarations ──────────────────────────────────────────────────────────

  private external fun nativeStart(module: FlowenAudioModule): Boolean
  private external fun nativeStop()
  private external fun nativeSampleRate(): Int

  companion object {
    init {
      System.loadLibrary("flowen_audio")
    }
  }
}
