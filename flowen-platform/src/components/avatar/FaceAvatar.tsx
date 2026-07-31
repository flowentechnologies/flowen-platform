'use client';

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import type { VisemeBlends } from '@/lib/viseme';

// ============================================================================
// FaceAvatar — Three.js speech therapy avatar driven by 42 viseme parameters
// ============================================================================

interface Props {
  blends: VisemeBlends;
  speaking: boolean;
}

// Canvas dimensions
const W = 400;
const H = 480;

// Skin color
const SKIN_COLOR = new THREE.Color(0xd4956a);
const SKIN_DARK_COLOR = new THREE.Color(0xbf8560);
const BROW_COLOR = new THREE.Color(0x7a4b2a);
const EYE_BLUE_COLOR = new THREE.Color(0x2e4a8b);
const LIP_COLOR = new THREE.Color(0xc07060);
const TEETH_COLOR = new THREE.Color(0xf5f0e8);
const TONGUE_COLOR = new THREE.Color(0xe06070);

// Upper lip control point helper — 7 points defining the Cupid's bow
function computeUpperLipPoints(b: VisemeBlends): THREE.Vector3[] {
  const smileL = b.mouthSmileLeft * 0.07;
  const smileR = b.mouthSmileRight * 0.07;
  const funnel = b.mouthFunnel * 0.04;
  const pucker = b.mouthPucker * 0.03;
  const upL = b.mouthUpperUpLeft * 0.04;
  const upR = b.mouthUpperUpRight * 0.04;
  const strL = b.mouthStretchLeft * 0.05;
  const strR = b.mouthStretchRight * 0.05;

  const z = 0.88;
  const centerY = -0.18 + funnel - pucker * 0.5;

  return [
    new THREE.Vector3(-0.20 - strL, -0.20 + smileL, z),            // left corner
    new THREE.Vector3(-0.13, -0.15 + smileL + upL * 0.5, z + 0.01), // left wing
    new THREE.Vector3(-0.055, -0.14 + upL, z + 0.02),               // left peak (Cupid's bow)
    new THREE.Vector3(0, centerY, z + 0.025),                        // center dip
    new THREE.Vector3(0.055, -0.14 + upR, z + 0.02),                // right peak
    new THREE.Vector3(0.13, -0.15 + smileR + upR * 0.5, z + 0.01), // right wing
    new THREE.Vector3(0.20 + strR, -0.20 + smileR, z),              // right corner
  ];
}

// Lower lip control point helper — 5 points
function computeLowerLipPoints(b: VisemeBlends): THREE.Vector3[] {
  const frownL = b.mouthFrownLeft * 0.05;
  const frownR = b.mouthFrownRight * 0.05;
  const downL = b.mouthLowerDownLeft * 0.06;
  const downR = b.mouthLowerDownRight * 0.06;
  const jawDrop = b.jawOpen * 0.05;
  const strL = b.mouthStretchLeft * 0.05;
  const strR = b.mouthStretchRight * 0.05;

  const z = 0.88;
  const centerY = -0.28 - jawDrop;

  return [
    new THREE.Vector3(-0.20 - strL, -0.22 - frownL, z),          // left corner
    new THREE.Vector3(-0.10, -0.25 - downL * 0.7 - frownL * 0.3, z + 0.01),
    new THREE.Vector3(0, centerY - downL * 0.3 - downR * 0.3, z + 0.02),
    new THREE.Vector3(0.10, -0.25 - downR * 0.7 - frownR * 0.3, z + 0.01),
    new THREE.Vector3(0.20 + strR, -0.22 - frownR, z),           // right corner
  ];
}

