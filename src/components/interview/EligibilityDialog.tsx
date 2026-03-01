import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityResult {
  eligible: boolean;
  match_percentage: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
}

interface EligibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  result: EligibilityResult | null;
  noResume: boolean;
  onProceed: () => void;
  onGoToProfile: () => void;
  vacancyTitle: string;
}

const EligibilityDialog = ({
  open, onOpenChange, loading, result, noResume, onProceed, onGoToProfile, vacancyTitle,
}: EligibilityDialogProps) => {
  const getStatusColor = (pct: number) => {
    if (pct >= 70) return "text-success";
    if (pct >= 40) return "text-warning";
    return "text-destructive";
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 70) return "[&>div]:bg-success";
    if (pct >= 40) return "[&>div]:bg-warning";
    return "[&>div]:bg-destructive";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-tajawal text-right">فحص الأهلية</DialogTitle>
          <DialogDescription className="font-tajawal text-right">{vacancyTitle}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="font-tajawal text-muted-foreground">جاري تحليل مطابقة ملفك الشخصي...</p>
          </div>
        )}

        {noResume && !loading && (
          <div className="py-8 text-center space-y-4">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="font-tajawal font-bold">لم يتم رفع السيرة الذاتية</p>
            <p className="font-tajawal text-sm text-muted-foreground">يرجى رفع سيرتك الذاتية في إعدادات الملف الشخصي ليتم تحليل أهليتك</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={onGoToProfile} className="font-tajawal">رفع السيرة الذاتية</Button>
              <Button variant="outline" onClick={onProceed} className="font-tajawal">تقديم بدون سيرة</Button>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-5">
            {/* Match percentage */}
            <div className="text-center space-y-2">
              <div className={cn("text-4xl font-bold", getStatusColor(result.match_percentage))}>
                %{result.match_percentage}
              </div>
              <Progress value={result.match_percentage} className={cn("h-3", getProgressColor(result.match_percentage))} />
              <div className="flex items-center justify-center gap-2">
                {result.match_percentage >= 70 ? (
                  <><CheckCircle2 className="w-5 h-5 text-success" /><span className="font-tajawal text-success font-bold">مؤهل بشكل ممتاز</span></>
                ) : result.match_percentage >= 40 ? (
                  <><AlertTriangle className="w-5 h-5 text-warning" /><span className="font-tajawal text-warning font-bold">مؤهل جزئياً</span></>
                ) : (
                  <><XCircle className="w-5 h-5 text-destructive" /><span className="font-tajawal text-destructive font-bold">غير مؤهل</span></>
                )}
              </div>
            </div>

            {/* Summary */}
            <p className="font-tajawal text-sm text-muted-foreground text-center">{result.summary}</p>

            {/* Matched skills */}
            {result.matched_skills.length > 0 && (
              <div className="space-y-2">
                <p className="font-tajawal text-sm font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-success" /> المهارات المتطابقة
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.matched_skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Missing skills */}
            {result.missing_skills.length > 0 && (
              <div className="space-y-2">
                <p className="font-tajawal text-sm font-bold flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-destructive" /> المهارات الناقصة
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.missing_skills.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs text-destructive">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {result.eligible ? (
                <Button onClick={onProceed} className="w-full font-tajawal">متابعة التقديم</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onProceed} className="flex-1 font-tajawal">تقديم على أي حال</Button>
                  <Button onClick={() => onOpenChange(false)} className="flex-1 font-tajawal">إلغاء</Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EligibilityDialog;
