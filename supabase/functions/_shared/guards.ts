// =============================================================================
// Shared guards for IPA edge functions.
//
// IMPORTANT: This file lives at supabase/functions/_shared/guards.ts.
// Supabase Edge Functions deployment SKIPS any directory whose name starts
// with "_" — so `_shared/` is NOT deployed as a function. It's only included
// as a dependency when other functions import from it via relative path.
// See: https://supabase.com/docs/guides/functions/auth#shared-modules
//
// Adding a new shared utility here means every function that imports it
// gets the update on next redeploy. Keep this module dependency-free except
// for Supabase + Deno stdlib.
// =============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Check rate limit via Postgres function. Returns { allowed, retry_after_seconds }.
 * Caller should return 429 with Retry-After header if not allowed.
 */
export async function checkRateLimit(
  _supabase: SupabaseClient,
  _userId: string,
  _scope: string,
  _max: number,
  _windowSeconds: number,
): Promise<{ allowed: boolean; current: number; retryAfter: number }> {
  // Rate limiting disabled — always allow.
  return { allowed: true, current: 0, retryAfter: 0 };
}


/**
 * Build a 429 Response with Retry-After header. Bilingual error message.
 */
export function rateLimitResponse(retryAfter: number, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded / تجاوزت الحدّ المسموح",
      retry_after_seconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

/**
 * Check user consent for a specific data-handling action.
 * Returns true if granted (or if consent type doesn't apply yet — soft default).
 */
export async function hasConsent(
  supabase: SupabaseClient,
  userId: string,
  consentType: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_active_consent", {
    p_user_id: userId,
    p_consent_type: consentType,
  });
  if (error) {
    console.warn(`Consent check failed for ${consentType}:`, error);
    return false;
  }
  return Boolean(data);
}

export function consentRequiredResponse(
  consentType: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "Consent required / تتطلّب موافقة",
      consent_type: consentType,
      action_hint: `Grant consent for "${consentType}" in settings to proceed.`,
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

/**
 * Standard handler for Wakeb AI Engine upstream error responses.
 * Returns a Response if the status maps to a user-facing message; null if caller should continue.
 *   402 → "اشحن رصيد Lovable" (matches analyze-resume convention)
 *   429 → "تجاوزت الحدّ" (rate-limited by provider, not us)
 *
 * Intended use:
 *   const errResp = handleAiGatewayError(aiResp, corsHeaders);
 *   if (errResp) return errResp;
 *   const data = await aiResp.json();
 */
export function handleAiGatewayError(
  resp: Response,
  corsHeaders: Record<string, string>,
): Response | null {
  if (resp.status === 402) {
    return new Response(
      JSON.stringify({
        error: "يرجى شحن رصيد محرك واكب للذكاء الاصطناعي / Wakeb AI Engine credit exhausted",
      }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (resp.status === 429) {
    return new Response(
      JSON.stringify({
        error: "تم تجاوز الحدّ المسموح / Rate limit exceeded — retry shortly",
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

/**
 * Fetch with retry-on-429 (exponential backoff).
 * Returns the final Response. Caller decides what to do with non-429 errors.
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    if (attempt === maxAttempts) return res; // exhausted; let caller handle

    const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
    console.warn(`429 from ${url} attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }
  // unreachable
  throw new Error("fetchWithBackoff: loop exited unexpectedly");
}

/**
 * Parse a tool-call arguments JSON safely.
 * Returns null on parse failure instead of throwing — caller decides if it's fatal.
 */
export function safeParseJson<T = unknown>(text: string | undefined | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn("safeParseJson failed:", e, "input head:", text.slice(0, 200));
    return null;
  }
}

/**
 * Build supabase admin client (service role).
 */
export function getAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Resolve authenticated user from Authorization header.
 * Returns null if missing/invalid; caller decides whether to 401.
 */
export async function getAuthUser(
  authHeader: string | null,
): Promise<{ id: string; email: string | null } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  // Use anon client with user's JWT
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
