// Hook: fetch the user's profile + auth email and return a CV-ready prefill object.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PrefillEducation {
  degree?: string;
  major?: string;
  institution?: string;
  gpa?: string;
}

export interface PrefillData {
  personal_info: {
    full_name?: string;
    email?: string;
    phone?: string;
    city?: string;
    nationality?: string;
  };
  education: PrefillEducation[];
  experience_years?: number;
  major?: string;
  loaded: boolean;
}

const EMPTY: PrefillData = {
  personal_info: {},
  education: [],
  loaded: false,
};

export const useProfilePrefill = () => {
  const { user } = useAuth();
  const [prefill, setPrefill] = useState<PrefillData>(EMPTY);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, city, nationality, major, education_level, gpa, experience_years")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const p = (data ?? {}) as any;

      const education: PrefillEducation[] = [];
      if (p.major || p.education_level) {
        education.push({
          degree: p.education_level || undefined,
          major: p.major || undefined,
          gpa: p.gpa || undefined,
        });
      }

      setPrefill({
        personal_info: {
          full_name: p.full_name || undefined,
          email: user.email || undefined,
          phone: p.phone || undefined,
          city: p.city || undefined,
          nationality: p.nationality || undefined,
        },
        education,
        experience_years: typeof p.experience_years === "number" ? p.experience_years : undefined,
        major: p.major || undefined,
        loaded: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return prefill;
};
