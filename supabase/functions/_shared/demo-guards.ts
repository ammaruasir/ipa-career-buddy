// Shared helpers used by every demo-* edge function.
//
// Demo functions are auth-free (viewers on /demo may not be logged in) so we
// rate-limit by client IP rather than by user_id. Same RPC under the hood;
// we deterministically convert the IP to a UUID so it slots into the existing
// public.check_rate_limit(p_user_id uuid, ...) signature.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "./guards.ts";

export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0"
  );
}

export async function ipToUuid(ip: string): Promise<string> {
  const data = new TextEncoder().encode("demo-rate-limit-v1:" + ip);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuf).slice(0, 16);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function getAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function enforceIpRateLimit(
  req: Request,
  scope: string,
  max: number,
  windowSeconds: number,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  try {
    const ip = getClientIp(req);
    const fakeUserId = await ipToUuid(ip);
    const admin = getAdminClient();
    const rl = await checkRateLimit(admin, fakeUserId, scope, max, windowSeconds);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);
    return null;
  } catch (e) {
    console.warn(`enforceIpRateLimit(${scope}) failed open:`, e);
    return null;
  }
}
