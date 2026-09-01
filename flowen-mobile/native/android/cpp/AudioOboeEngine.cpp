/**
 * AudioOboeEngine.cpp
 *
 * Android low-latency audio capture via Google Oboe, exposed to React Native
 * through JNI. Targets <10 ms hardware-to-JVM latency on PERFORMANCE_MODE_LOW_LATENCY.
 *
 * Pipeline:
 *   Oboe AudioStream (AAUDIO / OpenSL ES backend, auto-selected)
 *     → onAudioReady callback (real-time thread)
 *     → linear interpolation downsampler → 16 kHz / mono / Int16
 *     → RMS + VAD per 10 ms frame
 *     → JNI CallVoidMethod to fire React Native events
 *
 * JNI interface (called from FlowenAudioModule.kt):
 *   nativeStart(jclass moduleClass, jobject module) → jboolean
 *   nativeStop()                                    → void
 *   nativeSampleRate()                              → jint
 *
 * Build requirements:
 *   CMakeLists.txt links oboe::oboe and log
 *   minSdk 21 (Oboe minimum)
 */

#include <jni.h>
#include <android/log.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstring>
#include <memory>
#include <mutex>
#include <oboe/Oboe.h>

#define LOG_TAG  "FlowenAudio"
#define LOGD(...)  __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)
#define LOGE(...)  __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ── Constants ─────────────────────────────────────────────────────────────────

static constexpr int    TARGET_SAMPLE_RATE = 16'000;
static constexpr int    FRAME_SAMPLES      = 160;    // 10 ms at 16 kHz
static constexpr float  VAD_THRESHOLD      = 0.005f;
static constexpr float  INT16_MAX_F        = 32'767.0f;

// ── JNI globals ───────────────────────────────────────────────────────────────

static JavaVM*   gJvm       = nullptr;
static jobject   gModule    = nullptr;   // global ref to FlowenAudioModule instance
static jmethodID gOnFrame   = nullptr;
static jmethodID gOnRMS     = nullptr;
static jmethodID gOnVAD     = nullptr;
static jmethodID gOnError   = nullptr;

// ── AudioEngine ───────────────────────────────────────────────────────────────

class AudioEngine : public oboe::AudioStreamDataCallback,
                    public oboe::AudioStreamErrorCallback {
public:
  // ── Start ──────────────────────────────────────────────────────────────────

  bool start() {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Input)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(1)
           ->setInputPreset(oboe::InputPreset::VoicePerformance)
           ->setDataCallback(this)
           ->setErrorCallback(this);

    auto result = builder.openStream(mStream);
    if (result != oboe::Result::OK) {
      LOGE("openStream failed: %s", oboe::convertToText(result));
      notifyError("openStream failed");
      return false;
    }

    mHardwareSampleRate = mStream->getSampleRate();
    mRatio = static_cast<double>(mHardwareSampleRate) / TARGET_SAMPLE_RATE;

    LOGD("Stream opened: %d Hz, ratio=%.3f", mHardwareSampleRate, mRatio);

    result = mStream->requestStart();
    if (result != oboe::Result::OK) {
      LOGE("requestStart failed: %s", oboe::convertToText(result));
      mStream->close();
      mStream.reset();
      notifyError("requestStart failed");
      return false;
    }

    mPhase      = 0.0;
    mPrevSample = 0.0f;
    mWritePos   = 0;
    mLastVAD    = false;

    return true;
  }

  // ── Stop ───────────────────────────────────────────────────────────────────

  void stop() {
    if (mStream) {
      mStream->requestStop();
      mStream->close();
      mStream.reset();
    }
  }

  int hardwareSampleRate() const { return mHardwareSampleRate; }

  // ── oboe::AudioStreamDataCallback ──────────────────────────────────────────

  oboe::DataCallbackResult onAudioReady(
      oboe::AudioStream* /*stream*/,
      void*              audioData,
      int32_t            numFrames) override {

    const float* input = static_cast<const float*>(audioData);

    float sumSq = 0.0f;

    for (int i = 0; i < numFrames; ++i) {
      const float sample = input[i];
      sumSq += sample * sample;

      mPhase += 1.0;
      while (mPhase >= mRatio) {
        mPhase -= mRatio;

        // Linear interpolation.
        const float t   = static_cast<float>(mPhase / mRatio);
        const float out = mPrevSample + t * (sample - mPrevSample);

        // Clip and convert to Int16.
        const float clipped = out < -1.0f ? -1.0f : (out > 1.0f ? 1.0f : out);
        mFrameBuffer[mWritePos++] = static_cast<int16_t>(clipped * INT16_MAX_F);

        if (mWritePos == FRAME_SAMPLES) {
          const float rms = (numFrames > 0)
              ? std::sqrt(sumSq / static_cast<float>(numFrames))
              : 0.0f;
          dispatchFrame(rms);
          sumSq     = 0.0f;
          mWritePos = 0;
        }
      }
      mPrevSample = sample;
    }

    return oboe::DataCallbackResult::Continue;
  }

  // ── oboe::AudioStreamErrorCallback ─────────────────────────────────────────

  void onErrorAfterClose(oboe::AudioStream* /*stream*/, oboe::Result result) override {
    LOGE("onErrorAfterClose: %s", oboe::convertToText(result));
    notifyError(oboe::convertToText(result));

    // Attempt automatic restart on disconnect (headphone pull, etc.)
    if (result == oboe::Result::ErrorDisconnected) {
      std::lock_guard<std::mutex> lk(mRestartMutex);
      start();
    }
  }