// Create a tube along a CatmullRom curve
function makeLipTube(
  points: THREE.Vector3[],
  radius: number,
  color: THREE.Color,
  scene: THREE.Scene,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 20, radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

// Rebuild tube geometry in-place
function rebuildLipTube(mesh: THREE.Mesh, points: THREE.Vector3[], radius: number): void {
  mesh.geometry.dispose();
  const curve = new THREE.CatmullRomCurve3(points);
  mesh.geometry = new THREE.TubeGeometry(curve, 20, radius, 8, false);
}

export default function FaceAvatar({ blends, speaking }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Three.js object refs — never cause re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const blendsRef = useRef<VisemeBlends>(blends);
  const speakingRef = useRef<boolean>(speaking);

  // Mesh refs
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const jawPivotRef = useRef<THREE.Object3D | null>(null);
  const upperLipRef = useRef<THREE.Mesh | null>(null);
  const lowerLipRef = useRef<THREE.Mesh | null>(null);
  const teethRef = useRef<THREE.Mesh | null>(null);
  const tongueRef = useRef<THREE.Mesh | null>(null);
  const cheekLRef = useRef<THREE.Mesh | null>(null);
  const cheekRRef = useRef<THREE.Mesh | null>(null);
  const browLRef = useRef<THREE.Mesh | null>(null);
  const browRRef = useRef<THREE.Mesh | null>(null);
  const rimLightRef = useRef<THREE.PointLight | null>(null);

  // Keep blends ref in sync without re-mounting
  useEffect(() => {
    blendsRef.current = blends;
    speakingRef.current = speaking;
  }, [blends, speaking]);

  // Build scene on mount; destroy on unmount
  useEffect(() => {
    if (typeof window === 'undefined' || !mountRef.current) return;

    // -----------------------------------------------------------------------
    // Renderer
    // -----------------------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0d1117, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // -----------------------------------------------------------------------
    // Scene & camera
    // -----------------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0.15, 3.2);
    cameraRef.current = camera;

    // -----------------------------------------------------------------------
    // Lights
    // -----------------------------------------------------------------------
    const ambient = new THREE.AmbientLight(0xffeedd, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(1.5, 2, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.PointLight(0xffd0b0, 0.5);
    fillLight.position.set(-1, 0.5, 1);
    scene.add(fillLight);

    // Iridescent rim light — pulses when speaking
    const rimLight = new THREE.PointLight(0x88ccff, 0, 2);
    rimLight.position.set(0, 0.5, -1.5);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // -----------------------------------------------------------------------
    // Avatar group (idle bob)
    // -----------------------------------------------------------------------
    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);
    avatarGroupRef.current = avatarGroup;

    // -----------------------------------------------------------------------
    // Cranium
    // -----------------------------------------------------------------------
    const craniumGeo = new THREE.SphereGeometry(1, 48, 48);
    const skinMat = new THREE.MeshStandardMaterial({
      color: SKIN_COLOR,
      roughness: 0.65,
      metalness: 0,
    });
    const cranium = new THREE.Mesh(craniumGeo, skinMat);
    cranium.scale.set(1, 1.25, 0.9);
    cranium.castShadow = true;
    cranium.receiveShadow = true;
    avatarGroup.add(cranium);

    // -----------------------------------------------------------------------
    // Jaw (lower face, pivots at y = -0.35)
    // -----------------------------------------------------------------------
    const jawPivot = new THREE.Object3D();
    jawPivot.position.set(0, -0.35, 0);
    avatarGroup.add(jawPivot);
    jawPivotRef.current = jawPivot;

    // Lower face shell — clipped sphere
    const jawGeo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    const jawMesh = new THREE.Mesh(jawGeo, skinMat);
    jawMesh.scale.set(1, 1.25, 0.9);
    jawMesh.position.set(0, 0, 0);
    jawPivot.add(jawMesh);

    // -----------------------------------------------------------------------
    // Eyes
    // -----------------------------------------------------------------------
    const eyePositions: [number, number, number][] = [
      [-0.38, 0.25, 0.7],
      [0.38, 0.25, 0.7],
    ];

    for (const [ex, ey, ez] of eyePositions) {
      // Sclera
      const scleraGeo = new THREE.SphereGeometry(0.12, 24, 24);
      const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.position.set(ex, ey, ez);
      avatarGroup.add(sclera);

      // Iris
      const irisGeo = new THREE.CircleGeometry(0.08, 32);
      const irisMat = new THREE.MeshStandardMaterial({ color: EYE_BLUE_COLOR, side: THREE.FrontSide });
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(ex, ey, ez + 0.115);
      avatarGroup.add(iris);

      // Pupil
      const pupilGeo = new THREE.CircleGeometry(0.04, 24);
      const pupilMat = new THREE.MeshStandardMaterial({ color: 0x080808, side: THREE.FrontSide });
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(ex, ey, ez + 0.116);
      avatarGroup.add(pupil);

      // Eye highlight
      const hlGeo = new THREE.CircleGeometry(0.018, 16);
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const highlight = new THREE.Mesh(hlGeo, hlMat);
      highlight.position.set(ex + 0.025, ey + 0.025, ez + 0.118);
      avatarGroup.add(highlight);
    }

    // -----------------------------------------------------------------------
    // Brows
    // -----------------------------------------------------------------------
    const browPositions: [number, number, number, boolean][] = [
      [-0.38, 0.47, 0.75, true],
      [0.38, 0.47, 0.75, false],
    ];
    const browMat = new THREE.MeshStandardMaterial({ color: BROW_COLOR, roughness: 0.7 });

    for (const [bx, by, bz, isLeft] of browPositions) {
      const browGeo = new THREE.BoxGeometry(0.28, 0.04, 0.08);
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(bx, by, bz);
      brow.rotation.z = isLeft ? 0.05 : -0.05;
      avatarGroup.add(brow);
      if (isLeft) browLRef.current = brow;
      else browRRef.current = brow;
    }

    // -----------------------------------------------------------------------
    // Nose
    // -----------------------------------------------------------------------
    const noseTipGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const noseDarkMat = new THREE.MeshStandardMaterial({
      color: SKIN_DARK_COLOR,
      roughness: 0.7,
    });
    const noseTip = new THREE.Mesh(noseTipGeo, noseDarkMat);
    noseTip.position.set(0, -0.02, 0.82);
    avatarGroup.add(noseTip);

    const noseBridgeGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.22, 12);
    const noseBridge = new THREE.Mesh(noseBridgeGeo, noseDarkMat);
    noseBridge.position.set(0, 0.12, 0.78);
    noseBridge.rotation.x = 0.25;
    avatarGroup.add(noseBridge);

    // Nostrils
    for (const nx of [-0.055, 0.055]) {
      const nostrilGeo = new THREE.SphereGeometry(0.04, 12, 12);
      const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xa06040, roughness: 0.8 });
      const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      nostril.scale.set(1, 0.7, 0.8);
      nostril.position.set(nx, -0.05, 0.8);
      avatarGroup.add(nostril);
    }

    // -----------------------------------------------------------------------
    // Cheeks (for cheekPuff)
    // -----------------------------------------------------------------------
    const cheekGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const cheekMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.7, transparent: true, opacity: 0.0 });
    const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
    cheekL.position.set(-0.38, -0.12, 0.72);
    avatarGroup.add(cheekL);
    cheekLRef.current = cheekL;

    const cheekR = new THREE.Mesh(cheekGeo.clone(), cheekMat.clone());
    cheekR.position.set(0.38, -0.12, 0.72);
    avatarGroup.add(cheekR);
    cheekRRef.current = cheekR;

    // -----------------------------------------------------------------------
    // Lips (CatmullRom tubes)
    // -----------------------------------------------------------------------
    const initialBlends: VisemeBlends = {
      jawOpen: 0, jawForward: 0, jawLeft: 0, jawRight: 0,
      mouthClose: 0, mouthFunnel: 0, mouthPucker: 0, mouthLeft: 0, mouthRight: 0,
      mouthSmileLeft: 0, mouthSmileRight: 0, mouthFrownLeft: 0, mouthFrownRight: 0,
      mouthDimpleLeft: 0, mouthDimpleRight: 0, mouthStretchLeft: 0, mouthStretchRight: 0,
      mouthRollLower: 0, mouthRollUpper: 0,
      mouthShrugLower: 0, mouthShrugUpper: 0, mouthPressLeft: 0, mouthPressRight: 0,
      mouthLowerDownLeft: 0, mouthLowerDownRight: 0, mouthUpperUpLeft: 0, mouthUpperUpRight: 0,
      cheekPuff: 0, cheekSquintLeft: 0, cheekSquintRight: 0,
      noseSneerLeft: 0, noseSneerRight: 0,
      tongueOut: 0, tongueUp: 0, tongueDown: 0, tongueLeft: 0, tongueRight: 0,
      tongueRoll: 0, tongueBendDown: 0, tongueCurlUp: 0, tongueSquish: 0, tongueFlat: 0,
    };

    const upperLip = makeLipTube(computeUpperLipPoints(initialBlends), 0.028, LIP_COLOR, scene);
    upperLipRef.current = upperLip;

    const lowerLip = makeLipTube(computeLowerLipPoints(initialBlends), 0.032, LIP_COLOR, scene);
    lowerLipRef.current = lowerLip;

    // -----------------------------------------------------------------------
    // Teeth
    // -----------------------------------------------------------------------
    const teethGeo = new THREE.PlaneGeometry(0.30, 0.08);
    const teethMat = new THREE.MeshStandardMaterial({ color: TEETH_COLOR, roughness: 0.3, side: THREE.FrontSide });
    const teeth = new THREE.Mesh(teethGeo, teethMat);
    teeth.position.set(0, -0.21, 0.85);
    teeth.visible = false;
    scene.add(teeth);
    teethRef.current = teeth;

    // -----------------------------------------------------------------------
    // Tongue
    // -----------------------------------------------------------------------
    const tongueGeo = new THREE.SphereGeometry(1, 16, 12);
    const tongueMat = new THREE.MeshStandardMaterial({ color: TONGUE_COLOR, roughness: 0.6 });
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.scale.set(0.12, 0.06, 0.08);
    tongue.position.set(0, -0.24, 0.85);
    tongue.visible = false;
    scene.add(tongue);
    tongueRef.current = tongue;

    // -----------------------------------------------------------------------
    // Animation loop
    // -----------------------------------------------------------------------
    let time = 0;

    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      time += 0.016;

      const b = blendsRef.current;
      const isSpeaking = speakingRef.current;

      // Idle head bob
      if (avatarGroupRef.current) {
        avatarGroupRef.current.position.y = 0.03 * Math.sin(time * 0.8);
        // Subtle sway
        avatarGroupRef.current.rotation.y = 0.015 * Math.sin(time * 0.4);
        avatarGroupRef.current.rotation.z = 0.008 * Math.sin(time * 0.6 + 1.2);
      }

      // Jaw rotation
      if (jawPivotRef.current) {
        jawPivotRef.current.rotation.x = -b.jawOpen * 0.35;
      }

      // Recompute lip geometry
      if (upperLipRef.current) {
        rebuildLipTube(upperLipRef.current, computeUpperLipPoints(b), 0.028);
      }
      if (lowerLipRef.current) {
        rebuildLipTube(lowerLipRef.current, computeLowerLipPoints(b), 0.032);
      }

      // Teeth visibility
      if (teethRef.current) {
        teethRef.current.visible = b.jawOpen > 0.2;
        teethRef.current.position.y = -0.21 - b.jawOpen * 0.025;
      }

      // Tongue
      if (tongueRef.current) {
        tongueRef.current.visible = b.tongueOut > 0.2;
        if (b.tongueOut > 0.2) {
          tongueRef.current.position.set(
            b.tongueLeft * 0.05 - b.tongueRight * 0.05,
            -0.24 + b.tongueUp * 0.04 - b.tongueDown * 0.04,
            0.85 + b.tongueOut * 0.06,
          );
        }
      }

      // Cheek puff
      if (cheekLRef.current && cheekRRef.current) {
        const puff = 1 + b.cheekPuff * 0.3;
        cheekLRef.current.scale.setScalar(puff);
        cheekRRef.current.scale.setScalar(puff);
        (cheekLRef.current.material as THREE.MeshStandardMaterial).opacity = b.cheekPuff * 0.25;
        (cheekRRef.current.material as THREE.MeshStandardMaterial).opacity = b.cheekPuff * 0.25;
      }

      // Brow squint (cheekSquint drives brow compression inward)
      if (browLRef.current) {
        browLRef.current.rotation.z = 0.05 + b.cheekSquintLeft * 0.18;
        browLRef.current.position.y = 0.47 - b.cheekSquintLeft * 0.04;
      }
      if (browRRef.current) {
        browRRef.current.rotation.z = -0.05 - b.cheekSquintRight * 0.18;
        browRRef.current.position.y = 0.47 - b.cheekSquintRight * 0.04;
      }

      // Rim light pulse
      if (rimLightRef.current) {
        if (isSpeaking) {
          const pulse = 0.4 + 0.3 * Math.sin(time * 6);
          rimLightRef.current.intensity = pulse;
          rimLightRef.current.color.setHSL(0.55 + 0.1 * Math.sin(time * 2), 0.9, 0.6);
        } else {
          rimLightRef.current.intensity *= 0.92;
        }
      }

      renderer.render(scene, camera);
    }

    rafRef.current = requestAnimationFrame(animate);

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Dispose geometries and materials
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            (mesh.material as THREE.Material)?.dispose();
          }
        }
      });

      renderer.dispose();

      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only mount/unmount

  return (
    <div
      ref={mountRef}
      style={{
        width: W,
        height: H,
        borderRadius: '1rem',
        overflow: 'hidden',
        background: '#0d1117',
        display: 'block',
      }}
    />
  );
}
