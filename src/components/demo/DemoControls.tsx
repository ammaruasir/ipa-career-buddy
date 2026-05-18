import { Button } from "@/components/ui/button";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { useTourEngine } from "@/contexts/DemoTourContext";

export function DemoControls() {
  const { status, pause, resume, next, exit, takeOverMode, setTakeOverMode } = useTourEngine();

  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
      <div className="flex items-center gap-1">
        {status === "running" ? (
          <Button size="sm" variant="ghost" onClick={pause} title="إيقاف مؤقّت">
            <Pause className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={resume} title="استئناف">
            <Play className="w-4 h-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={next} title="التالي">
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-primary"
          checked={takeOverMode}
          onChange={(e) => setTakeOverMode(e.target.checked)}
        />
        أنا أتحكّم
      </label>

      <Button size="sm" variant="ghost" onClick={exit} title="إنهاء الجولة">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
