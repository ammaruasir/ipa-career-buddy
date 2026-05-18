import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, Mic, Video, Sparkles, Target,
  TrendingUp, AlertCircle,
} from "lucide-react";
import { toArabicNumerals, formatArabicPercent } from "@/lib/arabic-utils";

const typeMap = {
  text: { label: "نصية", icon: MessageSquare },
  voice: { label: "صوتية", icon: Mic },
  video: { label: "فيديو", icon: Video },
} as const;

interface TrainingSectionProps {
  interviews: any[];
  evaluations: any[];
}

const TrainingSection = ({ interviews, evaluations }: TrainingSectionProps) => {
  // Calculate training stats from all interviews (practice or not)
  const completedInterviews = interviews.filter(i => i.status === "completed");
  
  const typeStats = (["text", "voice", "video"] as const).map(type => {
    const typeInterviews = completedInterviews.filter(i => i.type === type);
    const typeEvals = evaluations.filter(e => 
      typeInterviews.some(i => i.id === e.interview_id)
    );
    const avgScore = typeEvals.length > 0 
      ? Math.round(typeEvals.reduce((s, e) => s + (e.overall_score || 0), 0) / typeEvals.length) 
      : 0;
    return { type, count: typeInterviews.length, avgScore, evals: typeEvals };
  });

  const totalCompleted = completedInterviews.length;
  const overallAvg = evaluations.length > 0 
    ? Math.round(evaluations.reduce((s, e) => s + (e.overall_score || 0), 0) / evaluations.length)
    : 0;

  // Find weakest area
  const weakestType = typeStats
    .filter(t => t.count > 0)
    .sort((a, b) => a.avgScore - b.avgScore)[0];

  // Find weakest skill category
  const avgComm = evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.communication_score || 0), 0) / evaluations.length) : 0;
  const avgTech = evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.technical_score || 0), 0) / evaluations.length) : 0;
  const avgCulture = evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + (e.personality_match || 0), 0) / evaluations.length) : 0;

  const skillCategories = [
    { name: "التواصل", score: avgComm },
    { name: "المهارات التقنية", score: avgTech },
    { name: "التوافق الثقافي", score: avgCulture },
  ].filter(c => c.score > 0);

  const weakestSkill = skillCategories.sort((a, b) => a.score - b.score)[0];

  // Weekly goal: 3 interviews per week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeekCount = completedInterviews.filter(i => new Date(i.created_at) >= weekAgo).length;
  const weeklyGoal = 3;
  const weeklyProgress = Math.min((thisWeekCount / weeklyGoal) * 100, 100);

  return (
    <Card className="rounded-2xl shadow-lg border-dashed border-2 border-secondary/40">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-secondary" />
          <div>
            <p className="font-bold text-foreground">وضع التدريب — آمن للفشل</p>
            <p className="text-sm text-muted-foreground">
              لا أحد من فريق HR يرى جلستك. تخطئ، تتعلّم، تكرّر. كل جلسة تنتهي بتغذية STAR تشرح "لماذا".
            </p>
          </div>
        </div>

        {/* Training Stats */}
        {totalCompleted > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {typeStats.map(({ type, count, avgScore }) => {
              const { label, icon: Icon } = typeMap[type];
              return (
                <div key={type} className="bg-muted/50 rounded-xl p-3 text-center">
                  <Icon className="w-5 h-5 mx-auto mb-1 text-secondary" />
                  <p className="text-lg font-bold text-foreground">{toArabicNumerals(count)}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {count > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      متوسط: {formatArabicPercent(avgScore)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Weekly Goal */}
        {totalCompleted > 0 && (
          <div className="bg-muted/30 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                <Target className="w-4 h-4 text-primary" />
                هدف الأسبوع: {toArabicNumerals(weeklyGoal)} مقابلات
              </span>
              <span className="text-sm text-muted-foreground">
                {toArabicNumerals(thisWeekCount)}/{toArabicNumerals(weeklyGoal)}
              </span>
            </div>
            <Progress value={weeklyProgress} className="h-2" />
          </div>
        )}

        {/* Smart Recommendation */}
        {weakestType && weakestType.avgScore < 80 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">توصية ذكية</p>
              <p className="text-muted-foreground">
                أداؤك في المقابلات {typeMap[weakestType.type as keyof typeof typeMap]?.label} هو الأقل ({formatArabicPercent(weakestType.avgScore)}). 
                ننصحك بالتدرب أكثر عليها.
              </p>
            </div>
          </div>
        )}

        {/* Weakest Skill Tip */}
        {weakestSkill && weakestSkill.score < 70 && (
          <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">نصيحة تدريبية</p>
              <p className="text-muted-foreground">
                مهارة "{weakestSkill.name}" تحتاج تحسين (متوسط: {formatArabicPercent(weakestSkill.score)}). 
                ركّز على تحسينها في مقابلاتك القادمة.
              </p>
            </div>
          </div>
        )}

        {/* Practice Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["text", "voice", "video"] as const).map((t) => {
            const { label, icon: Icon } = typeMap[t];
            return (
              <Button key={t} variant="outline" className="rounded-2xl h-auto py-5 flex flex-col gap-2 hover:border-secondary/50 transition-all" asChild>
                <Link to={`/interview/${t}?practice=true`}>
                  <Icon className="w-7 h-7 text-secondary" />
                  <span className="text-base font-semibold">تدريب {label}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrainingSection;
