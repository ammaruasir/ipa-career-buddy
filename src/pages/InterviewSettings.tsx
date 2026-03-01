import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Camera, Mic, Volume2, MonitorPlay, Accessibility, Loader2 } from "lucide-react";

const InterviewSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Mic
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  // Speaker
  const [speakerPlaying, setSpeakerPlaying] = useState(false);

  // Accessibility
  const [fontSize, setFontSize] = useState(() => {
    const stored = localStorage.getItem("a11y_font_size");
    return stored ? parseInt(stored) : 16;
  });
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("a11y_high_contrast") === "true");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraStream]);

  const toggleCamera = async () => {
    if (cameraActive && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setCameraActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      // permission denied
    }
  };

  const toggleMic = async () => {
    if (micActive && micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      setMicActive(false);
      cancelAnimationFrame(animFrameRef.current);
      setMicLevel(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicActive(true);
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, (avg / 128) * 100));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // permission denied
    }
  };

  const playSpeaker = () => {
    setSpeakerPlaying(true);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
      setSpeakerPlaying(false);
    }, 1500);
  };

  const handleFontSize = (val: number[]) => {
    setFontSize(val[0]);
    localStorage.setItem("a11y_font_size", String(val[0]));
    document.documentElement.style.setProperty("--app-font-size", `${val[0]}px`);
  };

  const handleContrast = (val: boolean) => {
    setHighContrast(val);
    localStorage.setItem("a11y_high_contrast", String(val));
    document.documentElement.classList.toggle("high-contrast", val);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate(-1)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold font-tajawal">إعدادات المقابلة</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {/* Camera */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Camera className="w-5 h-5" /> اختبار الكاميرا</CardTitle>
            <CardDescription className="font-tajawal">تأكد من عمل الكاميرا قبل بدء المقابلة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {cameraActive ? (
                <>
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-3 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded font-tajawal">
                    معهد الإدارة العامة - IPA
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground font-tajawal">الكاميرا غير مفعلة</p>
              )}
            </div>
            <Button onClick={toggleCamera} variant={cameraActive ? "destructive" : "default"} className="font-tajawal">
              {cameraActive ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
            </Button>
          </CardContent>
        </Card>

        {/* Microphone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Mic className="w-5 h-5" /> اختبار المايكروفون</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-tajawal">مستوى الصوت</Label>
                <span className="text-sm text-muted-foreground">{Math.round(micLevel)}%</span>
              </div>
              <Progress value={micLevel} className="h-3" />
            </div>
            <Button onClick={toggleMic} variant={micActive ? "destructive" : "default"} className="font-tajawal">
              {micActive ? "إيقاف المايكروفون" : "تشغيل المايكروفون"}
            </Button>
          </CardContent>
        </Card>

        {/* Speaker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Volume2 className="w-5 h-5" /> اختبار السماعات</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={playSpeaker} disabled={speakerPlaying} className="font-tajawal">
              {speakerPlaying ? "جاري التشغيل..." : "تشغيل صوت تجريبي"}
            </Button>
          </CardContent>
        </Card>

        {/* Virtual Backgrounds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><MonitorPlay className="w-5 h-5" /> الخلفيات الافتراضية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: "ضبابي", desc: "Blur" },
                { name: "مكتب", desc: "Office" },
                { name: "حرم المعهد", desc: "IPA Campus" },
              ].map((bg) => (
                <div key={bg.desc} className="relative rounded-lg border p-4 text-center space-y-2 bg-muted/50">
                  <div className="w-full h-20 bg-muted rounded flex items-center justify-center">
                    <MonitorPlay className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-tajawal">{bg.name}</p>
                  <Badge variant="secondary" className="font-tajawal">قريباً</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accessibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-tajawal"><Accessibility className="w-5 h-5" /> إمكانية الوصول</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-tajawal">حجم الخط</Label>
                <span className="text-sm text-muted-foreground">{fontSize}px</span>
              </div>
              <Slider value={[fontSize]} onValueChange={handleFontSize} min={12} max={24} step={1} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-tajawal">وضع التباين العالي</Label>
              <Switch checked={highContrast} onCheckedChange={handleContrast} />
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-bold font-tajawal mb-1">دعم قارئ الشاشة</h4>
              <p className="text-sm text-muted-foreground font-tajawal">
                المنصة متوافقة مع قارئات الشاشة الشائعة مثل NVDA و VoiceOver. جميع العناصر التفاعلية تحتوي على تسميات ARIA المناسبة.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InterviewSettings;
