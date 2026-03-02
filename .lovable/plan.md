

## Plan: Switch to OpenAI GPT-4 + Job DB Integration + Result Visibility

This is a large refactor touching edge functions, hooks, and result pages. Here's the breakdown:

### Prerequisites
- **Add `OPENAI_API_KEY` secret** — you'll need to provide your OpenAI API key before implementation can proceed.

### Database Migration
Add columns to `evaluations` table:
- `problem_solving` (numeric), `leadership` (numeric), `culture_alignment` (numeric)
- `red_flags` (jsonb, default `'[]'`)
- `confidence_level` (text)
- `final_recommendation` (text)
- `review_status` (text, default `'pending_review'`) — controls visibility

Add RLS policy: only HR/admin can update `review_status`.

### Edge Function Changes

**1. `supabase/functions/chat/index.ts`** — Complete rewrite:
- Call OpenAI `https://api.openai.com/v1/chat/completions` with `gpt-4.1` model using `OPENAI_API_KEY`
- On first call: load job record from `job_vacancies` table (title, description, requirements, department)
- Inject the new Saudi Arabic system prompt (max 80 words per response, one question, anti-manipulation rules, bias control)
- **Latency optimization**: Accept a `context_summary` + `last_answer` instead of full transcript — only send last answer + summarized context to GPT, not full history

**2. `supabase/functions/evaluate-interview/index.ts`** — Switch AI provider:
- Use OpenAI `gpt-4.1` instead of Lovable AI gateway
- Load job data from DB and pass to GPT alongside transcript
- New evaluation schema: `communication`, `problem_solving`, `technical_depth`, `leadership`, `culture_alignment`, `strengths`, `development_areas`, `red_flags`, `final_recommendation`, `confidence_level`
- Save with `review_status = 'pending_review'`

### Frontend Changes

**3. `src/hooks/useLiveInterview.ts`**:
- On `startCall`: fetch job vacancy data from DB (via vacancy_id in URL params) and pass structured job info to chat function
- Optimize `getNextAIResponse`: instead of sending full `conversationRef`, send only the system prompt + a running context summary + last user answer
- Maintain a `contextSummaryRef` that accumulates key points from each exchange

**4. `src/hooks/useInterviewSession.ts`** — Same latency optimization for text interviews

**5. `src/pages/InterviewResults.tsx`**:
- Check `evaluation.review_status`: if `pending_review`, show only the message "تم إكمال المقابلة بنجاح. سيتم إشعارك بالنتيجة بعد مراجعة فريق الموارد البشرية."
- If `released`, show full results as before plus new fields (leadership, problem_solving, red_flags)

**6. `src/pages/CandidateDetail.tsx`** (HR/Admin view):
- Show full transcript, all scores including new fields, radar chart data
- Add "Approve" button that sets `review_status = 'released'` — only then candidate sees results
- Add "Reject" button that sets `review_status = 'rejected'`

### Files Modified
- `supabase/functions/chat/index.ts`
- `supabase/functions/evaluate-interview/index.ts`
- `src/hooks/useLiveInterview.ts`
- `src/hooks/useInterviewSession.ts`
- `src/pages/InterviewResults.tsx`
- `src/pages/CandidateDetail.tsx`
- DB migration (new columns on `evaluations`)

