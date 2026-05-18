## Goals

Address five interlinked issues in Training (text) and Assessment (voice/video) interviews:

1. Phase tags like `[CORE]`, `[INTRO]` leak into the spoken/displayed text.
2. The interviewer's name/gender (currently "نورة female") doesn't match the voice (male Jeddawi).
3. The header status pill stays on "المرحلة التعريفية" and never advances to Core/Closing.
4. The overall interaction tone is inconsistent — sometimes too casual, sometimes off-brand.
5. The interviewer over-uses the candidate's name every turn — feels unnatural.

---

## 1. Stop phase-tag leaks (server + client double-strip)

Leading-only regex sanitization is fragile; the model sometimes emits `[CORE]` mid-text, drops brackets, or double-tags.

- `**supabase/functions/chat/index.ts**` — sanitize before returning:
  - Capture the leading phase tag and expose it as a new top-level `phase` field on the response.
  - Globally strip every occurrence of `\[?(INTRO|CORE|FOLLOW_UP|CLOSING|END|NEW_Q)\]?\s*:?\s*` (case-insensitive, bracketed and bare), then collapse double spaces.
  - Strengthen the system rule: "العلامة تظهر مرة واحدة فقط في أول الرد بين قوسين مربعين، ولا تذكر أبداً داخل النص المنطوق."
- `**useLiveInterview.ts**` (greeting, `getNextAIResponse`, closing fallback) and `**useInterviewSession.ts**` (`startInterview`, `sendAnswer`) — replace leading-only strip with the same global strip; prefer the new `phase` field, fall back to regex.
- One shared helper `stripPhaseTags(text)` in `src/lib/arabic-utils.ts` so both hooks use identical logic.

## 2. Lock persona to a single source of truth that matches the available voice

Only one production Arabic voice exists today (Jeddawi male, `yXEnnEln9armDCyhkXcA`). DB already stores `عبدالله / male`, but several fallbacks still introduce "نورة female", so name and audio drift apart.

- `**src/hooks/useSystemSettings.ts**` — change `DEFAULT_SETTINGS.interviewer_voice` to `{ name: "عبدالله", gender: "male", voice_id: "yXEnnEln9armDCyhkXcA", avatar_url: "" }`.
- `**src/hooks/useLiveInterview.ts**` — change default params to `interviewerName = "عبدالله"`, `interviewerGender = "male"`. Move both into refs that re-sync via `useEffect` (same pattern as `interviewerVoiceIdRef`) so the greeting prompt always uses the latest settings, not a stale closure.
- `**supabase/functions/chat/index.ts**` — change `ivName` fallback to `"عبدالله"` and gender default to `"male"`.
- `**src/pages/AdminSettings.tsx**` — when admin changes name/gender, validate that `voice_id` belongs to the chosen gender; show an inline warning if not. Surface voice gender metadata from `wakeb-voices`.

> If the user wants to keep Noura instead, the alternative is procuring a female Khaleeji voice (Phase B.5 voice cloning) — out of scope unless requested.

## 3. Make the phase status bar actually advance

- `**useLiveInterview.ts` `getNextAIResponse**` — match `phaseTag` anywhere in the first ~40 chars (not anchored at `^`) and prefer the server-returned `phase` field. If a `[CORE]` tag arrives while `currentPhase` is still `"intro"`, force the transition.
- `**TextInterview.tsx**` — pass `phaseLabel` (derived from `session.currentPhase`) into `InterviewHeader`, mirroring `LiveInterview.tsx`. Without this, text mode never shows phase progression.
- `**InterviewHeader.tsx**` — no change; it already renders `phaseLabel`.

## 4. Raise the interviewer's professionalism

In `supabase/functions/chat/index.ts` system prompt:

- Replace the loose persona ("ودود وطبيعي … عندك حس خفيف") with: "محاور وظيفي محترف، هادئ ومنظم، يستخدم لهجة سعودية مهنية مع لمسة دافئة دون مبالغة. يتجنب العامية الزائدة والمزاح."
- Forbid filler openers like "هلا والله"، "تمام كذا"، "حلو هذي نقطة مهمة" in the first message; allow short professional acknowledgments only mid-interview ("شكراً لك"، "ملاحظة مفيدة"، "واضح").
- Force first-message structure: greeting + self-introduction (name + role) + position + one open intro question — no commentary on a non-existent prior answer.
- In `useLiveInterview.startCall`, update the dynamic greeting prompt and the static fallback (line 1074) to the new professional opener: "السلام عليكم، أنا ${interviewerName} من محرك واكب الذكي. سأجري معك اليوم مقابلة لوظيفة ${jobPosition}. لنبدأ — عرّفني على نفسك وخلفيتك المهنية."

## 5. Stop over-using the candidate's name

The current prompt has a loud "⚠️ تنبيه مهم" that instructs the model to address the candidate by name — the model then repeats the name almost every turn.

In `supabase/functions/chat/index.ts`:

- Replace the existing `candidateNameInstruction` block with a softer, frequency-capped rule: "اسم المرشح هو ${candidateName}. استخدم اسمه مرة واحدة فقط عند التحية الأولى، ومرة عند الختام. خلال بقية المقابلة استخدم ضمائر مهذبة (أنت) ولا تكرر اسمه."
- Add an explicit "قواعد المخاطبة" section under "قواعد عامة": "ممنوع تكرار اسم المرشح في كل رد. الاسم يُذكر عند التحية والختام فقط."
- Mirror the rule in the greeting prompt inside `useLiveInterview.startCall` so the first message uses the name once, and in `useInterviewSession.startInterview`.

---

## Out of scope

- Procuring a real female voice (Phase B.5 voice cloning).
- Changing evaluation logic, scoring, or storage.
- Touching the demo/AI-vs-AI cameo pipeline beyond the shared sanitizer.

## Verification

- Run one practice text interview: status bar moves intro → core → closing; no `[TAG]` strings appear; candidate name appears at most in the first and last messages.
- Start a voice interview: greeting introduces "عبدالله" with male voice; name not repeated each turn.
- Tail `function_edge_logs` for `chat` after the run — confirm sanitized output and new `phase` field.