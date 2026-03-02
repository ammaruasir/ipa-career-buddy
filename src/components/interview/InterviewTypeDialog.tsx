import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquareText, Mic, Video, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface InterviewTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: "text" | "voice" | "video") => void;
  vacancyTitle: string;
}

const interviewTypes = [
  {
    type: "text" as const,
    icon: MessageSquareText,
    title: "مقابلة نصية",
    description: "أجب على الأسئلة كتابياً في محادثة تفاعلية",
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
    selectedBg: "bg-blue-500/20 border-blue-500",
    supportsVapi: false,
  },
  {
    type: "voice" as const,
    icon: Mic,
    title: "مقابلة صوتية",
    description: "سجّل إجاباتك صوتياً مع تحويل تلقائي للنص",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20",
    selectedBg: "bg-emerald-500/20 border-emerald-500",
    supportsVapi: true,
  },
  {
    type: "video" as const,
    icon: Video,
    title: "مقابلة بالفيديو",
    description: "سجّل إجاباتك بالفيديو مع تحليل ذكي للأداء",
    color: "text-purple-500",
    bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
    selectedBg: "bg-purple-500/20 border-purple-500",
    warning: "يُفضل استخدام جهاز كمبيوتر لأفضل تجربة",
    supportsVapi: true,
  },
];

const InterviewTypeDialog = ({ open, onOpenChange, onSelect, vacancyTitle }: InterviewTypeDialogProps) => {
  const { settings } = useSystemSettings();
  const isVapi = settings.interview_engine === "vapi";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">اختر نوع المقابلة</DialogTitle>
          <DialogDescription className="text-center">
            {vacancyTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 mt-2">
          {interviewTypes.map((item) => (
            <button
              key={item.type}
              onClick={() => onSelect(item.type)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-right w-full",
                item.bg
              )}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                <item.icon className={cn("w-6 h-6", item.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  {isVapi && item.supportsVapi && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
                      مباشر
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isVapi && item.supportsVapi
                    ? "محادثة مباشرة ثنائية الاتجاه مع المحاور الآلي"
                    : item.description}
                </p>
                {item.warning && (
                  <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {item.warning}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewTypeDialog;
