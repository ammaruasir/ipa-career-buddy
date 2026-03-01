

# Video Interview Enhancements Plan

## 1. Video Facial Analysis (AI-Powered)

Currently the video recordings are uploaded to storage but never analyzed. We'll add a new backend function that uses Gemini's multimodal capabilities to analyze video frames captured during each answer.

**How it works:**
- During each answer recording, capture 3-4 video frame snapshots (canvas screenshot from the `<video>` element) at intervals
- When the recording stops, send these frames alongside the transcribed text to a new `analyze-video` backend function
- The function uses Gemini's vision capabilities to assess: eye contact, facial expressions (confidence, nervousness, engagement), body language, and professional appearance
- Results are stored per-response in the `responses.ai_analysis` column (already exists, currently unused)
- The `evaluate-interview` function is updated to incorporate video analysis scores into the final evaluation

**New scores added to evaluation:**
- Eye contact score (0-100)
- Confidence from facial analysis (0-100)  
- Engagement/attentiveness (0-100)
- Body language assessment (text)

## 2. Full Interview Recording (Start-to-Finish)

Currently only individual per-question clips are saved. We'll add a continuous recording that captures the entire interview session from start to finish.

**How it works:**
- Start a separate `MediaRecorder` when the interview begins (camera init) that records continuously
- This "full session" recorder runs independently of the per-question recordings
- When the interview completes (all questions answered), stop and upload the full recording to storage
- Save the recording URL in the `interviews` table (new `recording_url` column)
- HR/admins can play back the full interview from the Candidate Detail page

**Database change:**
- Add `recording_url TEXT` column to `interviews` table

## 3. Additional Enhancements

### 3a. Video Playback for HR/Admins
- Add a video player in the Candidate Detail page so HR can watch per-question clips and the full interview recording
- List all recordings from storage for the interview ID

### 3b. Real-Time Engagement Indicators
- During the interview, periodically capture a frame and run a quick analysis to show the candidate a subtle engagement meter (e.g., "maintain eye contact" gentle reminder)
- Uses a lightweight check every 30 seconds

### 3c. Interview Summary with Video Highlights
- After evaluation, generate timestamps of key moments (strong answers, hesitations) based on the frame analysis data
- Display these as clickable markers on the full recording timeline in the results page

## Files to Create
- `supabase/functions/analyze-video/index.ts` — Gemini multimodal function that accepts video frames + text and returns facial/body language analysis
- `src/components/interview/VideoPlayback.tsx` — Video player component for HR to review recordings

## Files to Modify
- `src/pages/VideoInterview.tsx` — Add frame capture during recording, full-session recorder, send frames to analysis function
- `supabase/functions/evaluate-interview/index.ts` — Incorporate video analysis data into final scoring
- `src/pages/CandidateDetail.tsx` — Add video playback section for HR
- `src/hooks/useInterviewSession.ts` — Store recording URL on completion
- `src/pages/InterviewResults.tsx` — Display video analysis scores (eye contact, body language)

## Database Migration
```sql
ALTER TABLE interviews ADD COLUMN recording_url TEXT;
```

## Technical Details

**Frame Capture:** Use `canvas.drawImage(videoElement)` → `canvas.toDataURL('image/jpeg', 0.7)` to capture frames as base64 during recording. Capture at answer start, middle, and end.

**Gemini Vision Prompt:** Send frames with a structured prompt asking for eye contact assessment, facial expression reading, confidence indicators, and professional demeanor — all returning structured scores via tool calling.

**Storage Structure:**
```
interview-recordings/
  {user_id}/
    {interview_id}_full.webm          ← full session
    {interview_id}_q1_{timestamp}.webm ← per-question (existing)
    {interview_id}_q2_{timestamp}.webm
```

