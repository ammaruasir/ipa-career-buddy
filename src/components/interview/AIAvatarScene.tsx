type AvatarState = "idle" | "speaking" | "listening";

interface AIAvatarSceneProps {
  avatarState: AvatarState;
  audioAnalyser?: AnalyserNode | null;
  name?: string;
  gender?: "male" | "female";
  avatarUrl?: string;
}

const MaleSilhouette = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <linearGradient id="maleBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#d0d8e8" />
        <stop offset="100%" stopColor="#b8c4d8" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#maleBg)" />
    {/* Head */}
    <ellipse cx="100" cy="78" rx="30" ry="32" fill="#8899aa" />
    {/* Ghutra (head cover) */}
    <path d="M65 68 Q68 45 100 42 Q132 45 135 68 L138 78 Q135 60 100 55 Q65 60 62 78 Z" fill="#f5f5f0" />
    {/* Ghutra sides draping */}
    <path d="M65 72 Q60 85 58 110 L68 110 Q70 90 72 78 Z" fill="#f5f5f0" />
    <path d="M135 72 Q140 85 142 110 L132 110 Q130 90 128 78 Z" fill="#f5f5f0" />
    {/* Agal (black band) */}
    <ellipse cx="100" cy="58" rx="28" ry="4" fill="none" stroke="#2a2a2a" strokeWidth="2.5" />
    {/* Body - Thobe */}
    <path d="M60 130 Q65 110 100 105 Q135 110 140 130 L150 200 L50 200 Z" fill="#f0ede8" />
    {/* Neck */}
    <rect x="90" y="105" width="20" height="12" rx="4" fill="#8899aa" />
    {/* Thobe collar */}
    <path d="M92 115 L100 125 L108 115" fill="none" stroke="#d5d0c8" strokeWidth="1.5" />
  </svg>
);

const FemaleSilhouette = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <linearGradient id="femaleBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e0d0e0" />
        <stop offset="100%" stopColor="#d0c0d4" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#femaleBg)" />
    {/* Hijab outer */}
    <path d="M55 90 Q55 35 100 30 Q145 35 145 90 Q145 120 130 130 L70 130 Q55 120 55 90 Z" fill="#6b7b8d" />
    {/* Face */}
    <ellipse cx="100" cy="82" rx="26" ry="30" fill="#a0aab4" />
    {/* Hijab inner frame */}
    <path d="M72 70 Q72 50 100 45 Q128 50 128 70 Q128 65 100 60 Q72 65 72 70 Z" fill="#5a6a7c" />
    {/* Body */}
    <path d="M60 140 Q65 125 100 120 Q135 125 140 140 L148 200 L52 200 Z" fill="#4a5a6c" />
    {/* Neck area */}
    <rect x="90" y="110" width="20" height="14" rx="4" fill="#a0aab4" />
  </svg>
);

const AIAvatarScene = ({ avatarState, name, gender = "female", avatarUrl }: AIAvatarSceneProps) => {
  const displayName = name || (gender === "female" ? "نورة" : "أحمد");
  const isFemale = gender === "female";

  const speakingLabel = isFemale ? "تتحدث..." : "يتحدث...";
  const listeningLabel = isFemale ? "تستمع..." : "يستمع...";
  const readyLabel = isFemale ? "جاهزة" : "جاهز";
  const titleLabel = isFemale ? `محاورة واكب الذكية` : `محاور واكب الذكي`;

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

      {/* Avatar */}
      <div
        className={`relative z-0 w-full h-full transition-transform duration-700 ease-in-out ${
          avatarState === "idle" ? "animate-avatar-breathe" : ""
        } ${avatarState === "speaking" ? "scale-[1.02]" : ""}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={titleLabel} className="w-full h-full object-cover rounded-2xl" draggable={false} />
        ) : isFemale ? (
          <FemaleSilhouette />
        ) : (
          <MaleSilhouette />
        )}
      </div>

      {/* Sound wave bars for speaking */}
      {avatarState === "speaking" && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 z-20">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary/60 rounded-full animate-sound-bar"
              style={{ animationDelay: `${i * 0.12}s`, height: "12px" }}
            />
          ))}
        </div>
      )}

      {/* Label */}
      <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center pointer-events-none z-10">
        <span className="text-xs font-bold text-foreground/80 bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded">{titleLabel}</span>
        <span className="text-[10px] text-muted-foreground bg-background/60 backdrop-blur-sm px-2 rounded">
          {avatarState === "speaking" ? speakingLabel : avatarState === "listening" ? listeningLabel : readyLabel}
        </span>
      </div>
    </div>
  );
};

export default AIAvatarScene;
