/**
 * withFlowenAudio — Expo Config Plugin
 *
 * Integrates the FlowenAudio native module into the generated Expo bare project.
 *
 * iOS
 * ───
 * Uses withDangerousMod to patch the generated project.pbxproj: adds
 * FlowenAudioModule.swift and .m to the main app target's Sources build phase.
 *
 * Android
 * ───────
 * Uses withMainApplication to register FlowenAudioPackage in getPackages().
 * Uses withAppBuildGradle to wire in the Oboe CMake externalNativeBuild block.
 */

const {
  withDangerousMod,
  withMainApplication,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

// ── iOS — patch pbxproj directly (avoids xcode npm API version issues) ────────

/**
 * Reads the generated project.pbxproj, finds the Sources build phase for the
 * main target, and inserts file references for FlowenAudioModule.swift and .m.
 *
 * This is done as a text patch because the `xcode` npm package's addSourceFile
 * API differs across Expo SDK versions and can crash on freshly generated projects.
 */
function withFlowenAudioIOS(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosDir      = path.join(projectRoot, 'ios');

      // ── Copy native source files from native/ios/ into ios/FlowenAudio/ ──
      // expo prebuild --clean wipes ios/, so the sources live in native/ios/
      // and are copied fresh each prebuild run.
      const srcDir = path.join(projectRoot, 'native', 'ios', 'FlowenAudio');
      const dstDir = path.join(iosDir, 'FlowenAudio');
      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
        for (const f of fs.readdirSync(srcDir)) {
          fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
        }
        console.log('[withFlowenAudio] Copied FlowenAudio native sources → ios/FlowenAudio/');
      } else {
        console.warn('[withFlowenAudio] native/ios/FlowenAudio not found — iOS audio module will be missing');
      }
      const projectDir = fs.readdirSync(iosDir)
        .find(f => f.endsWith('.xcodeproj'));

      if (!projectDir) {
        console.warn('[withFlowenAudio] No .xcodeproj found — skipping iOS patch');
        return cfg;
      }

      const pbxprojPath = path.join(iosDir, projectDir, 'project.pbxproj');
      let pbx = fs.readFileSync(pbxprojPath, 'utf8');

      // Already patched — idempotent
      if (pbx.includes('FlowenAudioModule.swift')) {
        return cfg;
      }

      // ── Generate stable-ish UUIDs (deterministic from filename) ──────────
      // pbxproj uses 24-char uppercase hex strings for UUIDs.
      function makeUUID(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
        return `FA${hex}FLOWEN00000000${hex}`.slice(0, 24);
      }

      const swiftUUID    = makeUUID('FlowenAudioModule.swift');
      const swiftRefUUID = makeUUID('FlowenAudioModule.swift.ref');
      const objcUUID     = makeUUID('FlowenAudioModule.m');
      const objcRefUUID  = makeUUID('FlowenAudioModule.m.ref');

      // ── 1. Add PBXFileReference entries ──────────────────────────────────
      const fileRefs = `
\t\t${swiftRefUUID} /* FlowenAudioModule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = FlowenAudioModule.swift; path = FlowenAudio/FlowenAudioModule.swift; sourceTree = "<group>"; };
\t\t${objcRefUUID} /* FlowenAudioModule.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; name = FlowenAudioModule.m; path = FlowenAudio/FlowenAudioModule.m; sourceTree = "<group>"; };`;

      pbx = pbx.replace(
        /(\/\* End PBXFileReference section \*\/)/,
        `${fileRefs}\n/* End PBXFileReference section */`,
      );

      // ── 2. Add PBXBuildFile entries ───────────────────────────────────────
      const buildFiles = `
\t\t${swiftUUID} /* FlowenAudioModule.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${swiftRefUUID} /* FlowenAudioModule.swift */; };
\t\t${objcUUID} /* FlowenAudioModule.m in Sources */ = {isa = PBXBuildFile; fileRef = ${objcRefUUID} /* FlowenAudioModule.m */; };`;

      pbx = pbx.replace(
        /(\/\* End PBXBuildFile section \*\/)/,
        `${buildFiles}\n/* End PBXBuildFile section */`,
      );

      // ── 3. Insert into Sources build phase ───────────────────────────────
      // Find the first "Sources" PBXSourcesBuildPhase and insert before "};".
      pbx = pbx.replace(
        /(\/\* Sources \*\/ = \{[^}]*isa = PBXSourcesBuildPhase;[^}]*files = \([^)]*)([\t\t\t]*\);)/,
        `$1\t\t\t\t${swiftUUID} /* FlowenAudioModule.swift in Sources */,\n\t\t\t\t${objcUUID} /* FlowenAudioModule.m in Sources */,\n$2`,
      );

      // ── 4. Add to PBXGroup (main project group) ───────────────────────────
      // Insert into the first children array that looks like the main group.
      pbx = pbx.replace(
        /(children = \([^)]*)([\t\t\t]*\);[\s\S]*?name = [^;]*Flowen)/,
        `$1\t\t\t\t${swiftRefUUID} /* FlowenAudioModule.swift */,\n\t\t\t\t${objcRefUUID} /* FlowenAudioModule.m */,\n$2`,
      );

      fs.writeFileSync(pbxprojPath, pbx, 'utf8');
      console.log('[withFlowenAudio] Patched project.pbxproj with FlowenAudio source files');

      return cfg;
    },
  ]);
}

