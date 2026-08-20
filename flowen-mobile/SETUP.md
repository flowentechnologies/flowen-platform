# Flowen Mobile — Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node | ≥ 22 | `nvm install --lts` |
| Expo CLI | latest | `npm i -g expo-cli eas-cli` |
| Xcode | ≥ 16 | Mac App Store |
| CocoaPods | ≥ 1.15 | `brew install cocoapods` |
| Android Studio | latest | android.com/studio |
| NDK | 26.1.10909125 | via Android Studio SDK Manager |

---

## First-time setup

### 1. Install JS dependencies

```sh
cd flowen-mobile
npm install
```

### 2. Create your .env

```sh
cp .env.example .env
# Values are already pre-filled for the Flowen Supabase project.
# No changes needed for dev.
```

### 3. Generate native projects

`expo prebuild` reads `app.json` + the `withFlowenAudio` config plugin and
produces the `ios/` Xcode project and Android `build.gradle` files with
FlowenAudio already wired in.

```sh
npx expo prebuild
```

> Run this once, or whenever you change `app.json`, add a new native module,
> or upgrade Expo SDK. It regenerates native project files — don't manually
> edit them as changes will be overwritten.

---

## iOS

### 4. Install CocoaPods

```sh
cd ios && pod install && cd ..
```

### 5. Run on simulator

```sh
npx expo run:ios
```

### 5a. Run on a physical device

```sh
npx expo run:ios --device
```

> **Microphone permission**: iOS will prompt on first session start.
> On simulator, the FlowenAudio module loads but `startCapture()` will
> fail — test on a physical device for audio.

---

## Android

### 4. Run on emulator / device

```sh
npx expo run:android
```

> The C++ Oboe engine (NDK build) compiles during the first Gradle build —
> this takes 2–3 minutes. Subsequent builds are incremental.

> **Microphone permission**: Android 6+ prompts at runtime when you press
> "Start Session". Grant it, then restart if the session screen shows an error.

---

## Iterative development

Metro bundler runs automatically with `expo run:ios/android`. Hot-reload works
for all JS/TS changes. Native module changes (Swift/Kotlin/C++) require a
full rebuild:

```sh
# iOS
cd ios && pod install && cd ..
npx expo run:ios --no-bundler   # metro still running in another tab

# Android
npx expo run:android
```

---

## FlowenAudio native module

| Platform | Files |
|----------|-------|
| iOS      | `ios/FlowenAudio/FlowenAudioModule.swift` (RemoteIO pipeline) |
| iOS      | `ios/FlowenAudio/FlowenAudioModule.m` (ObjC bridge) |
| Android  | `android/app/src/main/java/com/flowen/audio/FlowenAudioModule.kt` |
| Android  | `android/app/src/main/java/com/flowen/audio/FlowenAudioPackage.kt` |
| Android  | `android/app/src/main/cpp/AudioOboeEngine.cpp` (Oboe, 16 kHz) |

The module emits four events to JS: `onPCMFrame`, `onRMSUpdate`,
`onVADChange`, `onAudioError`. These are consumed by
`src/lib/audio/AudioPipeline.ts`.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for client) |

The `EXPO_PUBLIC_` prefix tells Metro to inline the value at bundle time.
Never add server-only secrets here.

---

## EAS Build (CI / App Store)

```sh
# Configure EAS project
eas build:configure

# iOS TestFlight build
eas build --platform ios --profile preview

# Production (App Store)
eas build --platform ios --profile production
eas submit --platform ios
```
