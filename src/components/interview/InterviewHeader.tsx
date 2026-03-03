import { GraduationCap, ArrowRight, HelpCircle, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface InterviewHeaderProps {
  title?: string;
  timerFormatted: string;
  isWarning: boolean;
  questionCount: number;
  totalQuestions: number;
  phaseLabel?: string;
  onBack: () => void;
}

const InterviewHeader = ({
  title = "المقابلة الذكية",
  timerFormatted,
  isWarning,
  questionCount,
  totalQuestions,
  phaseLabel,
  onBack,
}: InterviewHeaderProps) => {
  const progress = (Math.min(questionCount, totalQuestions) / totalQuestions) * 100;

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 space-y-2">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={onBack}>
              <ArrowRight className="w-5 h-5" />
            </Button>
            <img src="/ipa-logo.png" alt="معهد الإدارة العامة" className="w-9 h-9 rounded-xl object-contain" />
            <div>
              <h2 className="text-sm font-bold leading-tight">المقابلة الذكية</h2>
              <p className="text-xs text-muted-foreground">معهد الإدارة العامة</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wifi className="w-3.5 h-3.5 text-success" />
            </div>

            {/* Timer */}
            <div
              className={`font-mono text-sm font-bold px-3 py-1 rounded-full ${
                isWarning
                  ? "bg-destructive/10 text-destructive animate-pulse"
                  : "bg-muted text-foreground"
              }`}
            >
              {timerFormatted}
            </div>

            {/* Help */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>مساعدة</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• أجب على كل سؤال خلال الوقت المحدد</p>
                  <p>• يمكنك مراجعة إجابتك قبل الإرسال</p>
                  <p>• سيتم تقييم إجاباتك تلقائياً بعد انتهاء المقابلة</p>
                  <p>• تأكد من اتصالك بالإنترنت قبل البدء</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Progress row */}
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {phaseLabel 
              ? `${phaseLabel} • ${Math.min(questionCount, totalQuestions)}/${totalQuestions}`
              : `السؤال ${Math.min(questionCount, totalQuestions)} من ${totalQuestions}`
            }
          </span>
        </div>
      </div>
    </header>
  );
};

export default InterviewHeader;
