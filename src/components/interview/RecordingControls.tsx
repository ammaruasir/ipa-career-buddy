import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const RecordingControls = ({ isRecording, isPaused, onPause, onResume, onStop }: RecordingControlsProps) => (
  <div className="flex items-center justify-center gap-4">
    {isRecording && !isPaused && (
      <Button variant="outline" size="lg" className="rounded-full h-14 w-14" onClick={onPause}>
        <Pause className="w-6 h-6" />
      </Button>
    )}
    {isRecording && isPaused && (
      <Button variant="outline" size="lg" className="rounded-full h-14 w-14" onClick={onResume}>
        <Play className="w-6 h-6" />
      </Button>
    )}
    {isRecording && (
      <Button variant="destructive" size="lg" className="rounded-full h-14 w-14" onClick={onStop}>
        <Square className="w-6 h-6" />
      </Button>
    )}
  </div>
);

export default RecordingControls;
