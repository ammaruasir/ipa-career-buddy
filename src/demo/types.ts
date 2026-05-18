export type SpotlightSpec = {
  selector: string;
  label?: string;
};

export type TourAction =
  | { kind: "navigate"; to: string }
  | { kind: "click"; selector: string; delayMs?: number }
  | { kind: "type"; selector: string; text: string; speedMs?: number }
  | { kind: "wait"; ms: number }
  | { kind: "swap-session"; role: "candidate" | "admin" | "hr" | "instructor" };

export type TourStep = {
  id: string;
  act: string;
  route?: string;
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
};
