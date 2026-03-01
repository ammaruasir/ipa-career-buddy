

# 3D Animated AI Avatar for Video Interview

## Approach

Build a 3D animated interviewer head using **React Three Fiber** (`@react-three/fiber@^8.18` + `three@^0.170` + `@react-three/drei@^9.122.0`) that renders directly in the browser with no external API needed.

The avatar will be a stylized professional 3D head with:
- **Idle**: subtle breathing, gentle head sway, periodic blinking
- **Speaking**: lip-sync mouth animation driven by audio amplitude (Web Audio API analyser), eyebrow movement
- **Listening**: attentive posture, slight head tilt, ear glow indicator

## Architecture

```text
┌─────────────────────────────────────────────┐
│ VideoInterview.tsx (split layout)            │
│ ┌──────────────┐  ┌───────────────────────┐ │
│ │ Candidate    │  │ <Canvas>              │ │
│ │ Camera Feed  │  │   <AIAvatarHead />    │ │
│ │              │  │   - morph targets for │ │
│ │              │  │     mouth/eyes/brows  │ │
│ │              │  │   - driven by audio   │ │
│ │              │  │     analyser data     │ │
│ └──────────────┘  └───────────────────────┘ │
│                                             │
│ Browser TTS speaks AI text                  │
│   → Web Audio API AnalyserNode              │
│   → frequency data drives mouth morphs      │
│   → avatar state: idle/speaking/listening   │
└─────────────────────────────────────────────┘
```

## Components to Create

### 1. `src/components/interview/AIAvatarScene.tsx`
- React Three Fiber `<Canvas>` wrapper with lighting and camera
- Contains the 3D head model component
- Receives `avatarState: "idle" | "speaking" | "listening"` and `audioAnalyser: AnalyserNode | null`

### 2. `src/components/interview/AvatarHead.tsx`
- Procedural 3D head built with Three.js geometries (sphere for head, torus for eyes, custom mouth shape)
- Uses `useFrame` to animate:
  - **Mouth**: opens/closes based on audio frequency amplitude from the analyser
  - **Eyes**: periodic blink animation (close/open every 3-5s randomly)
  - **Head**: gentle sine-wave sway on Y-axis for natural movement
  - **Eyebrows**: raise during speaking for expressiveness
- Skin-toned materials with subtle lighting

### 3. `src/hooks/useBrowserTTS.ts`
- Wraps `window.speechSynthesis` for Arabic TTS
- Routes audio through `AudioContext` → `AnalyserNode` to extract amplitude data
- Returns: `speak(text)`, `isSpeaking`, `analyserNode`
- On TTS end, signals the avatar to switch from "speaking" to "listening"

## Files to Modify

### `src/pages/VideoInterview.tsx`
- Replace the static Briefcase icon panel with the `<AIAvatarScene />` 3D canvas
- Wire the interview flow: when AI message arrives → TTS speaks it → avatar animates → when TTS ends → mic auto-starts
- Add `useBrowserTTS` hook integration

### `package.json`
- Add: `@react-three/fiber@^8.18`, `three@^0.170`, `@react-three/drei@^9.122.0`

## Technical Details

**Lip-sync via Web Audio API:**
- `SpeechSynthesisUtterance` audio routed through `MediaStreamDestination` → `AnalyserNode`
- `getByteFrequencyData()` sampled every frame in `useFrame`
- Average amplitude mapped to mouth open/close morph (0-1 range)
- Fallback: if audio routing isn't supported, use timing-based mouth animation synced to speech duration

**Procedural 3D Head (no GLTF model needed):**
- Head: `SphereGeometry` with skin-tone `MeshStandardMaterial`
- Eyes: Two white spheres with dark iris spheres inside, animated scale for blinking
- Mouth: `TorusGeometry` or custom shape that scales vertically for open/close
- Nose: Small `ConeGeometry`
- Professional lighting: ambient + directional + soft rim light

**Animation States:**
- `idle`: slow head rotation (±5°), breathing scale (±2%), random blinks
- `speaking`: mouth synced to audio, wider eyes, subtle head nods
- `listening`: slight head tilt, calm expression, pulsing ring around canvas

