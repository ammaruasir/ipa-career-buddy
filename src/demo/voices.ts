// Voice IDs used by Demo Mode (Lina + Sara) and the platform interviewer.
// All three must speak Khaleeji (Gulf) Arabic. Phase B.5 (voice procurement)
// is external work — until cloned voices land, all three IDs fall back to
// the platform's existing default Arabic voice. See plan for full procurement
// checklist: audit AdminSettings 24 voices → record 1F + 1M Khaleeji samples
// → ElevenLabs Pro Voice Cloning → blind-listen test with 3 Gulf natives.

const FALLBACK_AR_VOICE = "QsV9PCczMIklRM6xLPAS";

/** Female Khaleeji Arabic voice — the presenter ("لينا"). REPLACE after cloning. */
export const presenterVoiceId = FALLBACK_AR_VOICE;

/** Male Khaleeji Arabic voice — the demo candidate ("سارة"). REPLACE after cloning. */
export const candidateVoiceId = FALLBACK_AR_VOICE;

/** Existing production interviewer voice — leave unchanged. */
export const interviewerVoiceId = FALLBACK_AR_VOICE;
