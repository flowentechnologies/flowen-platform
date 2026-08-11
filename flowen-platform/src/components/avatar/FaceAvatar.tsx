'use client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { VisemeBlends } from '@/lib/viseme';
import { ZERO_BLENDS } from '@/lib/viseme';

// ============================================================================
// FaceAvatar — Three.js glTF face model driven by 42 ARKit-style blend shapes
//
// Model: facecap.glb — part of Three.js examples, MIT licence.
// Morph target names in the model use ARKit underscore notation (mouthSmile_L)
// while VisemeBlends uses camelCase (mouthSmileLeft). BLEND_REMAP bridges them.
// ============================================================================

// Maps VisemeBlends key → facecap.glb morph target name where they differ.
// Symmetric shapes use _L / _R; the 15 mismatched ones are listed here.
const BLEND_REMAP: Record<string, string> = {
  mouthSmileLeft:      'mouthSmile_L',
  mouthSmileRight:     'mouthSmile_R',
  mouthFrownLeft:      'mouthFrown_L',
  mouthFrownRight:     'mouthFrown_R',
  mouthDimpleLeft:     'mouthDimple_L',
  mouthDimpleRight:    'mouthDimple_R',
  mouthStretchLeft:    'mouthStretch_L',
  mouthStretchRight:   'mouthStretch_R',
  mouthPressLeft:      'mouthPress_L',
  mouthPressRight:     'mouthPress_R',
  mouthLowerDownLeft:  'mouthLowerDown_L',
  mouthLowerDownRight: 'mouthLowerDown_R',
  mouthUpperUpLeft:    'mouthUpperUp_L',
  mouthUpperUpRight:   'mouthUpperUp_R',
  cheekSquintLeft:     'cheekSquint_L',
  cheekSquintRight:    'cheekSquint_R',
  noseSneerLeft:       'noseSneer_L',
  noseSneerRight:      'noseSneer_R',
};

export interface FaceAvatarHandle {
  /** Zero-re-render live blend shape update called at ~60 fps. */
  updateBlends(blends: VisemeBlends, speaking: boolean): void;
}

interface Props {
  blends: VisemeBlends;
  speaking: boolean;
}

const W = 400;
const H = 480;

// Smoothing factor for morph target lerp (0 = instant, 1 = never moves)
const LERP = 0.3;

