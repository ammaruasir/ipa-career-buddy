import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Play, Mic } from "lucide-react";
import { useTourEngine } from "@/contexts/DemoTourContext";

const Demo = () => {
  const { status, start, micConsent, setMicConsent, stepIndex, isSpeaking } = useTourEngine();

  useEffect(() => {
    document.title = "جولة AI تفاعلية — منصّة IPA";
  }, []);

  const launching = status === "running" || status === "paused" || status === "qna";
  const preparing = status === "running" && stepIndex === 0 && !isSpeaking;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8" dir="rtl">
      <Card className="max-w-xl w-full rounded-3xl shadow-2xl border-2 border-primary/15 p-6 sm:p-8 space-y-5 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
            جولة AI تفاعلية في المنصّة
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تعرّف على منصّة IPA كاملة في جولة موجَّهة بالذكاء الاصطناعي — تشرح، تتنقّل،
            وتجيب على أسئلتك مباشرةً. تقدر تقاطع الجولة في أي وقت.
          </p>
        </div>

        <label className="flex items-start gap-3 text-right p-3 rounded-xl bg-muted/40 border border-border cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary w-4 h-4 shrink-0"
            checked={micConsent}
            onChange={(e) => setMicConsent(e.target.checked)}
          />
          <span className="flex-1 text-xs leading-relaxed">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              السماح باستخدام الميكروفون للأسئلة (اختياري)
            </span>
            <span className="block text-muted-foreground mt-1">
              تقدر تطرح أسئلتك بصوتك. بدون موافقة، تكتب أسئلتك في مربّع نصّي عادي.
              الصوت يُرسَل لمزوّد خدمة تحويل الصوت إلى نص ويُحذف فور المعالجة.
            </span>
          </span>
        </label>

        <Button
          size="lg"
          className="rounded-2xl text-base px-8 py-6 shadow-lg hover:shadow-xl gap-2 w-full sm:w-auto"
          onClick={start}
          disabled={launching}
        >
          <Play className="w-5 h-5" />
          {preparing ? "جاري تجهيز الصوت…" : launching ? "الجولة قيد التشغيل…" : "ابدأ الجولة"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          الجولة تعمل بصوت عربي خليجي. تأكّد من تشغيل صوت جهازك.
        </p>

      </Card>
    </div>
  );
};

export default Demo;
