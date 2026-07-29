import { describe, it, expect } from "vitest";
import { normalizeAdaptation } from "./adaptation";
import { DEFAULT_DEVICE_ID } from "./devices";
import type { AdaptationCard, AdaptationCardV1 } from "./options";

const v1: AdaptationCardV1 = {
  impulseMode: "Simmer",
  tempRangeF: { min: 180, max: 210 },
  powerLevel: null,
  timingNotes: "Simmers track close to gas timings.",
  cues: { visual: ["Lazy bubbles"], auditory: [], smell: [] },
  panCautions: ["Avoid temperatures above 400°F in nonstick."],
  safetyReminders: ["Don't leave hot oil unattended."],
  confidence: "medium",
  rationale: "Legacy card.",
};

describe("normalizeAdaptation", () => {
  it("converts a v1 temperature range into a token", () => {
    const card = normalizeAdaptation(v1);
    expect(card.schemaVersion).toBe(2);
    expect(card.settingTokenKey).toBe("temp_setting");
    expect(card.temps.temp_setting).toMatchObject({
      f: 180,
      f_max: 210,
      kind: "range",
    });
  });

  it("defaults a v1 card to the Impulse profile", () => {
    expect(normalizeAdaptation(v1).deviceProfileId).toBe(DEFAULT_DEVICE_ID);
  });

  it("leaves legacy prose untouched", () => {
    // We cannot safely tokenize text we did not generate, so a legacy card's
    // embedded temperature stays in Fahrenheit and will not follow the
    // toggle. Asserted so the limitation is deliberate, not a surprise.
    const card = normalizeAdaptation(v1);
    expect(card.panCautions[0]).toContain("400°F");
  });

  it("handles a v1 card with no temperature range", () => {
    const card = normalizeAdaptation({ ...v1, tempRangeF: null, powerLevel: 10 });
    expect(card.settingTokenKey).toBeNull();
    expect(card.temps).toEqual({});
    expect(card.powerLevel).toBe(10);
  });

  it("passes a v2 card through unchanged", () => {
    const v2: AdaptationCard = {
      schemaVersion: 2,
      deviceProfileId: "impulse-cooktop",
      deviceProfileVersion: 1,
      impulseMode: "Sear",
      temps: {
        temp_setting: {
          f: 450,
          f_max: 500,
          kind: "range",
          precision: "whole",
          context: "sear_target",
        },
      },
      settingTokenKey: "temp_setting",
      powerLevel: null,
      timingNotes: "Start checking early.",
      rationale: "Matched sear keywords.",
      panCautions: [],
      safetyReminders: [],
      cues: { visual: [], auditory: [], smell: [] },
      confidence: "high",
    };
    expect(normalizeAdaptation(v2)).toEqual(v2);
  });

  it("survives a malformed row without throwing", () => {
    // A card page must never 500 because a stored blob is unexpected.
    const card = normalizeAdaptation({});
    expect(card.schemaVersion).toBe(2);
    expect(card.confidence).toBe("low");
    expect(card.cues).toEqual({ visual: [], auditory: [], smell: [] });
  });
});