export const FaceAvatar = forwardRef<FaceAvatarHandle, Props>(
  function FaceAvatar(_props, ref) {
    const mountRef  = useRef<HTMLDivElement>(null);
    const statusRef = useRef<HTMLSpanElement>(null);

    // Live refs — no React state so 60 fps updates never trigger re-renders
    const blendsRef   = useRef<VisemeBlends>(ZERO_BLENDS);
    const speakingRef = useRef(false);

    // Three.js objects — stored in refs so cleanup is reliable
    const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
    const rafRef       = useRef<number>(0);
    // All meshes that carry morph targets (head + teeth in facecap.glb)
    const morphMeshes  = useRef<{ mesh: THREE.Mesh; map: Map<string, number> }[]>([]);
    const loadedRef    = useRef(false);

    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

    useImperativeHandle(ref, () => ({
      updateBlends(blends: VisemeBlends, speaking: boolean) {
        blendsRef.current  = blends;
        speakingRef.current = speaking;
        if (statusRef.current) {
          statusRef.current.textContent = speaking ? 'Avatar speaking' : '';
        }
      },
    }), []);

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      // ── Scene ───────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1117);

      // Subtle gradient fog to give depth
      scene.fog = new THREE.FogExp2(0x0d1117, 1.2);

      // ── Camera ──────────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(28, W / H, 0.01, 50);
      // Framed close on face — slightly above eye-level, looking down a touch
      camera.position.set(0, 0.08, 0.55);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // ── Renderer ────────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping      = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      rendererRef.current = renderer;
      mount.appendChild(renderer.domElement);

      // ── Lighting — three-point rig for skin ─────────────────────────────────
      // Key light: warm front-top
      const keyLight = new THREE.DirectionalLight(0xfff5e4, 3.0);
      keyLight.position.set(0.6, 1.2, 1.5);
      keyLight.castShadow = true;
      scene.add(keyLight);

      // Fill light: cool left-side (reduces harsh shadows)
      const fillLight = new THREE.DirectionalLight(0xd0e8ff, 1.0);
      fillLight.position.set(-1.5, 0.4, 0.8);
      scene.add(fillLight);

      // Rim light: warm back-top (hair / head separation from bg)
      const rimLight = new THREE.DirectionalLight(0xffcc88, 0.8);
      rimLight.position.set(0.2, 0.8, -1.5);
      scene.add(rimLight);

      // Ambient: very low fill so shadows don't go fully black
      const ambient = new THREE.AmbientLight(0xffeedd, 0.25);
      scene.add(ambient);

      // ── Load facecap_clean.glb ──────────────────────────────────────────────
      // facecap_clean.glb is derived from the Three.js facecap example (MIT).
      // KTX2 textures stripped + meshopt geometry decompressed offline —
      // no extensionsRequired, so plain GLTFLoader loads it without any plugins.
      const loader = new GLTFLoader();
      loader.load(
        '/models/facecap_clean.glb',
        (gltf) => {
          const model = gltf.scene;

          // Collect all meshes that have morph targets
          model.traverse((obj) => {
            if (
              (obj instanceof THREE.SkinnedMesh || obj instanceof THREE.Mesh) &&
              obj.morphTargetDictionary &&
              obj.morphTargetInfluences
            ) {
              const map = new Map<string, number>(
                Object.entries(obj.morphTargetDictionary),
              );
              // Initialise all influences to 0
              obj.morphTargetInfluences.fill(0);
              morphMeshes.current.push({ mesh: obj as THREE.Mesh, map });
            }
          });

          // Centre the model so the face sits at the world origin
          const box    = new THREE.Box3().setFromObject(model);
          const centre = box.getCenter(new THREE.Vector3());
          model.position.sub(centre);

          // Slight upward nudge so we see chin-to-brow, not chin-to-neck
          model.position.y += 0.015;

          scene.add(model);
          loadedRef.current = true;
          setLoadState('ready');
        },
        undefined,
        () => {
          setLoadState('error');
        },
      );

      // ── Render loop ─────────────────────────────────────────────────────────
      let startTime = performance.now();

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);

        if (loadedRef.current) {
          const blends = blendsRef.current;
          const speaking = speakingRef.current;
          const t = (performance.now() - startTime) / 1000; // seconds

          // Idle breathing — subtle jaw flutter when silent
          // amplitude ramps to 0 once speaking kicks in
          const breathAmp = speaking ? 0 : 0.045;
          const breathTarget = breathAmp * (0.5 + 0.5 * Math.sin(t * 0.9));

          for (const { mesh, map } of morphMeshes.current) {
            const influences = mesh.morphTargetInfluences!;

            for (const [key, value] of Object.entries(blends) as [keyof VisemeBlends, number][]) {
              // Translate VisemeBlends key → model morph target name
              const modelKey = BLEND_REMAP[key] ?? key;
              const idx = map.get(modelKey);
              if (idx !== undefined) {
                // Add breath contribution only to jawOpen
                const target = key === 'jawOpen' && !speaking
                  ? Math.max(value, breathTarget)
                  : value;
                influences[idx] = THREE.MathUtils.lerp(influences[idx] ?? 0, target, LERP);
              }
            }
          }
        }

        renderer.render(scene, camera);
      };
      rafRef.current = requestAnimationFrame(tick);

      // ── Cleanup ─────────────────────────────────────────────────────────────
      return () => {
        cancelAnimationFrame(rafRef.current);
        loadedRef.current   = false;
        morphMeshes.current = [];
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    }, []);

    return (
      <div
        ref={mountRef}
        role="figure"
        aria-label="Speech therapy biofeedback avatar — animated lip and facial movements mirror your phoneme articulation during practice"
        style={{
          position:    'relative',
          width:       '100%',
          maxWidth:    W,
          aspectRatio: `${W} / ${H}`,
          borderRadius: '1rem',
          overflow:    'hidden',
          background:  '#0d1117',
          display:     'block',
        }}
      >
        {/* Screen-reader live region */}
        <span ref={statusRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        {/* Loading overlay */}
        {loadState === 'loading' && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '12px', background: '#0d1117',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            {/* Spinner */}
            <div style={{
              width: 36, height: 36,
              border: '3px solid #1e293b',
              borderTop: '3px solid #10b981',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }} />
            <span style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              LOADING AVATAR
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error fallback */}
        {loadState === 'error' && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0d1117', color: '#64748b',
              fontSize: 13, textAlign: 'center', padding: '2rem',
            }}
            aria-hidden="true"
          >
            Avatar unavailable — audio feedback still active
          </div>
        )}
      </div>
    );
  },
);
