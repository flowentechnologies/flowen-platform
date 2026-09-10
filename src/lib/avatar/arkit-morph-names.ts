/**
 * Normalizes ARKit blend-shape names to Flowen's camelCase convention
 * (mouthSmileLeft, browDownRight, …), used throughout VisemeBlends and
 * ExtraBlends.
 *
 * Real bug this fixes: facecap_clean.glb (the self-hosted stopgap avatar,
 * see AgoraAvatarSession's DEFAULT_AVATAR_URL) carries the full 52 ARKit
 * blend shapes, but exported using Apple's raw naming convention with an
 * underscore + single-letter side suffix (browDown_L, mouthSmile_R) —
 * Ready Player Me exported the camelCase-suffix convention this app was
 * originally built against (mouthSmileLeft). RPMAvatarScene's morph-target
 * lookup only ever matched the camelCase form, so every one of these 52
 * shapes silently failed to match on the new model: the avatar loaded and
 * was correctly framed, but its face never moved at all — no lipsync, no
 * expression, nothing.
 *
 * Applying this during morph-target collection (not by renaming
 * ARKIT_MORPH_KEYS itself) keeps RPMAvatarScene working with either
 * naming convention transparently — including a real Ready Player Me
 * export, or whatever GLB eventually replaces this stopgap.
 */
export function normalizeArkitMorphName(name: string): string {
  if (name.endsWith('_L')) return name.slice(0, -2) + 'Left';
  if (name.endsWith('_R')) return name.slice(0, -2) + 'Right';
  return name;
}
