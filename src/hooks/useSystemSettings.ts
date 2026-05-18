import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InterviewerVoice {
  name: string;
  gender: "male" | "female";
  voice_id: string;
  avatar_url: string;
}

export interface SystemSettings {
  id: string;
  scoring_weights: { technical: number; communication: number; cultural_fit: number; [key: string]: number };
  questions_per_type: { text: number; voice: number; video: number };
  time_per_question: { text: number; voice: number; video: number };
  job_positions: string[];
  ai_model: string;
  maintenance_mode: boolean;
  brand_color: string;
  evaluation_thresholds: { highly_recommended: number; recommended: number };
  filler_words: string[];
  /**
   * Historical engine toggle. The only engine implemented is the built-in
   * one (Wakeb AI Engine: chat + TTS). The DB column is retained for
   * backward compatibility but no code path branches on it anymore.
   */
  interview_engine: "built_in";
  interviewer_voice: InterviewerVoice;
}

const DEFAULT_SETTINGS: SystemSettings = {
  id: "",
  scoring_weights: { technical: 40, communication: 30, cultural_fit: 30 },
  questions_per_type: { text: 8, voice: 5, video: 5 },
  time_per_question: { text: 0, voice: 300, video: 300 },
  job_positions: ["محلل أعمال", "أخصائي موارد بشرية", "مدير مشاريع", "مطور برمجيات", "محاسب", "أخصائي تسويق"],
  ai_model: "wakeb-default",
  maintenance_mode: false,
  brand_color: "#006C35",
  evaluation_thresholds: { highly_recommended: 80, recommended: 60 },
  filler_words: ["ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة", "الله يعطيك العافية"],
  interview_engine: "built_in",
  interviewer_voice: { name: "نورة", gender: "female", voice_id: "QsV9PCczMIklRM6xLPAS", avatar_url: "" },
};

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("*")
      .limit(1)
      .single();
    if (data) {
      setSettings({
        id: data.id,
        scoring_weights: data.scoring_weights as any,
        questions_per_type: data.questions_per_type as any,
        time_per_question: data.time_per_question as any,
        job_positions: data.job_positions as any,
        ai_model: data.ai_model,
        maintenance_mode: data.maintenance_mode,
        brand_color: data.brand_color,
        evaluation_thresholds: data.evaluation_thresholds as any,
        filler_words: data.filler_words as any,
        interview_engine: "built_in",
        interviewer_voice: (data as any).interviewer_voice || DEFAULT_SETTINGS.interviewer_voice,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (updates: Partial<SystemSettings>) => {
    if (!settings.id) return;
    const { error } = await supabase
      .from("system_settings")
      .update(updates as any)
      .eq("id", settings.id);
    if (!error) {
      setSettings((prev) => ({ ...prev, ...updates }));
    }
    return { error };
  };

  return { settings, loading, updateSettings, refetch: fetchSettings };
};
