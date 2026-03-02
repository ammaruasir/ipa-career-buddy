

## Problem

1. **Ugly Avatar**: The current `AvatarHead.tsx` is a hand-crafted primitive (spheres, cones, boxes) that looks cartoonish and robotic. No morph targets means no real lip-sync — just a torus bouncing.
2. **Vapi Testing**: Need to verify the Vapi real-time flow works end-to-end.

## Plan

### 1. Replace primitive avatar with Ready Player Me GLB model

**What changes:**

- **New file: `public/models/avatar.glb`** — Download a pre-configured RPM avatar with morph targets (ARKit + Oculus Visemes) enabled. We'll use a public RPM avatar URL with `?morphTargets=ARKit,Oculus+Visemes` query param to ensure the GLB includes viseme blend shapes for lip-sync.

- **Rewrite `AvatarHead.tsx`** — Replace the primitive geometry with a `useGLTF`-loaded RPM model. The component will:
  - Load the GLB via `useGLTF("/models/avatar.glb")`
  - Clone the scene with `SkeletonUtils.clone` to avoid mutation
  - Extract `nodes` and `materials` via `useGraph`
  - Render all `skinnedMesh` parts (Head, Teeth, Eyes, Body, Hair, Outfit)
  - Animate morph targets (visemes) in `useFrame` based on `audioAnalyser` data or timing-based fallback when `state === "speaking"`
  - Add idle breathing animation via subtle position/rotation oscillation
  - Map audio frequency bands to viseme morph targets for realistic mouth movement

- **Update `AIAvatarScene.tsx`** — Adjust camera position/FOV to frame the half-body RPM avatar properly (the current settings are for a floating head). Add `Environment` preset for better lighting on the realistic model.

- **Delete `AvatarHead.tsx`** old primitive code (replaced entirely).

### 2. Viseme lip-sync approach

Since Vapi streams audio through the browser (not through our `audioAnalyser`), we'll use a **timing-based viseme cycle** during `speaking` state:
- Cycle through common visemes (`viseme_aa`, `viseme_O`, `viseme_E`, `viseme_PP`, `viseme_FF`, etc.) at speech-like intervals
- Smooth transitions between visemes using `THREE.MathUtils.lerp`
- When `audioAnalyser` IS available (built-in engine with browser TTS), use frequency data to drive mouth openness

### 3. Vapi testing

After the avatar is replaced, I'll verify:
- The `vapi-token` edge function returns the public key
- The Vapi call flow initiates properly
- The avatar state transitions work (idle → speaking → listening)

### Technical Details

**Dependencies**: No new packages needed — `@react-three/drei` (already installed) includes `useGLTF`, `useGraph`, `Environment`. `three-stdlib` (bundled with drei) provides `SkeletonUtils`.

**RPM Avatar URL**: We'll fetch a GLB from Ready Player Me's public API with morph targets enabled:
```
https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes&textureAtlas=1024
```
This gives us a professional half-body avatar with all the blend shapes needed for lip-sync.

**Files modified:**
- `src/components/interview/AvatarHead.tsx` — Full rewrite (RPM model + viseme animation)
- `src/components/interview/AIAvatarScene.tsx` — Camera/lighting adjustments
- `public/models/avatar.glb` — New asset (downloaded from RPM)

