

# Analysis: What's Dynamic vs Hardcoded & What's Missing

## Part 1: Admin-Configurable Items — Current Status

### Currently Dynamic (stored in DB, admin can change)
- **Question bank** — Admin can CRUD questions in `question_templates` table
- **User roles** — Admin can change user roles (student/hr/admin)

### Looks Dynamic But Actually Isn't (localStorage only, NOT used by backend)
| Setting | Where it's saved | Actually used? |
|---|---|---|
| Scoring weights (technical/communication/confidence/personality sliders) | localStorage | **No** — `evaluate-interview` function hardcodes `0.3/0.4/0.3` weights |
| Branding color | localStorage | **No** — CSS uses hardcoded `--primary` |
| Maintenance mode | localStorage | **No** — no middleware checks it |
| Logo upload | Not saved at all | **No** — file input has no handler |

### Fully Hardcoded (admin cannot configure at all)
| Item | Where | Hardcoded Value |
|---|---|---|
| Number of questions | `useInterviewSession` + each interview page | 8 (text), 5 (voice/video) |
| Question categories & order | System prompt in `useInterviewSession` | Behavioral→Technical→Situational→Cultural |
| Job positions list | `JobSelector.tsx` | 6 fixed Arabic job titles |
| Per-question timer | Each interview page | 300 seconds (voice/video), none (text) |
| AI model | `chat/index.ts` & `evaluate-interview/index.ts` | `google/gemini-3-flash-preview` |
| Evaluation criteria & thresholds | `evaluate-interview` system prompt | 80+/60-79/<60 recommendation bands |
| Filler word patterns | `evaluate-interview` | 7 hardcoded Arabic filler words |
| Question bank questions | NOT used by AI | AI generates its own questions; the `question_templates` table is never queried during interviews |

### Critical Issue: Question Bank Is Decorative
The admin can add questions to `question_templates`, but the `chat` edge function never reads from this table. The AI generates questions on its own from the system prompt. The question bank has no effect on actual interviews.

---

## Part 2: What's Missing From the Platform

### High Priority (Core Functionality Gaps)
1. **Connect question bank to interviews** — AI should use admin-created questions instead of generating random ones
2. **Make scoring weights functional** — Store in a `settings` table, read them in `evaluate-interview` function
3. **Make job positions dynamic** — Admin should manage job positions, not hardcoded array
4. **Configure number of questions per interview type** — Currently hardcoded per page
5. **Configure time limits** — Per-question or per-interview timer should be admin-settable
6. **Navigation links to settings** — No way to reach settings pages from dashboards (no sidebar/menu links)

### Medium Priority (Expected Features)
7. **Interview scheduling** — No ability for HR to schedule interviews for candidates
8. **PDF report export** — Results page has no export/print functionality
9. **Email notifications** — No notification when interview is completed or evaluated
10. **Dark mode toggle** — Theme system (`next-themes`) is installed but no toggle exposed
11. **Maintenance mode enforcement** — Toggle exists but nothing blocks users when enabled
12. **Practice mode differentiation** — Link exists on dashboard but no separate logic (same as real interview)
13. **HR dashboard** — HR role exists but redirects to admin dashboard; no dedicated HR view
14. **Candidate detail page** — `CandidateDetail.tsx` exists in routes but may be incomplete

### Lower Priority (Polish)
15. **Branding actually applied** — Color picker should update CSS variables site-wide
16. **Logo upload actually saved** — Upload handler missing
17. **Data export functionality** — Export button is a placeholder
18. **Storage quota display** — Shows static "2.5GB / 10GB" instead of real data
19. **Invite new users** — No way to send invitation emails to HR staff
20. **Interview recording playback** — Recordings uploaded but no playback UI for admin/HR

---

## Recommended Implementation Plan

To make the exam/interview system truly dynamic, I would create a `system_settings` table to store all configurable values, then update the edge functions to read from it:

```text
system_settings table
├── scoring_weights     (JSON: {technical: 40, communication: 30, ...})
├── questions_per_type  (JSON: {text: 8, voice: 5, video: 5})
├── time_per_question   (JSON: {text: 0, voice: 300, video: 300})
├── job_positions       (JSON: ["محلل أعمال", "أخصائي موارد بشرية", ...])
├── ai_model            (text: "google/gemini-3-flash-preview")
├── maintenance_mode    (boolean)
└── brand_color         (text: "#006C35")
```

Then wire:
1. `evaluate-interview` reads weights from DB instead of hardcoded values
2. `chat` function queries `question_templates` and includes them in the system prompt
3. `JobSelector` fetches positions from `system_settings`
4. Interview pages read question count and timer from settings
5. Add navigation sidebar with links to all settings pages

