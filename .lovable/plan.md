

## Problem

The `VoiceInterview` component doesn't wait for system settings to finish loading before rendering the job selector. The default value of `interview_engine` is `"built_in"`, so when a user selects a job before settings load, the built-in interview starts instead of Vapi.

Looking at lines 171-184 of `VoiceInterview.tsx`:
1. Line 171: Job selector renders immediately (settings may still be loading)
2. Line 164-168: `handleJobSelect` checks `settings.interview_engine` which is still the default `"built_in"` during loading
3. Line 175: The Vapi check also uses potentially-unloaded settings

The same issue likely exists in `VideoInterview.tsx`.

## Fix

### 1. `VoiceInterview.tsx`
- Add a loading guard that shows a spinner while `settingsLoading` is true (before the job selector)
- This ensures `settings.interview_engine` has the real DB value (`"vapi"`) before the user can select a job

### 2. `VideoInterview.tsx`
- Apply the same loading guard for settings before rendering job selector or interview UI

Both changes are minimal: add an early return with a loading spinner when `settingsLoading` is true.

