import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
}

const AudioWaveform = ({ analyser, isRecording }: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser || !isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 40;
      const barWidth = canvas.width / barCount - 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[idx] / 255;
        const barHeight = value * centerY * 0.9;

        const hue = 222; // primary hue
        ctx.fillStyle = `hsla(${hue}, 72%, 50%, ${0.6 + value * 0.4})`;
        ctx.beginPath();
        ctx.roundRect(i * (barWidth + 2), centerY - barHeight, barWidth, barHeight * 2, 2);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyser, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      className="w-full max-w-md h-[120px] rounded-xl bg-muted/30"
    />
  );
};

export default AudioWaveform;
