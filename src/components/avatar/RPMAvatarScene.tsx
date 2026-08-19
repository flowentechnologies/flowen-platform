'use client';

/**
 * RPMAvatarScene — Three.js 3D avatar scene using a Ready Player Me GLB model.
 *
 * Loads a GLB file that includes ARKit blend shapes (request with
 * ?morphTargets=ARKit,Oculus%20Visemes for full compatibility).
 * Updates mouth morph targets every frame from VisemeBlends without triggering
 * React re-renders — all mutations happen directly on Three.js objects.
 *
 * Usage:
 *   <RPMAvatarScene
 *     avatarUrl="https://models.readyplayer.me/[id].glb?morphTargets=ARKit"
 *     blends={blends}
 *     isSpeaking={isSpeaking}
 *   />
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VisemeBlends } from '@/lib/viseme';

// ── ARKit morph target name → VisemeBlends key mapping ───────────────────────
// RPM avatars with ?morphTargets=ARKit expose these exact blend shape names.
// Our VisemeBlends keys already match ARKit naming, so the map is 1:1.
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

export interface RPMAvatarSceneHandle {
  updateBlends(blends: VisemeBlends, speaking: boolean): void;
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

    // Map: morph target name → { mesh, index }
    const morphMapRef = useRef<Map<string, { mesh: import('three').SkinnedMesh; index: number }>>(
      new Map(),
    );

    // Expose imperative handle so parent can push blends without re-rendering
    useImperativeHandle(ref, () => ({
      updateBlends(b, s) {
        blendsRef.current   = b;
        speakingRef.current = s;
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

          // Build morph target map from all skinned meshes in the GLB
          const morphMap = morphMapRef.current;
          gltf.scene.traverse((node) => {
            const mesh = node as import('three').SkinnedMesh;
            if (!mesh.isSkinnedMesh || !mesh.morphTargetDictionary) return;

            for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
              morphMap.set(name, { mesh, index: idx });
            }
          });

          // Position avatar so head is centered in frame
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const headY = box.max.y * 0.88; // approximate eye level
          camera.position.set(0, headY, 1.5);
          camera.lookAt(0, headY * 0.95, 0);
        } catch (err) {
          console.error('[RPMAvatarScene] GLB load error:', err);
        }

        // ── Render loop ───────────────────────────────────────────────────────
        function tick() {
          rafRef.current = requestAnimationFrame(tick);

          const b = blendsRef.current;
          const morphMap = morphMapRef.current;

          // Apply ARKit blend shapes (direct name match)
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
