import { useRef, useEffect, useMemo } from "react";
import { useFrame, useGraph } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

type AvatarState = "idle" | "speaking" | "listening";

interface AvatarHeadProps {
  state: AvatarState;
  audioAnalyser: AnalyserNode | null;
}

// Visemes to cycle through during speaking
const VISEME_NAMES = [
  "viseme_aa",
  "viseme_O",
  "viseme_E",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_CH",
  "viseme_kk",
];

const AvatarHead = ({ state, audioAnalyser }: AvatarHeadProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/avatar.glb");

  // Clone scene to avoid shared mutation
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  // Collect all skinned meshes with morph targets
  const morphMeshes = useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    clone.traverse((child) => {
      if (
        (child as THREE.SkinnedMesh).isSkinnedMesh &&
        (child as THREE.SkinnedMesh).morphTargetDictionary
      ) {
        meshes.push(child as THREE.SkinnedMesh);
      }
    });
    return meshes;
  }, [clone]);

  const dataArray = useMemo(() => {
    if (!audioAnalyser) return null;
    return new Uint8Array(audioAnalyser.frequencyBinCount);
  }, [audioAnalyser]);

  // Refs for animation state
  const visemeState = useRef({
    currentIndex: 0,
    nextSwitch: 0,
    currentInfluences: new Float32Array(VISEME_NAMES.length),
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() / 1000;

    // --- Idle breathing ---
    const breathe = Math.sin(t * 1.2) * 0.003;
    groupRef.current.position.y = -1.5 + breathe;

    // Subtle head sway
    const swayAmount = state === "listening" ? 0.04 : 0.02;
    const swaySpeed = state === "listening" ? 0.4 : 0.6;
    groupRef.current.rotation.y = Math.sin(t * swaySpeed) * swayAmount;
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.01;

    // Listening tilt
    if (state === "listening") {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        0.03,
        delta * 2
      );
    } else {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        0,
        delta * 2
      );
    }

    // Speaking nod
    if (state === "speaking") {
      groupRef.current.rotation.x += Math.sin(t * 2.5) * 0.008;
    }

    // --- Viseme / Lip-sync animation ---
    const vs = visemeState.current;

    if (state === "speaking") {
      let mouthOpenness = 0;

      if (audioAnalyser && dataArray) {
        // Use real audio data
        audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        mouthOpenness = Math.min((sum / dataArray.length / 255) * 3, 1);
      } else {
        // Timing-based fallback for Vapi
        mouthOpenness = Math.sin(t * 8) * 0.5 + 0.5;
      }

      // Cycle through visemes
      vs.nextSwitch -= delta;
      if (vs.nextSwitch <= 0) {
        vs.currentIndex = (vs.currentIndex + 1) % VISEME_NAMES.length;
        vs.nextSwitch = 0.08 + Math.random() * 0.12; // 80-200ms per viseme
      }

      // Update morph target influences
      for (let i = 0; i < VISEME_NAMES.length; i++) {
        const target = i === vs.currentIndex ? mouthOpenness * 0.7 : 0;
        vs.currentInfluences[i] = THREE.MathUtils.lerp(
          vs.currentInfluences[i],
          target,
          delta * 12
        );
      }
    } else {
      // Reset all visemes when not speaking
      for (let i = 0; i < VISEME_NAMES.length; i++) {
        vs.currentInfluences[i] = THREE.MathUtils.lerp(
          vs.currentInfluences[i],
          0,
          delta * 8
        );
      }
    }

    // Apply morph targets to all skinned meshes
    morphMeshes.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      for (let i = 0; i < VISEME_NAMES.length; i++) {
        const idx = mesh.morphTargetDictionary[VISEME_NAMES[i]];
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = vs.currentInfluences[i];
        }
      }

      // Blink animation
      const blinkIdx = mesh.morphTargetDictionary["eyeBlinkLeft"];
      const blinkIdxR = mesh.morphTargetDictionary["eyeBlinkRight"];
      if (blinkIdx !== undefined && blinkIdxR !== undefined) {
        const blinkCycle = t % 4;
        const blinkValue =
          blinkCycle > 3.7 && blinkCycle < 3.9
            ? Math.sin((blinkCycle - 3.7) * Math.PI * 5)
            : 0;
        mesh.morphTargetInfluences[blinkIdx] = blinkValue;
        mesh.morphTargetInfluences[blinkIdxR] = blinkValue;
      }
    });
  });

  return (
    <group ref={groupRef} position={[0, -1.5, 0]} scale={1.8}>
      <primitive object={clone} />
    </group>
  );
};

useGLTF.preload("/models/avatar.glb");

export default AvatarHead;
