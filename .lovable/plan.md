## Plan: Switch to OpenAI GPT-4 + Job DB Integration + Result Visibility

**Status: ✅ COMPLETED**

All changes implemented:
- ✅ OPENAI_API_KEY secret added
- ✅ DB migration: new columns on evaluations (problem_solving, leadership, culture_alignment, red_flags, confidence_level, final_recommendation, review_status)
- ✅ chat edge function: OpenAI gpt-4.1, job DB integration, Saudi Arabic prompt, latency optimization
- ✅ evaluate-interview edge function: OpenAI gpt-4.1, new scoring schema, review_status=pending_review
- ✅ useLiveInterview: context_summary optimization, vacancy_id passthrough
- ✅ useInterviewSession: context_summary optimization
- ✅ InterviewResults: pending_review shows "awaiting HR review" message
- ✅ CandidateDetail: approve/reject buttons, full transcript, red flags, new scores
