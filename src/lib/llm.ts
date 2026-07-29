import type {
  AdaptationCard,
  CookingContext,
  ExtractedRecipe,
  ImpulseMode,
} from "./options";
import type { TemperatureObject } from "./temperature";
import { getDeviceProfileOrDefault } from "./devices";

/**
 * Development fallback generator.
 *
 * This is a keyword heuristic, not a model. It exists so the full flow runs
 * offline and without an API key, and it is retained deliberately as the
 * dev/offline provider once the real pipeline lands (IMPLEMENTATION_GUIDE
 * Phase D, item 8). The real implementation arrives behind the same signature
 * in #2.
 *
 * It emits the same tokenized shape the model will: no temperature may appear
 * as prose in any returned string.
 */

type Bucket = {
  mode: ImpulseMode;
  keywords: string[];
  /** Canonical Fahrenheit values; rendered through the device profile later. */
  tempF: { min: number; max: number } | null;
  powerLevel: number | null;
  visual: string[];
  auditory: string[];
  smell: string[];
  context: string;
};

const BUCKETS: Bucket[] = [
  {
    mode: "Sear",
    keywords: [
      "sear",
      "blacken",
      "screaming hot",
      "smoking hot",
      "crust",
      "char",
      "very hot pan",
    ],
    tempF: { min: 450, max: 500 },
    powerLevel: null,
    visual: [
      "Deep mahogany crust, not gray",
      "Oil shimmers and just begins to wisp",
    ],
    auditory: [
      "Aggressive, even sizzle that quiets as moisture leaves",
      "No silent spots — those are cold zones",
    ],
    smell: ["Toasted, nutty browning aromas; pull before acrid smoke"],
    context: "sear_target",
  },
  {
    mode: "Precise",
    keywords: ["deep fry", "shallow fry", "pan-fry", "fry", "golden brown"],
    tempF: { min: 350, max: 375 },
    powerLevel: null,
    visual: [
      "Bubbles surround food immediately on contact",
      "Edges turn golden within 60–90 seconds",
    ],
    auditory: ["Steady, lively sizzle (not a dull pop, not a roar)"],
    smell: ["Clean fried-food smell; if oil smells sharp, lower the dial"],
    context: "fry_target",
  },
  {
    mode: "Precise",
    keywords: ["sauté", "saute", "sweat", "soften", "translucent"],
    tempF: { min: 275, max: 325 },
    powerLevel: null,
    visual: [
      "Onions go translucent without color in ~6–8 min",
      "Butter foams but does not brown",
    ],
    auditory: ["Gentle, intermittent sizzle"],
    smell: ["Sweet, vegetal aromas; no scorching"],
    context: "saute_target",
  },
  {
    mode: "Simmer",
    keywords: [
      "simmer",
      "reduce",
      "low and slow",
      "barely bubbling",
      "gentle bubble",
    ],
    tempF: { min: 180, max: 210 },
    powerLevel: null,
    visual: ["Lazy bubbles breaking the surface every second or two"],
    auditory: ["Quiet, occasional pop — not a constant churn"],
    smell: ["Concentrated, deepening aromas as liquid reduces"],
    context: "simmer_target",
  },
  {
    mode: "Boost",
    keywords: ["boil", "rolling boil", "blanch", "bring to a boil"],
    tempF: null,
    powerLevel: 10,
    visual: ["Vigorous rolling boil across the whole surface"],
    auditory: ["Constant churn"],
    smell: ["Mostly neutral — watch for any starchy boil-over"],
    context: "boil_target",
  },
];

const DEFAULT_BUCKET: Bucket = {
  mode: "Precise",
  keywords: [],
  tempF: { min: 300, max: 350 },
  powerLevel: null,
  visual: ["Food responds within a few seconds of pan contact"],
  auditory: ["A steady but not aggressive sizzle"],
  smell: ["Pleasant cooking aromas, no burn smell"],
  context: "general_target",
};

/** Nonstick coatings degrade above this; canonical Fahrenheit. */
const NONSTICK_LIMIT_F = 400;

