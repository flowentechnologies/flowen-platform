'use client';

/**
 * RPMAvatarScene — Three.js 3D avatar scene, named for its original source
 * (Ready Player Me GLB models) but generic: it loads any GLB whose meshes
 * carry ARKit-named morph targets, not anything RPM-specific at runtime.
 * Ready Player Me itself shut down Jan 31 2026 (see AgoraAvatarSession's
 * DEFAULT_AVATAR_URL comment) — avatarUrl now points at a self-hosted GLB.
 *
 * Two independent, non-conflicting update paths, driving disjoint morph
 * targets so they can both be live at once:
 *   - updateBlends(blends, speaking)     — mouth/jaw shapes, from whichever
 *     audio source is "talking" right now (the ConvoAI agent's TTS via
 *     useLipSync, or the user's own voice via formant analysis).
 *   - updateHeadAndExpression(pose, extra) — head rotation + eye/brow
 *     shapes, from the user's own camera via useFaceTracker. Deliberately
 *     never touches mouth shapes: during a live ConvoAI session the avatar
 *     is supposed to be speaking, and driving its mouth from the user's own
 *     face would fight the AI's actual lipsync.
 *
 * Updates happen every frame without triggering React re-renders — all
 * mutations happen directly on Three.js objects.
 *
 * Usage:
 *   <RPMAvatarScene
 *     avatarUrl="/models/facecap_clean.glb"
 *     blends={blends}
 *     isSpeaking={isSpeaking}
 *   />
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VisemeBlends } from '@/lib/viseme';
import type { FaceHeadPose, ExtraBlends } from '@/lib/hooks/useFaceTracker';
import { ZERO_HEAD_POSE, ZERO_EXTRA } from '@/lib/hooks/useFaceTracker';
import { computeFitCamera } from '@/lib/avatar/camera-fit';
import { normalizeArkitMorphName } from '@/lib/avatar/arkit-morph-names';

// ── ARKit morph target name → VisemeBlends key mapping ───────────────────────
// Our VisemeBlends keys already match ARKit's camelCase naming convention —
// morph targets are registered under normalizeArkitMorphName() of whatever
// the GLB actually calls them, so this matches regardless of which naming
// convention the source file used (see arkit-morph-names.ts).
const ARKIT_MORPH_KEYS: (keyof VisemeBlends)[] = [
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight',
  'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'noseSneerLeft', 'noseSneerRight',
  'tongueOut',
];

// Eye/brow ARKit shapes driven by camera tracking (ExtraBlends), not audio.
const EXTRA_MORPH_KEYS: (keyof ExtraBlends)[] = [
  'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'browDownLeft', 'browDownRight',
  'browInnerUp',
  'browOuterUpLeft', 'browOuterUpRight',
];

// Oculus Viseme → approximate VisemeBlends mapping (fallback for RPM viseme_ shapes)
const OCULUS_VISEME_MAP: Record<string, (keyof VisemeBlends)[]> = {
  viseme_aa: ['jawOpen', 'mouthLowerDownLeft', 'mouthLowerDownRight'],
  viseme_E:  ['mouthSmileLeft', 'mouthSmileRight'],
  viseme_I:  ['mouthSmileLeft', 'mouthSmileRight', 'mouthClose'],
  viseme_O:  ['jawOpen', 'mouthFunnel'],
  viseme_U:  ['mouthPucker', 'mouthFunnel'],
  viseme_PP: ['mouthClose', 'mouthPressLeft', 'mouthPressRight'],
  viseme_FF: ['mouthShrugLower'],
  viseme_TH: ['tongueOut'],
  viseme_DD: ['jawOpen'],
  viseme_kk: ['jawOpen'],
  viseme_CH: ['jawOpen', 'mouthFunnel'],
  viseme_SS: ['mouthStretchLeft', 'mouthStretchRight'],
  viseme_nn: ['mouthClose'],
  viseme_RR: ['mouthPucker'],
  viseme_sil: [],
};

// Smoothing factor for head rotation — camera tracking is noisier frame-to-frame
// than audio-driven blends, so lerp rather than snapping directly to the raw pose.
const HEAD_POSE_LERP = 0.25;

export interface RPMAvatarSceneHandle {
  updateBlends(blends: VisemeBlends, speaking: boolean): void;
  updateHeadAndExpression(pose: FaceHeadPose, extra: ExtraBlends): void;
}

interface Props {
  avatarUrl:  string;
  blends:     VisemeBlends;
  isSpeaking: boolean;
  className?: string;
}

export const RPMAvatarScene = forwardRef<RPMAvatarSceneHandle, Props>(
  function RPMAvatarScene({ avatarUrl, blends, isSpeaking, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // These refs hold live Three.js objects — mutations bypass React
    const rendererRef = useRef<import('three').WebGLRenderer | null>(null);
    const sceneRef    = useRef<import('three').Scene | null>(null);
    const cameraRef   = useRef<import('three').PerspectiveCamera | null>(null);
    const rafRef      = useRef<number>(0);
    const blendsRef   = useRef<VisemeBlends>(blends);
    const speakingRef = useRef<boolean>(isSpeaking);
    const headPoseRef = useRef<FaceHeadPose>(ZERO_HEAD_POSE);
    const extraRef    = useRef<ExtraBlends>(ZERO_EXTRA);

    // Map: morph target name (normalized) → { mesh, index }. Plain Mesh, not
    // SkinnedMesh — facecap_clean.glb's morph targets sit on unskinned
    // meshes, and morph targets don't require a skeleton at all.
    const morphMapRef = useRef<Map<string, { mesh: import('three').Mesh; index: number }>>(
      new Map(),
    );
    // The node whose rotation represents head orientation — found by name
    // after load, falling back to the GLB's root so head-pose tracking
    // degrades to "rotate the whole model" rather than doing nothing on a
    // model with no node actually named "head".
    const headNodeRef = useRef<import('three').Object3D | null>(null);

    // Expose imperative handle so parent can push updates without re-rendering
    useImperativeHandle(ref, () => ({
      updateBlends(b, s) {
        blendsRef.current   = b;
        speakingRef.current = s;
      },
      updateHeadAndExpression(pose, extra) {
        headPoseRef.current = pose;
        extraRef.current    = extra;
      },
    }));

    // Sync props → refs on every render (for when parent passes blends as props)
    blendsRef.current   = blends;
    speakingRef.current = isSpeaking;

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let cleanup: (() => void) | undefined;

      void (async () => {
        // Lazy-import Three.js (client only)
        const THREE = await import('three');
        const { GLTFLoader } = await import(
          'three/examples/jsm/loaders/GLTFLoader.js'
        );

        // ── Renderer ──────────────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        rendererRef.current = renderer;

        // ── Scene ─────────────────────────────────────────────────────────────
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Ambient + directional lighting for a clean look
        scene.add(new THREE.AmbientLight(0xffffff, 1.4));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(0.5, 1, 2);
        scene.add(dirLight);
        const fillLight = new THREE.DirectionalLight(0x7cb9e8, 0.6);
        fillLight.position.set(-1, 0.5, 1);
        scene.add(fillLight);

        // ── Camera — framed for head + shoulders ─────────────────────────────
        const camera = new THREE.PerspectiveCamera(
          28,
          canvas.clientWidth / canvas.clientHeight,
          0.1,
          100,
        );
        camera.position.set(0, 1.55, 2.0);
        camera.lookAt(0, 1.55, 0);
        cameraRef.current = camera;

        // ── Load RPM GLB ──────────────────────────────────────────────────────
        const loader = new GLTFLoader();
        try {
          const gltf = await new Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>(
            (resolve, reject) => loader.load(avatarUrl, resolve, undefined, reject),
          );

          scene.add(gltf.scene);

          // Build morph target map from every mesh in the GLB that has one —
          // not just SkinnedMesh. facecap_clean.glb's head/teeth meshes carry
          // morph targets without any skeleton at all (skins: 0); requiring
          // isSkinnedMesh here used to skip every one of them, so the morph
          // map stayed empty and the face never moved regardless of blends.
          const morphMap = morphMapRef.current;
          let headNode: import('three').Object3D | null = null;
          gltf.scene.traverse((node) => {
            if (node.name === 'head') headNode = node;

            const mesh = node as import('three').Mesh;
            if (!mesh.isMesh || !mesh.morphTargetDictionary) return;

            for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
              morphMap.set(normalizeArkitMorphName(name), { mesh, index: idx });
            }
          });
          headNodeRef.current = headNode ?? gltf.scene;

          // Frame the camera from the model's actual bounding box — not a
          // hardcoded eye-level fraction tuned for one specific model's
          // proportions (that assumption broke outright when facecap_clean.glb,
          // a head-only model at a totally different scale, replaced the old
          // Ready Player Me half-body avatar: the camera ended up looking at
          // empty space above the model, only the scalp visible at the
          // bottom edge). This frames whatever GLB is loaded, so it keeps
          // working if the model changes again.
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const { position, lookAt } = computeFitCamera(
            [box.min.x, box.min.y, box.min.z],
            [box.max.x, box.max.y, box.max.z],
            camera.fov,
          );
          camera.position.set(...position);
          camera.lookAt(...lookAt);
        } catch (err) {
          console.error('[RPMAvatarScene] GLB load error:', err);
        }

        // ── Render loop ───────────────────────────────────────────────────────
        function tick() {
          rafRef.current = requestAnimationFrame(tick);

          const b = blendsRef.current;
          const extra = extraRef.current;
          const morphMap = morphMapRef.current;

          // Apply ARKit mouth/jaw blend shapes (audio-driven)
          for (const key of ARKIT_MORPH_KEYS) {
            const entry = morphMap.get(key);
            if (entry) {
              const inf = entry.mesh.morphTargetInfluences;
              if (inf) inf[entry.index] = b[key];
            }
          }

          // Apply Oculus viseme shapes (derived from VisemeBlends)
          for (const [visemeName, blendKeys] of Object.entries(OCULUS_VISEME_MAP)) {
            const entry = morphMap.get(visemeName);
            if (!entry || !blendKeys.length) continue;
            const val = blendKeys.reduce((sum, k) => sum + b[k], 0) / blendKeys.length;
            const inf = entry.mesh.morphTargetInfluences;
            if (inf) inf[entry.index] = Math.min(1, val);
          }

          // Apply eye/brow blend shapes (camera-driven, independent of audio)
          for (const key of EXTRA_MORPH_KEYS) {
            const entry = morphMap.get(key);
            if (entry) {
              const inf = entry.mesh.morphTargetInfluences;
              if (inf) inf[entry.index] = extra[key];
            }
          }

          // Apply head rotation (camera-driven), smoothed — raw per-frame
          // pose from MediaPipe is noticeably jittery frame to frame.
          const headNode = headNodeRef.current;
          if (headNode) {
            const pose = headPoseRef.current;
            headNode.rotation.x += (pose.pitch - headNode.rotation.x) * HEAD_POSE_LERP;
            headNode.rotation.y += (pose.yaw   - headNode.rotation.y) * HEAD_POSE_LERP;
            headNode.rotation.z += (pose.roll  - headNode.rotation.z) * HEAD_POSE_LERP;
          }

          renderer.render(scene, camera);
        }
        rafRef.current = requestAnimationFrame(tick);

        // ── Resize observer ───────────────────────────────────────────────────
        const ro = new ResizeObserver(() => {
          if (!canvas) return;
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          renderer.setSize(w, h);
          if (camera) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
        });
        ro.observe(canvas);

        cleanup = () => {
          cancelAnimationFrame(rafRef.current);
          ro.disconnect();
          renderer.dispose();
        };
      })();

      return () => cleanup?.();
    // avatarUrl is stable — only re-init if it changes (different avatar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avatarUrl]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    );
  },
);
