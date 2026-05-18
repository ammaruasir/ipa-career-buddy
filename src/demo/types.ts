export type SpotlightSpec = {
  selector: string;
  label?: string;
};

export type TourAction =
  | { kind: "navigate"; to: string }
  | { kind: "click"; selector: string; delayMs?: number }
  | { kind: "type"; selector: string; text: string; speedMs?: number }
  | { kind: "wait"; ms: number }
  | { kind: "swap-session"; role: "candidate" | "admin" | "hr" | "instructor" }
  | { kind: "pause-voice" }
  | { kind: "resume-voice" }
  | {
      kind: "start-live-interview";
      mode: "practice" | "assessment";
      questionCount: number;
      jobPosition?: string;
    }
  | {
      kind: "ai-vs-ai-turn";
      questionIndex: number;
      totalQuestions: number;
      context: "practice_interview" | "assessment_interview";
    }
  | { kind: "end-live-interview" };

export type CursorState = {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
};

export type DemoRuntimeContext = {
  lastInterviewId: string | null;
};

export type TourStep = {
  id: string;
  act: string;
  /** Route to navigate to before the narration begins. Can be a static string
   *  or a function that resolves at run time from the demo runtime context
   *  (useful for navigating to a just-created interview's results page). */
  route?: string | ((ctx: DemoRuntimeContext) => string);
  narration: string;
  spotlight?: SpotlightSpec;
  action?: TourAction;
  durationEstimateMs?: number;
  faqHints?: string[];
};

export type TourStatus = "idle" | "running" | "paused" | "qna" | "finished";

export type TourState = {
  status: TourStatus;
  stepIndex: number;
  totalSteps: number;
  currentStep: TourStep | null;
  isSpeaking: boolean;
  takeOverMode: boolean;
  cursor: CursorState;
};
