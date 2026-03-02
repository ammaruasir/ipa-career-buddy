

## Plan: Fix Vapi Arabic + Saudi Avatar

### 1. Generate Saudi Male Avatar
- Create an edge function `generate-avatar` that uses Lovable AI image generation (`google/gemini-3-pro-image-preview`) to generate a professional portrait of a Saudi male wearing traditional national dress (white thobe, red/white shemagh/ghutra with black agal).
- Download the result and replace `src/assets/interviewer-avatar.png`.

### 2. Fix Vapi Arabic Language Issue
The Vapi inline assistant config needs additional language enforcement. Changes to `useVapiInterview.ts`:

- **Add `language` field** at the assistant level (not just transcriber) — Vapi uses this to set the overall conversation language.
- **Add `inputMinCharacters`** to prevent Vapi from cutting off short Arabic utterances.
- **Set `responseDelaySeconds`** to give the model time to formulate Arabic responses.
- **Restructure the voice config** — use `languageCode: "ar-SA"` explicitly in the Azure voice config since Vapi may default to English without it.
- **Strengthen the system prompt** — add explicit instruction in English at the top: `"CRITICAL: You MUST speak ONLY in Arabic (العربية). Never use English under any circumstances."` (mixing English instruction with Arabic content helps LLMs follow language constraints better).

### Files Changed
- `supabase/functions/generate-avatar/index.ts` — New edge function to generate the avatar image
- `src/assets/interviewer-avatar.png` — Replaced with Saudi male portrait
- `src/hooks/useVapiInterview.ts` — Fix Vapi config for Arabic

