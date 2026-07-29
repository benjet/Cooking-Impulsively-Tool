import type { AdaptationCard, AdaptationCardV1 } from "./options";
import { DEFAULT_DEVICE_ID, IMPULSE_COOKTOP } from "./devices";
import type { TemperatureObject } from "./temperature";

/**
 * Upgrade a stored adaptation to the current shape.
 *
 * Rows written before tokenization hold prose temperatures and a
 * `tempRangeF` object. Those cards still have to render, so convert the range
 * into a token and leave the prose alone — legacy narrative text simply
 * contains no tokens and renders verbatim. It will not switch units, which is
 * correct: we cannot safely rewrite text we did not tokenize.
 */
export function normalizeAdaptation(raw: unknown): AdaptationCard {
  const card = raw as Partial<AdaptationCard> & Partial<AdaptationCardV1>;

  if (card && (card as AdaptationCard).schemaVersion === 2) {
    const v2 = card as AdaptationCard;
    return { ...v2, temps: v2.temps ?? {} };
  }

  const v1 = card as AdaptationCardV1;
  const temps: Record<string, TemperatureObject> = {};
  let settingTokenKey: string | null = null;

  if (v1?.tempRangeF) {
    settingTokenKey = "temp_setting";
    temps.temp_setting = {
      f: v1.tempRangeF.min,
      f_max: v1.tempRangeF.max,
      kind: "range",
      precision: "whole",
      context: "legacy_target",
    };
  }

  return {
    schemaVersion: 2,
    deviceProfileId: DEFAULT_DEVICE_ID,
    deviceProfileVersion: IMPULSE_COOKTOP.profileVersion,
    impulseMode: v1?.impulseMode ?? "Custom",
    temps,
    settingTokenKey,
    powerLevel: v1?.powerLevel ?? null,
    timingNotes: v1?.timingNotes ?? "",
    rationale: v1?.rationale ?? "",
    panCautions: v1?.panCautions ?? [],
    safetyReminders: v1?.safetyReminders ?? [],
    cues: v1?.cues ?? { visual: [], auditory: [], smell: [] },
    confidence: v1?.confidence ?? "low",
  };
}
