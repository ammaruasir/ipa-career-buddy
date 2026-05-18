import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ChunkReadyEvent {
  index: number;
  path: string;
  duration_ms: number;
  size_bytes: number;
}

export interface AdminMessageEvent {
  text: string;
  from_name: string;
  at: string;
}

export interface ForceEndEvent {
  reason: string;
  by_name: string;
  at: string;
}

interface UseProctorChannelOptions {
  interviewId: string | null;
  userId: string | null;
  enabled: boolean;
  role?: "trainee" | "admin" | "hr" | "instructor";
  onAdminMessage?: (event: AdminMessageEvent) => void;
  onForceEnd?: (event: ForceEndEvent) => void;
  onPresenceChange?: (proctors: { role: string; name?: string }[]) => void;
  onChunkReady?: (event: ChunkReadyEvent) => void;
}

/**
 * Trainee-side and viewer-side Realtime channel for live proctoring.
 *
 * - Trainee: joins as presence role 'trainee', publishes chunk-ready events,
 *   receives admin-message and force-end broadcasts.
 * - Admin/HR/Instructor viewer: joins as their role, receives chunk-ready
 *   events to feed into MSE, can broadcast admin-message / flag / force-end.
 *
 * The same channel is used for both sides — `role` distinguishes them in
 * presence state.
 */
export const useProctorChannel = ({
  interviewId,
  userId,
  enabled,
  role = "trainee",
  onAdminMessage,
  onForceEnd,
  onPresenceChange,
  onChunkReady,
}: UseProctorChannelOptions) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onAdminMessageRef = useRef(onAdminMessage);
  const onForceEndRef = useRef(onForceEnd);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onChunkReadyRef = useRef(onChunkReady);

  useEffect(() => { onAdminMessageRef.current = onAdminMessage; }, [onAdminMessage]);
  useEffect(() => { onForceEndRef.current = onForceEnd; }, [onForceEnd]);
  useEffect(() => { onPresenceChangeRef.current = onPresenceChange; }, [onPresenceChange]);
  useEffect(() => { onChunkReadyRef.current = onChunkReady; }, [onChunkReady]);

  useEffect(() => {
    if (!enabled || !interviewId || !userId) return;

    const channel = supabase.channel(`proctor-${interviewId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("broadcast", { event: "admin-message" }, ({ payload }) => {
        onAdminMessageRef.current?.(payload as AdminMessageEvent);
      })
      .on("broadcast", { event: "force-end" }, ({ payload }) => {
        onForceEndRef.current?.(payload as ForceEndEvent);
      })
      .on("broadcast", { event: "chunk-ready" }, ({ payload }) => {
        onChunkReadyRef.current?.(payload as ChunkReadyEvent);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const proctors: { role: string; name?: string }[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences as Array<{ role?: string; name?: string }>) {
            if (p?.role && p.role !== "trainee") {
              proctors.push({ role: p.role, name: p.name });
            }
          }
        }
        onPresenceChangeRef.current?.(proctors);
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ role, user_id: userId, joined_at: new Date().toISOString() });
      }
    });

    channelRef.current = channel;

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, interviewId, userId, role]);

  const broadcastChunkReady = useCallback(async (event: ChunkReadyEvent) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: "broadcast", event: "chunk-ready", payload: event });
  }, []);

  const broadcastAdminMessage = useCallback(async (text: string, fromName: string) => {
    if (!channelRef.current) return;
    const payload: AdminMessageEvent = { text, from_name: fromName, at: new Date().toISOString() };
    await channelRef.current.send({ type: "broadcast", event: "admin-message", payload });
  }, []);

  const broadcastForceEnd = useCallback(async (reason: string, byName: string) => {
    if (!channelRef.current) return;
    const payload: ForceEndEvent = { reason, by_name: byName, at: new Date().toISOString() };
    await channelRef.current.send({ type: "broadcast", event: "force-end", payload });
  }, []);

  return { broadcastChunkReady, broadcastAdminMessage, broadcastForceEnd };
};
