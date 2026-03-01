

# Interview Interface — Three Modes

## Overview
Rebuild the text interview page and create two new pages (voice, video) with shared components, per-question timer, progress tracking, exit confirmation, and animations. No new dependencies needed beyond what's installed — CSS animations replace Framer Motion.

---

## Shared Components (new `src/components/interview/`)

### InterviewHeader
- IPA logo + "المقابلة الذكية - معهد الإدارة العامة"
- Timer display (countdown per question, configurable)
- Progress bar (`Progress` component): "السؤال 3 من 8"
- Connection quality indicator (green/yellow/red dot)
- Help button (opens help dialog)

### ExitConfirmationDialog
- AlertDialog with Arabic text: "هل أنت متأكد من الخروج؟ سيتم فقدان تقدمك"
- Confirm/Cancel buttons

### JobSelector
- Extract the existing job selection grid from TextInterview into a reusable component
- Used by all three interview modes

### useInterviewTimer hook
- Countdown timer (5 min default per question)
- Auto-submit or warning when time expires
- Pause/resume capability

### useInterview hook
- Shared logic: create interview record, save responses, track question count, end interview
- Reduces duplication across three pages

### TypingIndicator
- Animated three-dot bouncing indicator for AI "thinking" state

### SuccessCheckmark
- CSS keyframe animation shown after answer submission

---

## Mode 1: Text Interview (`/interview/text`) — Enhanced

### Changes from current
- Replace simple `Input` with `Textarea` for richer answers
- Add per-question 5-minute countdown timer
- Add AI avatar icon next to assistant messages
- Add typing indicator (animated dots) instead of spinner
- Add progress bar at top
- Add exit confirmation when navigating away
- Fade-in animation on new messages (CSS `animate-fade-in`)
- WhatsApp-style bubble layout with timestamps

---

## Mode 2: Voice Interview (`/interview/voice`) — New Page

### UI Layout
- Header with timer + progress
- Current question displayed in a card at top
- Center: Large circular record button (red pulse animation when recording)
- Audio waveform visualization (canvas-based, analyser node from Web Audio API)
- Real-time transcription display area (text appears as MediaRecorder captures)
- Playback controls: listen to recording before submitting
- Submit button sends audio transcription to AI for next question

### Technical approach
- `MediaRecorder` API for audio capture
- `AudioContext` + `AnalyserNode` for waveform visualization (animated bars)
- Audio sent to backend function that calls Lovable AI with transcribed text
- For MVP: student types/reviews transcription manually; future: integrate speech-to-text
- Responses saved with `answer_text` (transcribed) to `responses` table

---

## Mode 3: Video Interview (`/interview/video`) — New Page

### UI Layout
- Split screen: Student camera (large, left 60%), AI avatar area (right 40%)
- AI avatar: Professional placeholder with IPA branding, animated border glow when "speaking"
- Countdown overlay before recording (3, 2, 1 with scale animation)
- Recording controls bar: Pause, Resume, Stop (bottom center)
- Current question in elegant card overlay at top
- Optional live transcript toggle
- Recording indicator (red dot + "REC" pulsing)

### Technical approach
- `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` for camera
- `MediaRecorder` for video recording
- Video preview in `<video>` element
- Countdown timer component with CSS scale animations
- On stop: create blob, save response text, store reference
- Virtual background blur: CSS `backdrop-filter` on video element (simple approach)

---

## Routes to Add
- `/interview/voice` → VoiceInterview page
- `/interview/video` → VideoInterview page

Update `App.tsx` with the two new routes.

---

## Animations (CSS-only, no new deps)
- Message fade-in: existing `animate-fade-in` keyframe
- Recording pulse: new `@keyframes pulse-record` in `index.css`
- Countdown scale: new `@keyframes countdown-pop`
- Success checkmark: new `@keyframes checkmark-draw`
- Typing dots bounce: new `@keyframes bounce-dot`

---

## File Structure

```text
src/components/interview/
  InterviewHeader.tsx
  ExitConfirmationDialog.tsx
  JobSelector.tsx
  TypingIndicator.tsx
  SuccessCheckmark.tsx
  AudioWaveform.tsx
  CountdownOverlay.tsx
  RecordingControls.tsx
src/hooks/
  useInterviewTimer.ts
  useInterviewSession.ts
src/pages/
  TextInterview.tsx  (enhanced)
  VoiceInterview.tsx (new)
  VideoInterview.tsx (new)
```

## Implementation Order
1. Shared components + hooks
2. Enhanced TextInterview
3. VoiceInterview
4. VideoInterview
5. Update App.tsx routes