private:
  // ── DSP state (real-time thread only) ─────────────────────────────────────

  std::shared_ptr<oboe::AudioStream> mStream;
  int    mHardwareSampleRate = TARGET_SAMPLE_RATE;
  double mRatio              = 1.0;
  double mPhase              = 0.0;
  float  mPrevSample         = 0.0f;
  int16_t mFrameBuffer[FRAME_SAMPLES]{};
  int    mWritePos           = 0;
  bool   mLastVAD            = false;
  std::mutex mRestartMutex;

  // ── JNI dispatch ──────────────────────────────────────────────────────────

  void dispatchFrame(float rms) {
    if (!gJvm || !gModule) return;

    JNIEnv* env = nullptr;
    bool attached = false;
    int attach = gJvm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6);
    if (attach == JNI_EDETACHED) {
      gJvm->AttachCurrentThread(&env, nullptr);
      attached = true;
    }
    if (!env) return;

    // Encode frame buffer as byte array.
    const int byteLen = FRAME_SAMPLES * 2;
    jbyteArray jBytes = env->NewByteArray(byteLen);
    if (jBytes) {
      env->SetByteArrayRegion(jBytes, 0, byteLen,
                              reinterpret_cast<const jbyte*>(mFrameBuffer));
    }

    const float db    = (rms > 0) ? (20.0f * std::log10(std::max(rms, 1e-10f))) : -100.0f;
    const bool  vad   = rms > VAD_THRESHOLD;
    const jlong tsMs  = static_cast<jlong>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count());

    if (gOnFrame && jBytes) {
      env->CallVoidMethod(gModule, gOnFrame, jBytes, static_cast<jfloat>(rms), tsMs);
    }
    if (gOnRMS) {
      env->CallVoidMethod(gModule, gOnRMS, static_cast<jfloat>(rms), static_cast<jfloat>(db));
    }
    if (gOnVAD && vad != mLastVAD) {
      mLastVAD = vad;
      env->CallVoidMethod(gModule, gOnVAD, static_cast<jboolean>(vad));
    }

    if (jBytes) env->DeleteLocalRef(jBytes);
    if (attached) gJvm->DetachCurrentThread();
  }

  void notifyError(const char* message) {
    if (!gJvm || !gModule || !gOnError) return;
    JNIEnv* env = nullptr;
    bool attached = false;
    int attach = gJvm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6);
    if (attach == JNI_EDETACHED) {
      gJvm->AttachCurrentThread(&env, nullptr);
      attached = true;
    }
    if (!env) return;
    jstring jMsg = env->NewStringUTF(message);
    env->CallVoidMethod(gModule, gOnError, jMsg);
    if (jMsg) env->DeleteLocalRef(jMsg);
    if (attached) gJvm->DetachCurrentThread();
  }
};

// Singleton engine — one stream at a time.
static std::unique_ptr<AudioEngine> gEngine;
static std::mutex gEngineMutex;

// ── JNI_OnLoad ────────────────────────────────────────────────────────────────

extern "C" JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* /*reserved*/) {
  gJvm = vm;
  return JNI_VERSION_1_6;
}

// ── JNI exports ───────────────────────────────────────────────────────────────

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_flowen_audio_FlowenAudioModule_nativeStart(
    JNIEnv* env,
    jclass  /*clazz*/,
    jobject moduleInstance)
{
  std::lock_guard<std::mutex> lk(gEngineMutex);

  // Cache method IDs.
  if (!gModule) {
    gModule = env->NewGlobalRef(moduleInstance);
    jclass cls = env->GetObjectClass(gModule);

    gOnFrame = env->GetMethodID(cls, "emitPCMFrame",  "([BJF)V");
    gOnRMS   = env->GetMethodID(cls, "emitRMSUpdate", "(FF)V");
    gOnVAD   = env->GetMethodID(cls, "emitVADChange", "(Z)V");
    gOnError = env->GetMethodID(cls, "emitAudioError","(Ljava/lang/String;)V");
  }

  gEngine = std::make_unique<AudioEngine>();
  const bool ok = gEngine->start();
  if (!ok) {
    gEngine.reset();
    return JNI_FALSE;
  }
  return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_com_flowen_audio_FlowenAudioModule_nativeStop(
    JNIEnv* /*env*/,
    jclass  /*clazz*/)
{
  std::lock_guard<std::mutex> lk(gEngineMutex);
  if (gEngine) {
    gEngine->stop();
    gEngine.reset();
  }
}

JNIEXPORT jint JNICALL
Java_com_flowen_audio_FlowenAudioModule_nativeSampleRate(
    JNIEnv* /*env*/,
    jclass  /*clazz*/)
{
  std::lock_guard<std::mutex> lk(gEngineMutex);
  return gEngine ? static_cast<jint>(gEngine->hardwareSampleRate()) : TARGET_SAMPLE_RATE;
}

} // extern "C"