export async function generateAdaptation(
  recipe: ExtractedRecipe,
  context: CookingContext
): Promise<AdaptationCard> {
  const device = getDeviceProfileOrDefault(context.deviceId);

  const text = [recipe.title, ...recipe.instructions, ...recipe.ingredients]
    .join(" \n")
    .toLowerCase();

  let bucket: Bucket = DEFAULT_BUCKET;
  let hits = 0;
  for (const b of BUCKETS) {
    const n = b.keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    if (n > hits) {
      hits = n;
      bucket = b;
    }
  }

  const goalBucket = bucketForGoal(context.goal);
  if (goalBucket && hits < 2) bucket = goalBucket;

  const temps: Record<string, TemperatureObject> = {};
  let settingTokenKey: string | null = null;

  if (bucket.tempF) {
    settingTokenKey = "temp_setting";
    temps.temp_setting = {
      f: bucket.tempF.min,
      f_max: bucket.tempF.max,
      kind: "range",
      precision: "whole",
      context: bucket.context,
    };
  }

  const panCautions = buildPanCautions(context.panType, bucket.mode, temps);
  const safetyReminders = buildSafetyReminders(bucket.mode);
  const timingNotes = buildTimingNotes(recipe.instructions, bucket.mode);

  return {
    schemaVersion: 2,
    deviceProfileId: device.id,
    deviceProfileVersion: device.profileVersion,
    impulseMode: bucket.mode,
    temps,
    settingTokenKey,
    powerLevel: bucket.powerLevel,
    timingNotes,
    rationale: buildRationale(bucket, context, hits),
    panCautions,
    safetyReminders,
    cues: {
      visual: [...bucket.visual],
      auditory: [...bucket.auditory],
      smell: [...bucket.smell],
    },
    confidence: hits >= 3 ? "high" : hits >= 1 ? "medium" : "low",
  };
}

function bucketForGoal(goal: string): Bucket | null {
  const g = goal.toLowerCase();
  if (g.includes("sear")) return BUCKETS[0];
  if (g.includes("fry")) return BUCKETS[1];
  if (g.includes("sauté") || g.includes("saute") || g.includes("stir-fry"))
    return BUCKETS[2];
  if (g.includes("simmer") || g.includes("reduce") || g.includes("melt"))
    return BUCKETS[3];
  if (g.includes("boil")) return BUCKETS[4];
  return null;
}

function buildPanCautions(
  panType: string,
  mode: ImpulseMode,
  temps: Record<string, TemperatureObject>
): string[] {
  const out: string[] = [];
  const pan = panType.toLowerCase();

  if (pan.includes("nonstick")) {
    if (mode === "Sear" || mode === "Boost") {
      // The limit is a real temperature, so it becomes a token rather than
      // prose — otherwise this sentence could never render in Celsius.
      temps.temp_nonstick_limit = {
        f: NONSTICK_LIMIT_F,
        kind: "threshold",
        precision: "whole",
        context: "nonstick_limit",
      };
      out.push(
        "Nonstick coatings degrade above {{temp_nonstick_limit}}. Switch to cast iron or carbon steel for high-heat searing."
      );
    }
    out.push("Use silicone or wood utensils — no metal on the coating.");
  }
  if (pan.includes("cast iron")) {
    out.push(
      "Induction heats cast iron fast. Preheat at medium first, then step up — sudden high heat can warp."
    );
  }
  if (pan.includes("carbon steel")) {
    out.push(
      "Keep the seasoning intact: avoid sustained simmering of acidic sauces in this pan."
    );
  }
  if (pan.includes("enameled")) {
    out.push(
      "Enamel chips on thermal shock. Don't slam a cold pan onto a fully boosted burner."
    );
  }
  return out;
}

function buildSafetyReminders(mode: ImpulseMode): string[] {
  const out = ["Don't leave hot oil unattended."];
  if (mode === "Sear" || mode === "Boost") {
    out.push("Turn the hood on before you start — high heat produces smoke fast.");
  }
  if (mode === "Sear") out.push("Keep a lid within reach in case of a flare-up.");
  out.push(
    "Pan temperature is not the same as internal food temperature. Use a probe thermometer for meat, poultry, seafood, and eggs."
  );
  return out;
}

function buildTimingNotes(instructions: string[], mode: ImpulseMode): string {
  const re = /(\d{1,3})\s*(?:to\s*\d{1,3}\s*)?(?:min|minute)/gi;
  const hasTimings = instructions.some((step) => {
    re.lastIndex = 0;
    return re.test(step);
  });

  if (!hasTimings) {
    return "Induction responds faster than gas — watch sensory cues over the timer.";
  }
  if (mode === "Sear" || mode === "Boost") {
    return "Induction at high power often cooks 15–20% faster than gas. Start checking at the low end of any stated time.";
  }
  if (mode === "Simmer") {
    return "Reductions and simmers track close to gas timings, but the burner holds temp more stably — less stirring needed.";
  }
  return "Use the original timings as a guide and lean on the sensory cues above to know when to move on.";
}

function buildRationale(
  bucket: Bucket,
  context: CookingContext,
  hits: number
): string {
  const matched =
    hits > 0
      ? `recipe language matched ${hits} heat keyword${hits === 1 ? "" : "s"} for ${bucket.mode.toLowerCase()}-style cooking`
      : `no strong heat keywords were found, so we used your goal (${context.goal})`;
  return `Picked ${bucket.mode} mode because ${matched}, with your ${context.panType.toLowerCase()} and ${context.experience.toLowerCase()} experience level in mind.`;
}
