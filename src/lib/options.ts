export const PAN_TYPES = [
  "Cast iron",
  "Carbon steel",
  "Stainless clad (3-ply/5-ply)",
  "Enameled cast iron",
  "Induction-safe nonstick",
  "Aluminum-clad (induction-safe)",
] as const;

export const EXPERIENCE = ["Beginner", "Intermediate", "Confident"] as const;

export const GOALS = [
  "Sear",
  "Sauté",
  "Simmer",
  "Shallow fry",
  "Deep fry",
  "Boil / pasta water",
  "Reduce sauce",
  "Melt / temper",
  "Stir-fry",
] as const;

export const FEEDBACK_TAGS = [
  "worked well",
  "too hot",
  "too cool",
  "timing off",
  "browned too fast",
  "did not brown enough",
  "stuck to pan",
  "scorched",
] as const;

export type PanType = (typeof PAN_TYPES)[number];
export type Experience = (typeof EXPERIENCE)[number];
export type Goal = (typeof GOALS)[number];
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export type ImpulseMode = "Precise" | "Boost" | "Simmer" | "Sear" | "Custom";

export type AdaptationCard = {
  impulseMode: ImpulseMode;
  tempRangeF: { min: number; max: number } | null;
  powerLevel: number | null;
  timingNotes: string;
  cues: { visual: string[]; auditory: string[]; smell: string[] };
  panCautions: string[];
  safetyReminders: string[];
  confidence: "low" | "medium" | "high";
  rationale: string;
};

export type ExtractedRecipe = {
  title: string;
  sourceName: string | null;
  sourceUrl: string | null;
  yieldText: string | null;
  ingredients: string[];
  instructions: string[];
};

export type CookingContext = {
  panType: PanType;
  experience: Experience;
  goal: Goal;
  userNotes?: string;
};
