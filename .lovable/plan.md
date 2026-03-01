

# AI Interview Engine — Implementation Plan

## What We're Building

A complete AI-powered interview engine with: structured question generation, real-time transcript analysis, post-interview evaluation with detailed scoring, and a results page. All powered by Lovable AI via edge functions.

---

## 1. New Edge Function: `evaluate-interview`

A dedicated backend function that:
- Takes an interview's responses + job position
- Uses Lovable AI (tool calling / structured output) to generate a comprehensive evaluation
- Scores: Communication (0-100), Technical (0-100), Cultural Fit (0-100), Personality (DISC)
- Generates Arabic feedback with filler word detection, sentiment, and recommendation
- Saves results to the `evaluations` table
- Returns the evaluation data

**Key AI prompt features:**
- Keyword extraction from answers
- Filler word counting (ممم، يعني، أحس، كدا)
- Time-based scoring logic (answers 90-180s get bonus)
- DISC personality mapping
- Recommendation: "موصى به بشدة" / "موصى به" / "غير موصى به"

## 2. Enhance `chat` Edge Function

Update the existing chat function's system prompt to generate structured questions:
- 8 questions per interview (2 behavioral, 3 technical, 2 situational, 1 culture-fit)
- Difficulty scaling based on question number
- Arabic-first with proper formatting

No separate edge function needed — the system prompt in `useInterviewSession` already controls question generation. We'll update `totalQuestions` to 8 and refine the system prompt to specify question categories.

## 3. Database Changes

Add columns to `evaluations` table:
- `recommendation` (text) — "موصى به بشدة" / "موصى به" / "غير موصى به"
- `personality_type` (text) — DISC type
- `filler_words_count` (integer)
- `sentiment` (text) — Positive/Neutral/Negative
- `speech_pace` (numeric) — words per minute estimate
- `confidence_score` (numeric) — 0-100
- `detailed_scores` (jsonb) — full breakdown

Add RLS policy for service role to insert evaluations (edge function uses service role).

## 4. Results Page (`/interview/:id/results`)

New page showing:
- Overall score with circular progress indicator
- Score breakdown cards (Communication, Technical, Cultural Fit)
- DISC personality badge
- Recommendation badge with color coding
- Strengths list (Arabic)
- Improvements list (Arabic)
- AI feedback text
- Filler words count, sentiment, confidence metrics
- "Back to Dashboard" button

## 5. Update `useInterviewSession` Hook

- Change `totalQuestions` default to 8
- Enhance the system prompt to specify question categories (2 behavioral, 3 technical, 2 situational, 1 culture-fit)
- After interview completion, automatically call `evaluate-interview` edge function
- Store evaluation result for navigation to results page

## 6. Update Dashboard

- Link completed interviews to `/interview/:id/results`
- Show overall score badge on completed interview cards

## 7. Update Routes

Add `/interview/:id/results` route to `App.tsx`

---

## File Changes Summary

```text
NEW FILES:
  supabase/functions/evaluate-interview/index.ts  — AI evaluation engine
  src/pages/InterviewResults.tsx                    — Results display page

MODIFIED FILES:
  src/hooks/useInterviewSession.ts  — 8 questions, categorized prompts, auto-evaluate
  src/pages/Dashboard.tsx           — Show scores on completed interviews
  src/App.tsx                       — Add results route
  supabase/config.toml              — Add evaluate-interview function config

DATABASE MIGRATION:
  Add recommendation, personality_type, filler_words_count, sentiment,
  speech_pace, confidence_score, detailed_scores columns to evaluations
```

## Implementation Order
1. Database migration (add columns)
2. `evaluate-interview` edge function
3. Update `useInterviewSession` (8 questions + auto-evaluate)
4. `InterviewResults` page
5. Update Dashboard + routes

