import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AcceptedRewrite } from "@/lib/cv-export";

export interface CvRevision {
  id: string;
  user_id: string;
  cv_document_id: string | null;
  content: Record<string, unknown>;
  accepted_rewrites: AcceptedRewrite[];
}

export const useCvRevision = (userId: string | undefined, cvDocumentId: string | undefined) => {
  const [revision, setRevision] = useState<CvRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !cvDocumentId) return;
    setLoading(true);
    const { data } = await supabase
      .from("cv_revisions" as any)
      .select("id, user_id, cv_document_id, content, accepted_rewrites")
      .eq("user_id", userId)
      .eq("cv_document_id", cvDocumentId)
      .maybeSingle();
    setRevision((data as unknown as CvRevision) ?? null);
    setLoading(false);
  }, [userId, cvDocumentId]);

  useEffect(() => {
    load();
  }, [load]);

  const upsert = useCallback(
    async (next: { accepted_rewrites?: AcceptedRewrite[]; content?: Record<string, unknown> }) => {
      if (!userId || !cvDocumentId) return null;
      setSaving(true);
      const payload = {
        user_id: userId,
        cv_document_id: cvDocumentId,
        accepted_rewrites: next.accepted_rewrites ?? revision?.accepted_rewrites ?? [],
        content: next.content ?? revision?.content ?? {},
      };
      let result: CvRevision | null = null;
      if (revision?.id) {
        const { data } = await supabase
          .from("cv_revisions" as any)
          .update(payload)
          .eq("id", revision.id)
          .select("id, user_id, cv_document_id, content, accepted_rewrites")
          .maybeSingle();
        result = (data as unknown as CvRevision) ?? null;
      } else {
        const { data } = await supabase
          .from("cv_revisions" as any)
          .insert(payload)
          .select("id, user_id, cv_document_id, content, accepted_rewrites")
          .maybeSingle();
        result = (data as unknown as CvRevision) ?? null;
      }
      if (result) setRevision(result);
      setSaving(false);
      return result;
    },
    [userId, cvDocumentId, revision],
  );

  const acceptRewrite = useCallback(
    async (original: string, improved: string) => {
      const list = revision?.accepted_rewrites ?? [];
      const next = list.filter((r) => r.original !== original);
      next.push({ original, improved });
      return upsert({ accepted_rewrites: next });
    },
    [revision, upsert],
  );

  const rejectRewrite = useCallback(
    async (original: string) => {
      const list = revision?.accepted_rewrites ?? [];
      const next = list.filter((r) => r.original !== original);
      return upsert({ accepted_rewrites: next });
    },
    [revision, upsert],
  );

  return { revision, loading, saving, acceptRewrite, rejectRewrite, upsert, reload: load };
};
