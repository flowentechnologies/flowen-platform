cmake_minimum_required(VERSION 3.22)
project(FlowenAudio VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Oboe ──────────────────────────────────────────────────────────────────────
#
# Oboe is included as a prefab package via the Android Gradle plugin.
# Add to android/app/build.gradle:
#   dependencies { implementation 'com.google.oboe:oboe:1.9.3' }
#   android { buildFeatures { prefab true } }

find_package(oboe REQUIRED CONFIG)

# ── Native library ────────────────────────────────────────────────────────────

add_library(
  flowen_audio
  SHARED
  AudioOboeEngine.cpp
)

target_include_directories(flowen_audio PRIVATE
  ${CMAKE_SOURCE_DIR}
)

target_link_libraries(flowen_audio
  oboe::oboe
  log           # Android logging
  android       # ANativeWindow etc. (pulled in by Oboe transitively but explicit is safer)
)

# Aggressive inlining on the hot audio callback path.
target_compile_options(flowen_audio PRIVATE
  -O3
  -ffast-math
  -funroll-loops
  -fvisibility=hidden
)
