import interviewerAvatar from "@/assets/interviewer-avatar.png";

type AvatarState = "idle" | "speaking" | "listening";

interface AIAvatarSceneProps {
  avatarState: AvatarState;
  audioAnalyser?: AnalyserNode | null;
}

const AIAvatarScene = ({ avatarState }: AIAvatarSceneProps) => {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-b from-muted/60 to-muted relative flex items-center justify-center">
      {/* Speaking pulse rings */}
      {avatarState === "speaking" && (
        <>
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping pointer-events-none z-10" style={{ animationDuration: "1.5s" }} />
          <div className="absolute inset-2 rounded-xl border border-primary/20 animate-ping pointer-events-none z-10" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
        </>
      )}

      {/* Listening glow */}
      {avatarState === "listening" && (
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_30px_rgba(var(--accent),0.15)] border-2 border-accent/30 pointer-events-none z-10 transition-all duration-500" />
      )}

      {/* Avatar image */}
      <div
        className={`relative z-0 transition-transform duration-700 ease-in-out ${
          avatarState === "idle" ? "animate-avatar-breathe" : ""
        } ${avatarState === "speaking" ? "scale-[1.02]" : ""}`}
      >
        <img
          src={interviewerAvatar}
          alt="محاور واكب الذكي"
          className="w-full h-full object-cover rounded-2xl"
          draggable={false}
        />
      </div>

      {/* Sound wave bars for speaking */}
      {avatarState === "speaking" && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 z-20">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary/60 rounded-full animate-sound-bar"
              style={{
                animationDelay: `${i * 0.12}s`,
                height: "12px",
              }}
            />
          ))}
        </div>
      )}

      {/* Label */}
      <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center pointer-events-none z-10">
        <span className="text-xs font-bold text-foreground/80 bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded">محاور واكب الذكي</span>
        <span className="text-[10px] text-muted-foreground bg-background/60 backdrop-blur-sm px-2 rounded">
          {avatarState === "speaking" ? "يتحدث..." : avatarState === "listening" ? "يستمع..." : "جاهز"}
        </span>
      </div>
    </div>
  );
};

export default AIAvatarScene;
