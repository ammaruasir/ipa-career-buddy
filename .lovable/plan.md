## AI integration & wiring audit (post-merge)

### Edge functions added by the merge

| Function | AI provider | Model | Called from |
|---|---|---|---|
| `coach-response` | Lovable AI Gateway (fallback: OpenAI) | `gemini-2.5-flash` / `gpt-4.1-mini` | `CoachingSection.tsx` ✅ |
| `chat-with-cv` | Lovable AI Gateway (fallback: OpenAI) | `gemini-2.5-flash` / `gpt-4.1-mini` | `CVChatPanel.tsx` ✅ |
| `cv-interview-step` | Lovable AI Gateway (fallback: OpenAI) | `gemini-2.5-flash` / `gpt-4.1-mini` | `CVInterview.tsx` ✅ |
| `generate-cv-bullets` | Lovable AI Gateway (fallback: OpenAI) | `gemini-2.5-flash` / `gpt-4.1-mini` | `AIAssistButton.tsx` ✅ |
| `improve-cv-summary` | Lovable AI Gateway (fallback: OpenAI) | `gemini-2.5-flash` / `gpt-4.1-mini` | `CVInterview.tsx` ✅ |
| `suggest-cv-skills` | Lovable AI Gateway (fallback: OpenAI) | `gemini-2.5-flash` / `gpt-4.1-mini` | **Not called from anywhere** ⚠️ |

### Verdict

The wiring is solid overall:

- **Secrets**: `LOVABLE_API_KEY` and `OPENAI_API_KEY` are both already set in the project — no missing keys.
- **Provider pattern**: Every new function prefers Lovable AI Gateway and falls back to OpenAI automatically. Consistent and safe.
- **Models**: All use `google/gemini-2.5-flash` (a supported gateway model) — good cost/latency balance for CV/coaching tasks.
- **Client wiring**: 5 of 6 functions are correctly invoked via `supabase.functions.invoke(...)` in the matching React components.
- **CORS / auth**: Functions use the standard `_shared/guards.ts` pattern from the existing codebase.

### Issues to address

1. **`suggest-cv-skills` is orphaned** — deployed but no component calls it. Either:
   - Wire it into the `CVBuilder` skills step as a "Suggest skills with AI" button, **or**
   - Remove it to avoid dead code.

2. **`gpt-4.1-mini` fallback model** — `gpt-4.1-mini` is fine on the OpenAI direct API, but if `LOVABLE_API_KEY` is ever removed the fallback would activate; worth knowing it sends data through OpenAI directly rather than the gateway. Today it never triggers because `LOVABLE_API_KEY` is present.

3. **Model choice for `coach-response`** — coaching is the longest-context call (full transcript + STAR evaluation). Consider upgrading to `google/gemini-2.5-pro` if you see truncated or shallow coaching output. No action required today; flagging for tuning.

### Optional cleanup

- Add `[functions.coach-response]` (and the 5 others) blocks to `supabase/config.toml` only if you want explicit `verify_jwt` overrides. They currently deploy with the Lovable default (`verify_jwt = false` + in-code JWT validation), which matches the rest of the project.

### Recommended next step

Wire `suggest-cv-skills` into `CVBuilder` as an "AI suggest skills" button on the skills step (matches the existing `AIAssistButton` pattern). Want me to do that?
