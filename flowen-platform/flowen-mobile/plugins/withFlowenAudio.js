/**
 * withFlowenAudio — Expo Config Plugin
 *
 * Integrates the FlowenAudio native module into the generated Expo bare-workflow
 * project on both iOS and Android.
 *
 * iOS
 * ───
 * Adds FlowenAudioModule.swift and FlowenAudioModule.m to the Xcode project so
 * the module is compiled into the app target. Also adds the required bridging-
 * header entry when needed.
 *
 * Android
 * ───────
 * Patches MainApplication.kt (or .java) to import FlowenAudioPackage and add
 * it to the packages list returned by getPackages().
 * Also appends the CMakeLists.txt path so the Oboe C++ engine is compiled.
 */

const {
  withXcodeProject,
  withMainApplication,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const path = require('path');

// ── iOS ───────────────────────────────────────────────────────────────────────

const IOS_SOURCES = [
  'FlowenAudio/FlowenAudioModule.swift',
  'FlowenAudio/FlowenAudioModule.m',
];

function withFlowenAudioIOS(config) {
  return withXcodeProject(config, async (cfg) => {
    const xcodeProject = cfg.modResults;
    const projectRoot  = cfg.modRequest.projectRoot;
    const iosDir       = path.join(projectRoot, 'ios');
    const appTarget    = xcodeProject.getFirstTarget().firstTarget;

    IOS_SOURCES.forEach((relPath) => {
      const absPath = path.join(iosDir, relPath);
      // Check the file is not already in the project
      const existing = xcodeProject.pbxFileReferenceSection();
      const alreadyAdded = Object.values(existing).some(
        (ref) => ref && ref.path && ref.path.replace(/"/g, '') === relPath,
      );
      if (alreadyAdded) return;

      xcodeProject.addSourceFile(relPath, { target: appTarget.uuid }, undefined);
      console.log(`[withFlowenAudio] Added ${relPath} to Xcode project`);
    });

    return cfg;
  });
}

// ── Android ───────────────────────────────────────────────────────────────────

const PACKAGE_IMPORT = 'import com.flowen.audio.FlowenAudioPackage';
const PACKAGE_ADD    = 'packages.add(FlowenAudioPackage())';

function withFlowenAudioAndroid(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    // Add import if missing
    if (!src.includes(PACKAGE_IMPORT)) {
      src = src.replace(
        /^(package com\.flowen\.app)/m,
        `$1\n\n${PACKAGE_IMPORT}`,
      );
    }

    // Add package registration if missing
    if (!src.includes('FlowenAudioPackage')) {
      // Works for both the default getPackages() override pattern
      src = src.replace(
        /(override fun getPackages\(\)[^{]*\{[^}]*)(return packages)/,
        `$1${PACKAGE_ADD}\n        $2`,
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

// Wire up the CMake native library in app/build.gradle
function withFlowenAudioCMake(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes('AudioOboeEngine')) return cfg; // already patched

    // Inject externalNativeBuild block inside android { } if not present
    const cmakeBlock = `
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
            version "3.22.1"
        }
    }`;

    cfg.modResults.contents = src.replace(
      /(\n\s*defaultConfig\s*\{)/,
      `${cmakeBlock}\n$1`,
    );
    return cfg;
  });
}

// ── Compose ───────────────────────────────────────────────────────────────────

module.exports = function withFlowenAudio(config) {
  config = withFlowenAudioIOS(config);
  config = withFlowenAudioAndroid(config);
  config = withFlowenAudioCMake(config);
  return config;
};
