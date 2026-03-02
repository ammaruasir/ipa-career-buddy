import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import AvatarHead from "./AvatarHead";

type AvatarState = "idle" | "speaking" | "listening";

interface AIAvatarSceneProps {
  avatarState: AvatarState;
  audioAnalyser: AnalyserNode | null;
}

const AIAvatarScene = ({ avatarState, audioAnalyser }: AIAvatarSceneProps) => {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-b from-muted/60 to-muted relative">
      {/* State indicator ring */}
      {avatarState === "speaking" && (
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/40 animate-pulse pointer-events-none z-10" />
      )}
      {avatarState === "listening" && (
        <div className="absolute inset-0 rounded-2xl border-2 border-accent/40 pointer-events-none z-10" />
      )}

      <Canvas
        camera={{ position: [0, 0, 2.2], fov: 30 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 4, 5]} intensity={1} castShadow />
          <directionalLight position={[-2, 2, 3]} intensity={0.4} color="#b8d4ff" />
          <pointLight position={[0, 0, -3]} intensity={0.3} color="#ffd4b8" />

          <Environment preset="studio" />

          <AvatarHead state={avatarState} audioAnalyser={audioAnalyser} />
        </Suspense>
      </Canvas>

      {/* Label */}
      <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center pointer-events-none z-10">
        <span className="text-xs font-bold text-foreground/80">المحاور الذكي</span>
        <span className="text-[10px] text-muted-foreground">
          {avatarState === "speaking" ? "يتحدث..." : avatarState === "listening" ? "يستمع..." : "جاهز"}
        </span>
      </div>
    </div>
  );
};

export default AIAvatarScene;
