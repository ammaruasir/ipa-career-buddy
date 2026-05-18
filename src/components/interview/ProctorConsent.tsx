import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProctorConsentProps {
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Pre-interview consent banner. Persists acceptance into the existing
 * user_consents table with consent_type 'recording_storage' (which already
 * covers storing interview recordings and disclosing them to authorized
 * staff). Once accepted, this banner does not show again for the user.
 */
const ProctorConsent = ({ onAccept, onDecline }: ProctorConsentProps) => {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_consents")
        .select("granted")
        .eq("user_id", user.id)
        .eq("consent_type", "recording_storage")
        .eq("granted", true)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.granted) {
        onAccept();
      } else {
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, onAccept]);

  const handleAccept = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("user_consents").insert({
        user_id: user.id,
        consent_type: "recording_storage",
        granted: true,
      } as any);
      if (error) throw error;
      onAccept();
    } catch (e) {
      console.error("Consent insert failed:", e);
      toast.error("تعذّر حفظ الموافقة، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="rounded-2xl shadow-xl max-w-lg w-full">
        <CardHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-lg">إشعار وموافقة على التسجيل والمراقبة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>سيتم تسجيل صوتك وصورتك خلال هذه المقابلة وتخزينها بشكل آمن.</span>
            </li>
            <li className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>قد يقوم المسؤولون أو فريق الموارد البشرية أو المدرّبون بمتابعة الجلسة مباشرة لضمان النزاهة.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>يستخدم التسجيل لأغراض التقييم والتدريب فقط، ولن يُشارك مع أطراف غير مصرّح لها.</span>
            </li>
          </ul>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAccept} disabled={submitting} className="rounded-xl flex-1 gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              أوافق وأبدأ المقابلة
            </Button>
            <Button onClick={onDecline} variant="outline" className="rounded-xl flex-1">
              لا أوافق
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProctorConsent;
