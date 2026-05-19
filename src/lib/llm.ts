import type {
  AdaptationCard,
  CookingContext,
  ExtractedRecipe,
  ImpulseMode,
} from "./options";

type Bucket = {
  mode: ImpulseMode;
  keywords: string[];
  tempRangeF: { min: number; max: number } | null;
  powerLevel: number | null;
  visual: string[];
  auditory: string[];
  smell: string[];
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
    tempRangeF: { min: 450, max: 500 },
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
  },
  {
    mode: "Precise",
    keywords: ["deep fry", "shallow fry", "pan-fry", "fry", "golden brown"],
    tempRangeF: { min: 350, max: 375 },
    powerLevel: null,
    visual: [
      "Bubbles surround food immediately on contact",
      "Edges turn golden within 60–90 seconds",
    ],
    auditory: ["Steady, lively sizzle (not a dull pop, not a roar)"],
    smell: ["Clean fried-food smell; if oil smells sharp, lower the dial"],
  },
  {
    mode: "Precise",
    keywords: ["sauté", "saute", "sweat", "soften", "translucent"],
    tempRangeF: { min: 275, max: 325 },
    powerLevel: null,
    visual: [
      "Onions go translucent without color in ~6–8 min",
      "Butter foams but does not brown",
    ],
    auditory: ["Gentle, intermittent sizzle"],
    smell: ["Sweet, vegetal aromas; no scorching"],
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
    tempRangeF: { min: 180, max: 210 },
    powerLevel: null,
    visual: ["Lazy bubbles breaking the surface every second or two"],
    auditory: ["Quiet, occasional pop — not a constant churn"],
    smell: ["Concentrated, deepening aromas as liquid reduces"],
  },
  {
    mode: "Boost",
    keywords: ["boil", "rolling boil", "blanch", "bring to a boil"],
    tempRangeF: null,
    powerLevel: 10,
    visual: ["Vigorous rolling boil across the whole surface"],
    auditory: ["Constant churn"],
    smell: ["Mostly neutral — watch for any starchy boil-over"],
  },
];

const DEFAULT_BUCKET: Bucket = {
  mode: "Precise",
  keywords: [],
  tempRangeF: { min: 300, max: 350 },
  powerLevel: null,
  visual: ["Food responds within a few seconds of pan contact"],
  auditory: ["A steady but not aggressive sizzle"],
  smell: ["Pleasant cooking aromas, no burn smell"],
};

export async function generateAdaptation(
  recipe: ExtractedRecipe,
  context: CookingContext
): Promise<AdaptationCard> {
  const text = [recipe.title, ...recipe.instructions, ...recipe.ingredients]
    .join(" \n")
    .toLowerCase();

  let bestBucket: Bucket = DEFAULT_BUCKET;
  let bestHits = 0;
  for (const b of BUCKETS) {
    const hits = b.keywords.reduce(
      (n, kw) => n + (text.includes(kw) ? 1 : 0),
      0
    );
    if (hits > bestHits) {
      bestHits = hits;
      bestBucket = b;
    }
  }

  // Goal nudge: if user-selected goal contradicts text, lean toward goal.
  const goalBucket = bucketForGoal(context.goal);
  if (goalBucket && bestHits < 2) {
    bestBucket = goalBucket;
  }

  const panCautions = buildPanCautions(context.panType, bestBucket.mode);
  const safetyReminders = buildSafetyReminders(bestBucket.mode);
  const timingNotes = buildTimingNotes(recipe.instructions, bestBucket.mode);

  const confidence: AdaptationCard["confidence"] =
    bestHits >= 3 ? "high" : bestHits >= 1 ? "medium" : "low";

  const rationale = buildRationale(bestBucket, context, bestHits);

  return {
    impulseMode: bestBucket.mode,
    tempRangeF: bestBucket.tempRangeF,
    powerLevel: bestBucket.powerLevel,
    timingNotes,
    cues: {
      visual: bestBucket.visual.slice(),
      auditory: bestBucket.auditory.slice(),
      smell: bestBucket.smell.slice(),
    },
    panCautions,
    safetyReminders,
    confidence,
    rationale,
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

function buildPanCautions(panType: string, mode: ImpulseMode): string[] {
  const out: string[] = [];
  if (panType.toLowerCase().includes("nonstick")) {
    if (mode === "Sear" || mode === "Boost") {
      out.push(
        "Nonstick coatings degrade above ~400°F. Switch to cast iron or carbon steel for high-heat searing."
      );
    }
    out.push("Use silicone or wood utensils — no metal on the coating.");
  }
  if (panType.toLowerCase().includes("cast iron")) {
    out.push(
      "Induction heats cast iron fast. Preheat at medium first, then step up — sudden high heat can warp."
    );
  }
  if (panType.toLowerCase().includes("carbon steel")) {
    out.push(
      "Keep the seasoning intact: avoid sustained simmering of acidic sauces in this pan."
    );
  }
  if (panType.toLowerCase().includes("enameled")) {
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
  if (mode === "Sear") {
    out.push("Keep a lid within reach in case of a flare-up.");
  }
  return out;
}

function buildTimingNotes(instructions: string[], mode: ImpulseMode): string {
  const minutes: number[] = [];
  const re = /(\d{1,3})\s*(?:to\s*\d{1,3}\s*)?(?:min|minute)/gi;
  for (const step of instructions) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(step)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 240) minutes.push(n);
    }
  }
  if (!minutes.length) {
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
      : `no strong heat keywords found, so we used your goal (${context.goal})`;
  return `Picked ${bucket.mode} mode because ${matched}, with your ${context.panType.toLowerCase()} and ${context.experience.toLowerCase()} experience level in mind.`;
}
