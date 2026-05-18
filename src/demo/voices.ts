// Voice IDs used by Demo Mode (عبدالله + سعد) and the platform interviewer.
// All three currently resolve to a single male Hijazi (Jeddawi) Arabic voice
// as a fallback. Phase B.5 (voice procurement) is external work — once
// cloned voices land, the presenter and candidate will get distinct voices
// via Wakeb AI Engine voice cloning. Procurement checklist: audit
// AdminSettings voices → record 1F + 1M Khaleeji/Hijazi samples → clone
// → blind-listen test with native speakers.

const JEDDAWI_MALE_VOICE = "yXEnnEln9armDCyhkXcA";

/** Male Jeddawi (Hijazi) Arabic voice — the presenter ("عبدالله"). */
export const presenterVoiceId = JEDDAWI_MALE_VOICE;

/** Male Jeddawi (Hijazi) Arabic voice — the demo candidate ("سعد"). */
export const candidateVoiceId = JEDDAWI_MALE_VOICE;

/** Existing production interviewer voice — same Jeddawi male for now. */
export const interviewerVoiceId = JEDDAWI_MALE_VOICE;
