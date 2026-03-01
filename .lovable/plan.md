

# How AI & Interview Modes Currently Work

## AI Across All Interview Types

**Yes, the AI works in all 3 types** — Text, Voice, and Video all use the same `useInterviewSession` hook which calls the `chat` edge function and `evaluate-interview` edge function. The AI generates questions, receives answers, and evaluates — identically for all types.

## How Voice Interview Works

1. AI displays a question as text in a card
2. Candidate clicks a mic button → browser records audio via `MediaRecorder` API
3. Candidate clicks stop → audio preview appears with playback controls
4. **Critical gap: There is NO speech-to-text (transcription)**. The candidate must **manually type** their answer in a textarea below the audio player
5. Audio is uploaded to storage, but the typed text is what gets sent to the AI
6. The "transcription" field is just a manual textarea — no actual transcription happens

**Verdict: Voice mode is essentially a text interview with an optional audio recording attachment. The audio is stored but never analyzed.**

## How Video Interview Works

1. Camera + mic stream starts automatically when job is selected
2. AI displays question as text
3. Candidate clicks "Start Recording" → countdown → video records via `MediaRecorder`
4. Candidate can pause/resume/stop recording
5. **Same gap: No speech-to-text**. Candidate must manually type their answer in a textarea
6. Video is uploaded to storage (max 50MB), but the typed text is what the AI evaluates
7. The "AI interviewer" panel shows a static `GraduationCap` icon (should be `Briefcase` — missed in rebranding) with text "معهد الإدارة العامة" (also missed in rebranding)

**Verdict: Video mode is a text interview with a camera feed and optional video recording. No actual speech analysis occurs.**

## Issues Found

| Issue | Severity |
|---|---|
| **No speech-to-text in Voice/Video** — candidates must type answers manually, defeating the purpose | Critical |
| **Video page still shows GraduationCap icon** and "معهد الإدارة العامة" — missed in rebranding | Medium |
| **Audio/video recordings are never used** — uploaded to storage but never analyzed or played back | Medium |
| **No real difference between modes** — all three are functionally text-based chat with the AI | Critical |

## Proposed Fix: Add Speech-to-Text

To make Voice and Video interviews actually work as intended, we need to add automatic speech-to-text transcription. Here's the plan:

### 1. Create a `transcribe-audio` edge function
- Accepts audio/video blob uploads
- Uses Lovable AI (Gemini model with audio support) to transcribe Arabic speech to text
- Returns the transcribed text to the client

### 2. Update Voice Interview
- After recording stops, automatically send audio to `transcribe-audio`
- Show a loading state ("جارٍ تحويل الصوت إلى نص...")
- Auto-fill the textarea with the transcription
- Candidate can review/edit before submitting

### 3. Update Video Interview  
- Same flow — extract audio from video recording, send to transcription
- Auto-fill textarea with result
- Fix the leftover branding (GraduationCap → Briefcase, remove "معهد الإدارة العامة")

### 4. Files to create/modify
- **New**: `supabase/functions/transcribe-audio/index.ts` — edge function using Gemini multimodal for Arabic speech-to-text
- **Edit**: `src/pages/VoiceInterview.tsx` — add auto-transcription after recording
- **Edit**: `src/pages/VideoInterview.tsx` — add auto-transcription + fix branding remnants

