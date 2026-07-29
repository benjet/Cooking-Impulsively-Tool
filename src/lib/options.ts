import type { TemperatureObject } from "./temperature";

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

export type Confidence = "low" | "medium" | "high";

/**
 * Generated guidance for one recipe.
 *
 * Every temperature lives in `temps` and is referenced from the narrative
 * fields as a {{temp_n}} token — no field on this type may contain a
 * temperature in prose. That is what lets the viewer switch units without
 * regenerating the card (PRD_V2 section 14).
 */
export type AdaptationCard = {
  schemaVersion: 2;
  deviceProfileId: string;
  deviceProfileVersion: number;
  impulseMode: ImpulseMode;
  /** Token dictionary. Keys are referenced as {{key}} in the templates below. */
  temps: Record<string, TemperatureObject>;
  /** Token key for the primary setting, when the guidance is temperature-led. */
  settingTokenKey: string | null;
  /** Power level 1-10, when the guidance is power-led instead. */
  powerLevel: number | null;
  /** Templates. May contain {{temp_n}} tokens. */
  timingNotes: string;
  rationale: string;
  panCautions: string[];
  safetyReminders: string[];
  cues: { visual: string[]; auditory: string[]; smell: string[] };
  confidence: Confidence;
};

/** Pre-token card shape, still present in rows written before this change. */
export type AdaptationCardV1 = {
  impulseMode: ImpulseMode;
  tempRangeF: { min: number; max: number } | null;
  powerLevel: number | null;
  timingNotes: string;
  cues: { visual: string[]; auditory: string[]; smell: string[] };
  panCautions: string[];
  safetyReminders: string[];
  confidence: Confidence;
  rationale: string;
};

export type ExtractedRecipe = {
  title: string;
  sourceName: string | null;
  sourceUrl: string | null;
  yieldText: string | null;
  ingredients: string[];
  instructions: string[];
  detectedStovetopSteps: boolean[];
  extractionConfidence: number;
};

export type CookingContext = {
  deviceId: string;
  panType: PanType;
  experience: Experience;
  goal: Goal;
  userNotes?: string;
};
