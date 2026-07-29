import type { ExtractedRecipe } from "./options";

export type ExtractionSource = "json-ld" | "microdata" | "manual";

const STOVETOP_TERMS = [
  "heat",
  "saute",
  "fry",
  "sear",
  "brown",
  "simmer",
  "boil",
  "reduce",
  "melt",
  "stir",
  "deglaze",
  "toast",
  "char",
  "scramble",
  "poach",
  "blanch",
  "render",
  "sweat",
  "caramelize",
  "crisp",
  "sizzle",
  "skillet",
  "pan",
  "pot",
  "saucepan",
  "dutch oven",
  "wok",
  "griddle",
];

const STOVETOP_RE = new RegExp(
  `\\b(${STOVETOP_TERMS.map(escapeRegExp).join("|")})\\b`,
  "i"
);

export function detectStovetopSteps(instructions: string[]): boolean[] {
  return instructions.map((step) => STOVETOP_RE.test(normalizeForSearch(step)));
}

export function extractionConfidence(
  source: ExtractionSource,
  recipe: Pick<ExtractedRecipe, "yieldText">
): number {
  if (source === "manual") return 0.3;
  if (source === "microdata") return 0.6;
  return recipe.yieldText ? 1.0 : 0.8;
}

export function withExtractionMetadata(
  recipe: Omit<
    ExtractedRecipe,
    "detectedStovetopSteps" | "extractionConfidence"
  >,
  source: ExtractionSource
): ExtractedRecipe {
  return {
    ...recipe,
    detectedStovetopSteps: detectStovetopSteps(recipe.instructions),
    extractionConfidence: extractionConfidence(source, recipe),
  };
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
