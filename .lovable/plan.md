

# AI Interview Platform — IPA Saudi Arabia

## Overview
A comprehensive Arabic-first AI interview platform for IPA students, featuring text/voice/video interview modes, real-time AI evaluation, and admin/HR dashboards. Full RTL support with IPA branding.

---

## Phase 1: Foundation & Auth

### Design System
- Import **Tajawal** (Arabic) and **Inter** (English) fonts
- Apply IPA brand colors (Navy #1e3a8a, Teal #14b8a6, Gold #c1b48a)
- Global RTL layout with `direction: rtl`, rounded-xl buttons, shadow-lg cards
- IPA logo placeholder in header

### Authentication (Supabase)
- **Login & Signup pages** with IPA branding, Arabic labels
- Role-based access: Student, Admin, HR
- Roles stored in a separate `user_roles` table (not on profiles)
- Profiles table with branch location, name, avatar
- Auto-redirect based on role after login

---

## Phase 2: Database Schema (Supabase)

- **profiles** — name, avatar, branch_location, linked to auth.users
- **user_roles** — user_id, role (student/admin/hr enum)
- **interviews** — type (text/voice/video), status, job_position, questions JSON, timestamps
- **responses** — interview_id, question text, student answer, media_url, ai_analysis, scores
- **evaluations** — response_id, communication_score, technical_score, personality_match, ai_feedback in Arabic
- RLS policies using `has_role()` security definer function

---

## Phase 3: Student Experience

### Landing Page
- Hero section with IPA branding, Arabic welcome text
- Overview of interview types (text, voice, video) with icons
- "Start Interview" CTA

### Student Dashboard
- Interview history with status badges (completed, in-progress, pending)
- Overall scores and progress charts (Recharts)
- Quick-start buttons for each interview mode

### Text Interview (Chat Mode)
- Chat UI with AI interviewer (right-to-left message bubbles)
- Student selects a job position → AI generates dynamic Arabic questions
- Real-time streaming responses via Lovable AI (Gemini model)
- Progress indicator showing question count
- Submit and receive AI evaluation at the end

---

## Phase 4: Voice & Video Interviews

### Voice Interview
- Audio recording via browser MediaRecorder API
- Speech-to-text processing via edge function
- AI analyzes transcribed answers and provides Arabic feedback

### Video Interview
- WebRTC-based video recording
- Video stored in Supabase Storage
- AI scoring based on transcribed content with simulated expression/tone analysis
- Playback and review capability

---

## Phase 5: Admin & HR Panels

### Admin Dashboard
- View all students and their interview results
- Analytics: completion rates, average scores, trends over time
- Manage job positions and question templates

### HR Panel
- Browse student evaluations filtered by job position
- Compare candidates side-by-side
- Export evaluation reports
- Shortlist candidates

---

## Phase 6: AI Integration (Lovable AI)

- Edge function for generating interview questions based on job description
- Edge function for evaluating student responses (scoring communication, technical skills, personality)
- All AI prompts and feedback in Arabic
- Streaming chat for text interviews
- Non-streaming for evaluation scoring (structured output via tool calling)

---

## Pages & Routes
| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Login/Signup |
| `/dashboard` | Student | Student dashboard |
| `/interview/text` | Student | Text chat interview |
| `/interview/voice` | Student | Voice interview |
| `/interview/video` | Student | Video interview |
| `/interview/:id/results` | Student | View evaluation |
| `/admin` | Admin | Admin dashboard |
| `/hr` | HR | HR evaluation panel |

