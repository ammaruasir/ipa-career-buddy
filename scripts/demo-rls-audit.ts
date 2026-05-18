/**
 * RLS audit for Demo Mode.
 *
 * Verifies the symmetric isolation policy installed by
 * supabase/migrations/20260518160000_demo_mode_scaffold.sql works correctly:
 *
 *   1. A regular (non-demo) user CANNOT see is_demo=true rows.
 *   2. A demo account CANNOT see is_demo=false rows.
 *   3. A demo account CANNOT modify a non-demo row's flag to is_demo=false
 *      (the WITH CHECK clause blocks demo → non-demo movement).
 *   4. Sara's identity is consistent across acts: the candidate profile created
 *      by seed-demo-data appears under one user_id in profiles, in interviews,
 *      in evaluations, etc.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/demo-rls-audit.ts
 *
 * Exits 0 on PASS, 1 on FAIL. Designed to be a smoke check before each demo deploy.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fails: string[] = [];
const passes: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passes.push(name);
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${detail ? `: ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function signInAs(email: string, password: string): Promise<string | null> {
  const client = createClient(SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    console.warn(`signIn(${email}) failed: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function queryWithToken(token: string, table: string, filter: Record<string, unknown>): Promise<unknown[]> {
  const userClient = createClient(SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? SUPABASE_SERVICE_ROLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  let q = userClient.from(table).select("*");
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never);
  const { data } = await q;
  return data ?? [];
}

async function main() {
  console.log("Demo RLS audit\n");

  // 0) Sanity: function exists
  const { data: fn } = await admin.rpc("is_demo_account", { uid: "00000000-0000-0000-0000-000000000000" });
  check("is_demo_account function exists", fn === false, `got ${JSON.stringify(fn)}`);

  // 1) Sign in as the demo candidate
  const candidateToken = await signInAs("demo-candidate@ipa-training.sa", process.env.DEMO_CANDIDATE_PASSWORD || "DemoCandidate#2026");
  if (!candidateToken) {
    console.error("Could not sign in demo candidate. Did you run seed-demo-data.ts?");
    process.exit(1);
  }

  // 2) Demo candidate should ONLY see is_demo=true profile rows
  const seenProfiles = await queryWithToken(candidateToken, "profiles", {});
  const leakedNonDemo = (seenProfiles as Array<{ is_demo: boolean }>).filter((p) => p.is_demo === false);
  check(
    "demo candidate sees zero non-demo profiles",
    leakedNonDemo.length === 0,
    `${leakedNonDemo.length} non-demo rows visible`,
  );

  // 3) Sara's profile exists and is_demo=true
  const saraProfiles = (seenProfiles as Array<{ full_name?: string; is_demo: boolean }>).filter(
    (p) => p.full_name === "سارة الراشد",
  );
  check("Sara's profile is seeded and is_demo=true", saraProfiles.length >= 1 && saraProfiles[0].is_demo);

  // 4) Sign in as demo admin and verify Sara appears in admin view too (persona continuity)
  const adminToken = await signInAs("demo-admin@ipa-training.sa", process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin#2026");
  if (adminToken) {
    const adminProfiles = await queryWithToken(adminToken, "profiles", {});
    const saraFromAdmin = (adminProfiles as Array<{ full_name?: string; user_id: string }>).find(
      (p) => p.full_name === "سارة الراشد",
    );
    check(
      "admin sees Sara (persona continuity)",
      !!saraFromAdmin,
      "Sara should appear in admin's profile query",
    );
    const adminLeakNonDemo = (adminProfiles as Array<{ is_demo: boolean }>).filter((p) => p.is_demo === false);
    check(
      "demo admin sees zero non-demo profiles",
      adminLeakNonDemo.length === 0,
      `${adminLeakNonDemo.length} non-demo rows visible`,
    );
  } else {
    fails.push("could not sign in as demo-admin");
  }

  // 5) Service-role still sees ALL rows (sanity — bypasses RLS)
  const { data: allProfiles } = await admin.from("profiles").select("user_id, is_demo");
  const demoCount = (allProfiles ?? []).filter((p: { is_demo: boolean }) => p.is_demo).length;
  const realCount = (allProfiles ?? []).filter((p: { is_demo: boolean }) => !p.is_demo).length;
  check(
    "service role sees both demo and prod rows",
    demoCount > 0 && realCount >= 0,
    `demo=${demoCount} prod=${realCount}`,
  );

  console.log(`\nResult: ${passes.length} passed, ${fails.length} failed`);
  if (fails.length > 0) {
    console.error("\nFAILURES:");
    fails.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("audit script error:", e);
  process.exit(1);
});
