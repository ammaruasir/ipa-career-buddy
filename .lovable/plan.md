## Goal
Complete the two remaining prefill items:
1. **CVInterview** — pre-populate known answers from the user's profile so the user just confirms/edits.
2. **CertsStep** (in CVBuilder) — pre-populate certifications from the user's most recent uploaded resume (`cv_documents.extraction.certifications`) when the draft is brand new.

## Part 1 — CVInterview prefill

Server (`cv-interview-step` edge function) drives the question flow with these fields:
`experience_level`, `target_role`, `target_industry`, `personal_info.full_name`, `personal_info.contact`, `experience`, `education`, `skills.technical`, `skills.languages`, `certifications`, etc.

Approach: client-side prefill only — no edge function changes.

- Use `useProfilePrefill` in `src/pages/CVInterview.tsx`.
- Add a `prefillFor(field)` helper that maps the current question's `field` to a default answer string from the profile:
  - `personal_info.full_name` → `prefill.personal_info.full_name`
  - `personal_info.contact` → `${email} — ${phone}` joined
  - `target_role` → `prefill.major`
  - `target_industry` → `prefill.major` (best-effort hint)
  - `education` → `${degree} في ${major}` (single line summary)
  - `experience_level` → derive from `experience_years` (`0` → entry, `1-3` → junior, `4-7` → mid, `8+` → senior) and set the matching `choice.value` if it exists in `question.choices`.
- In a `useEffect([question])`, set `setAnswer(prefillFor(question.field) ?? "")` so the field is pre-filled but fully editable.
- Show a small badge under the input ("تم تعبئتها من ملفك — يمكنك التعديل") when the value came from prefill.

## Part 2 — CertsStep prefill in CVBuilder

- Extend `useProfilePrefill` to also fetch the latest `cv_documents` row (`extraction.certifications: string[]`) for the user.
- Add `certifications: CertItem[]` to `PrefillData` (map each extracted string → `{ name }`).
- In `CVBuilder.tsx`, when creating a fresh draft (no existing `cv_drafts` row), seed `certifications: prefill.certifications` alongside the existing personal_info + education seeding.

## Files
**Modify:**
- `src/hooks/useProfilePrefill.ts` — add cv_documents query + `certifications` field.
- `src/pages/CVInterview.tsx` — add prefill mapping + auto-set `answer` on question load.
- `src/pages/CVBuilder.tsx` — seed `certifications` from prefill on fresh draft.

**No edge function or DB changes.**

## Result
- The interview opens with answers already filled where possible; the user only edits/confirms.
- A fresh CV draft auto-populates certifications from the user's previously analyzed resume (if any).