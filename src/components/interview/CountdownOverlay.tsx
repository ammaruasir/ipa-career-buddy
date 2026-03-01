import { useState, useEffect } from "react";

interface CountdownOverlayProps {
  onComplete: () => void;
}

const CountdownOverlay = ({ onComplete }: CountdownOverlayProps) => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onComplete]);

  if (count <= 0) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <span
        key={count}
        className="text-8xl font-bold text-primary animate-countdown-pop"
      >
        {count}
      </span>
    </div>
  );
};

export default CountdownOverlay;
