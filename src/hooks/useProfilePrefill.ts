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

export interface PrefillCertification {
  name?: string;
  issuer?: string;
  date?: string;
  link?: string;
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
  certifications: PrefillCertification[];
  experience_years?: number;
  major?: string;
  loaded: boolean;
}

const EMPTY: PrefillData = {
  personal_info: {},
  education: [],
  certifications: [],
  loaded: false,
};

export const useProfilePrefill = () => {
  const { user } = useAuth();
  const [prefill, setPrefill] = useState<PrefillData>(EMPTY);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [profileRes, cvDocRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, city, nationality, major, education_level, gpa, experience_years")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("cv_documents" as any)
          .select("extraction")
          .eq("user_id", user.id)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      const p = (profileRes.data ?? {}) as any;
      const cvDoc = (cvDocRes.data ?? {}) as any;

      const education: PrefillEducation[] = [];
      if (p.major || p.education_level) {
        education.push({
          degree: p.education_level || undefined,
          major: p.major || undefined,
          gpa: p.gpa || undefined,
        });
      }

      // Extract certifications from the latest analyzed resume (if any).
      // analyze-resume stores extraction.certifications as string[].
      const rawCerts = Array.isArray(cvDoc?.extraction?.certifications)
        ? cvDoc.extraction.certifications
        : [];
      const certifications: PrefillCertification[] = rawCerts
        .map((c: any) => {
          if (typeof c === "string") return { name: c };
          if (c && typeof c === "object") {
            return { name: c.name, issuer: c.issuer, date: c.date, link: c.link };
          }
          return null;
        })
        .filter(Boolean) as PrefillCertification[];

      setPrefill({
        personal_info: {
          full_name: p.full_name || undefined,
          email: user.email || undefined,
          phone: p.phone || undefined,
          city: p.city || undefined,
          nationality: p.nationality || undefined,
        },
        education,
        certifications,
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
