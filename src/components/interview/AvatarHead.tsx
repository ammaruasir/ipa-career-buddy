import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type AvatarState = "idle" | "speaking" | "listening";

interface AvatarHeadProps {
  state: AvatarState;
  audioAnalyser: AnalyserNode | null;
}

const AvatarHead = ({ state, audioAnalyser }: AvatarHeadProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const leftPupilRef = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);

  const blinkState = useRef({ nextBlink: 2, blinking: false, blinkProgress: 0 });
  const dataArray = useMemo(() => {
    if (!audioAnalyser) return null;
    return new Uint8Array(audioAnalyser.frequencyBinCount);
  }, [audioAnalyser]);

  // Skin & material colors
  const skinColor = useMemo(() => new THREE.Color("#e8b89d"), []);
  const lipColor = useMemo(() => new THREE.Color("#c47a6a"), []);
  const eyeWhite = useMemo(() => new THREE.Color("#f5f5f5"), []);
  const irisColor = useMemo(() => new THREE.Color("#3d2b1f"), []);
  const browColor = useMemo(() => new THREE.Color("#4a3728"), []);
  const noseColor = useMemo(() => new THREE.Color("#d9a68a"), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() / 1000;

    // --- Head sway ---
    const swayAmount = state === "listening" ? 0.06 : 0.03;
    const swaySpeed = state === "listening" ? 0.4 : 0.6;
    groupRef.current.rotation.y = Math.sin(t * swaySpeed) * swayAmount;
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.015;

    // Breathing
    const breathe = 1 + Math.sin(t * 1.2) * 0.008;
    groupRef.current.scale.setScalar(breathe);

    // Listening tilt
    if (state === "listening") {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0.05, delta * 2);
    } else {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, delta * 2);
    }

    // Speaking nod
    if (state === "speaking") {
      groupRef.current.rotation.x += Math.sin(t * 2.5) * 0.012;
    }

    // --- Mouth animation ---
    if (mouthRef.current) {
      let mouthOpen = 0;
      if (state === "speaking") {
        if (audioAnalyser && dataArray) {
          audioAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length / 255;
          mouthOpen = Math.min(avg * 3, 1);
        } else {
          // Fallback timing-based
          mouthOpen = (Math.sin(t * 8) * 0.5 + 0.5) * 0.7;
        }
      }
      const targetScaleY = 0.3 + mouthOpen * 1.2;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetScaleY, delta * 12);
      // Slightly open mouth width when speaking
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, 1 + mouthOpen * 0.15, delta * 8);
    }

    // --- Blink ---
    const blink = blinkState.current;
    blink.nextBlink -= delta;
    if (blink.nextBlink <= 0 && !blink.blinking) {
      blink.blinking = true;
      blink.blinkProgress = 0;
    }
    if (blink.blinking) {
      blink.blinkProgress += delta * 8;
      const p = blink.blinkProgress;
      const scaleY = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      leftEyeRef.current?.scale.set(1, Math.max(scaleY, 0.05), 1);
      rightEyeRef.current?.scale.set(1, Math.max(scaleY, 0.05), 1);
      if (p >= 1) {
        blink.blinking = false;
        blink.nextBlink = 2.5 + Math.random() * 3;
        leftEyeRef.current?.scale.set(1, 1, 1);
        rightEyeRef.current?.scale.set(1, 1, 1);
      }
    }

    // --- Eyebrows ---
    const browRaise = state === "speaking" ? 0.06 + Math.sin(t * 3) * 0.02 : 0;
    if (leftBrowRef.current) {
      leftBrowRef.current.position.y = THREE.MathUtils.lerp(leftBrowRef.current.position.y, 0.52 + browRaise, delta * 5);
    }
    if (rightBrowRef.current) {
      rightBrowRef.current.position.y = THREE.MathUtils.lerp(rightBrowRef.current.position.y, 0.52 + browRaise, delta * 5);
    }

    // --- Pupil micro-movement ---
    const pupilDrift = state === "listening" ? 0.02 : 0.01;
    const px = Math.sin(t * 0.7) * pupilDrift;
    const py = Math.cos(t * 0.5) * pupilDrift * 0.5;
    leftPupilRef.current?.position.set(px, py, 0.06);
    rightPupilRef.current?.position.set(px, py, 0.06);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Head */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Ears */}
      <mesh position={[-0.95, 0.05, 0]} rotation={[0, 0, 0.15]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.95, 0.05, 0]} rotation={[0, 0, -0.15]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, -0.05, 0.9]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.12, 0.3, 8]} />
        <meshStandardMaterial color={noseColor} roughness={0.5} />
      </mesh>
      {/* Nose bridge */}
      <mesh position={[0, 0.12, 0.88]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={noseColor} roughness={0.5} />
      </mesh>

      {/* Left Eye */}
      <group ref={leftEyeRef} position={[-0.32, 0.28, 0.78]}>
        <mesh>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshStandardMaterial color={eyeWhite} roughness={0.2} />
        </mesh>
        {/* Iris */}
        <mesh ref={leftPupilRef} position={[0, 0, 0.06]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={irisColor} roughness={0.3} />
        </mesh>
        {/* Pupil */}
        <mesh position={[0, 0, 0.11]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="black" />
        </mesh>
      </group>

      {/* Right Eye */}
      <group ref={rightEyeRef} position={[0.32, 0.28, 0.78]}>
        <mesh>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshStandardMaterial color={eyeWhite} roughness={0.2} />
        </mesh>
        <mesh ref={rightPupilRef} position={[0, 0, 0.06]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={irisColor} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.11]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="black" />
        </mesh>
      </group>

      {/* Left Eyebrow */}
      <mesh ref={leftBrowRef} position={[-0.32, 0.52, 0.8]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.22, 0.04, 0.06]} />
        <meshStandardMaterial color={browColor} roughness={0.8} />
      </mesh>

      {/* Right Eyebrow */}
      <mesh ref={rightBrowRef} position={[0.32, 0.52, 0.8]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.22, 0.04, 0.06]} />
        <meshStandardMaterial color={browColor} roughness={0.8} />
      </mesh>

      {/* Mouth */}
      <mesh ref={mouthRef} position={[0, -0.35, 0.85]}>
        <torusGeometry args={[0.15, 0.04, 8, 24]} />
        <meshStandardMaterial color={lipColor} roughness={0.4} />
      </mesh>
    </group>
  );
};

export default AvatarHead;