// ── Android — register FlowenAudioPackage ────────────────────────────────────

const IMPORT  = 'import com.flowen.audio.FlowenAudioPackage';
const PKG_ADD = 'packages.add(new FlowenAudioPackage())';

function withFlowenAudioAndroid(config) {
  // Copy Kotlin + C++ sources from native/android/ into the generated android/ tree
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root    = cfg.modRequest.projectRoot;
      const nativeAndroid = path.join(root, 'native', 'android');
      if (!fs.existsSync(nativeAndroid)) return cfg;

      const audioSrc = path.join(nativeAndroid, 'audio');
      const audioDst = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'flowen', 'audio');
      fs.mkdirSync(audioDst, { recursive: true });
      for (const f of fs.readdirSync(audioSrc)) {
        fs.copyFileSync(path.join(audioSrc, f), path.join(audioDst, f));
      }

      const cppSrc = path.join(nativeAndroid, 'cpp');
      const cppDst = path.join(root, 'android', 'app', 'src', 'main', 'cpp');
      fs.mkdirSync(cppDst, { recursive: true });
      for (const f of fs.readdirSync(cppSrc)) {
        fs.copyFileSync(path.join(cppSrc, f), path.join(cppDst, f));
      }

      console.log('[withFlowenAudio] Copied FlowenAudio Android sources → android/');
      return cfg;
    },
  ]);

  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    // Add import if missing
    if (!src.includes('FlowenAudioPackage') && !src.includes(IMPORT)) {
      // Insert import after the package declaration
      src = src.replace(
        /^(package com\.flowen[^\n]*\n)/m,
        `$1\n${IMPORT}\n`,
      );

      // Kotlin: add to the packages list
      // The generated MainApplication.kt has: override fun getPackages(): List<ReactPackage> {
      src = src.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        `$1\n            add(FlowenAudioPackage())`,
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

// ── Android — wire CMake Oboe build ──────────────────────────────────────────

function withFlowenAudioCMake(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes('AudioOboeEngine') || src.includes('CMakeLists.txt')) return cfg;

    cfg.modResults.contents = src.replace(
      /(android\s*\{)/,
      `$1\n    externalNativeBuild {\n        cmake {\n            path "src/main/cpp/CMakeLists.txt"\n            version "3.22.1"\n        }\n    }\n    buildFeatures { prefab = true }`,
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
