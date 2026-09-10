/**
 * Generic "fit camera to bounding box" math for RPMAvatarScene.
 *
 * The old framing logic hardcoded an eye-level heuristic tuned for Ready
 * Player Me's specific half-body proportions (`box.max.y * 0.88`, assuming
 * feet-at-origin on a roughly 1.6-1.8m-tall figure). Swapping in
 * facecap_clean.glb — a head-only model at a completely different scale
 * and origin convention — broke that assumption outright: the computed
 * "eye level" put the camera looking at empty space above the model, with
 * only the very top of the scalp visible at the bottom edge of frame.
 *
 * This computes a camera position/look-at purely from the model's actual
 * bounding box, so it frames whatever GLB is loaded regardless of its
 * native scale or origin — including the next model swapped in here.
 */

export interface FitCameraResult {
  position: [number, number, number];
  lookAt:   [number, number, number];
}

/**
 * @param boxMin bounding-box min corner [x, y, z]
 * @param boxMax bounding-box max corner [x, y, z]
 * @param verticalFovDegrees camera's vertical field of view
 * @param marginFactor how much breathing room around the model (1 = tight fit)
 */
export function computeFitCamera(
  boxMin: readonly [number, number, number],
  boxMax: readonly [number, number, number],
  verticalFovDegrees: number,
  marginFactor = 1.4,
): FitCameraResult {
  const center: [number, number, number] = [
    (boxMin[0] + boxMax[0]) / 2,
    (boxMin[1] + boxMax[1]) / 2,
    (boxMin[2] + boxMax[2]) / 2,
  ];
  const size: [number, number, number] = [
    boxMax[0] - boxMin[0],
    boxMax[1] - boxMin[1],
    boxMax[2] - boxMin[2],
  ];
  const maxDim = Math.max(size[0], size[1], size[2]);
  const halfFovRad = (verticalFovDegrees * Math.PI) / 180 / 2;
  const fitDistance = (maxDim / 2 / Math.tan(halfFovRad)) * marginFactor;

  return {
    position: [center[0], center[1], center[2] + fitDistance],
    lookAt: center,
  };
}
