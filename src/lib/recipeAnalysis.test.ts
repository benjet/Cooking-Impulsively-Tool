import { describe, it, expect } from "vitest";
import {
  detectStovetopSteps,
  extractionConfidence,
  withExtractionMetadata,
} from "./recipeAnalysis";

describe("detectStovetopSteps", () => {
  it("flags steps containing heat verbs", () => {
    expect(
      detectStovetopSteps([
        "Heat the skillet over medium-high heat.",
        "Chop the onions finely.",
      ])
    ).toEqual([true, false]);
  });

  it("matches accented terms by normalizing diacritics", () => {
    expect(detectStovetopSteps(["Sauté the shallots until soft."])).toEqual([
      true,
    ]);
  });

  it("returns one result per instruction, preserving order", () => {
    const steps = ["Whisk the eggs.", "Sear the steak.", "Slice and serve."];
    expect(detectStovetopSteps(steps)).toHaveLength(steps.length);
    expect(detectStovetopSteps(steps)).toEqual([false, true, false]);
  });

  it("does not match a term embedded in a longer word", () => {
    // "pan" must not fire on "pancakes"; word boundaries are load-bearing.
    expect(detectStovetopSteps(["Serve the pancakes warm."])).toEqual([false]);
  });

  it("returns an empty array for no instructions", () => {
    expect(detectStovetopSteps([])).toEqual([]);
  });

  // Known limitation, asserted so a future precision fix is a deliberate
  // change rather than an accidental one. These are oven and off-heat steps
  // that the keyword pre-filter cannot currently distinguish.
  it("currently false-positives on non-stovetop uses of its terms", () => {
    expect(
      detectStovetopSteps([
        "Transfer to a baking pan and bake for 20 minutes.",
        "Stir in the vanilla once cooled.",
      ])
    ).toEqual([true, true]);
  });
});

describe("extractionConfidence", () => {
  it("scores complete JSON-LD highest", () => {
    expect(extractionConfidence("json-ld", { yieldText: "4 servings" })).toBe(
      1.0
    );
  });

  it("discounts JSON-LD that is missing yield", () => {
    expect(extractionConfidence("json-ld", { yieldText: null })).toBe(0.8);
  });

  it("scores microdata below JSON-LD", () => {
    expect(extractionConfidence("microdata", { yieldText: "4" })).toBe(0.6);
  });

  it("scores manual entry lowest", () => {
    expect(extractionConfidence("manual", { yieldText: "4" })).toBe(0.3);
  });

  it("keeps microdata and manual below the low-confidence warning threshold", () => {
    // The confirm screen warns below 0.7; both fallback paths must trip it.
    expect(
      extractionConfidence("microdata", { yieldText: "4" })
    ).toBeLessThan(0.7);
    expect(extractionConfidence("manual", { yieldText: "4" })).toBeLessThan(0.7);
  });
});

describe("withExtractionMetadata", () => {
  const base = {
    title: "Test",
    sourceName: null,
    sourceUrl: null,
    yieldText: "2 servings",
    ingredients: ["1 tbsp butter"],
    instructions: ["Melt the butter in a pan.", "Season to taste."],
  };

  it("attaches both derived fields without mutating the input", () => {
    const result = withExtractionMetadata(base, "json-ld");
    expect(result.detectedStovetopSteps).toEqual([true, false]);
    expect(result.extractionConfidence).toBe(1.0);
    expect(base).not.toHaveProperty("detectedStovetopSteps");
  });

  it("keeps the step array aligned with the instruction array", () => {
    const result = withExtractionMetadata(base, "microdata");
    expect(result.detectedStovetopSteps).toHaveLength(base.instructions.length);
  });
});
