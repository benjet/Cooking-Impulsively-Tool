/**
 * Temperature tokens and rendering.
 *
 * Canonical storage is always Fahrenheit; Celsius is derived at the
 * presentation layer (PRD_V2 section 14). Nothing downstream of this module
 * should ever embed a temperature in prose — narrative text carries
 * {{temp_n}} placeholders resolved against a `temps` dictionary, which is what
 * makes unit switching a re-render instead of a regeneration.
 *
 * Pure functions only, no React. See ENGINEERING.md section F.3.
 */

import type { DeviceProfile } from "./devices";

export type TempUnit = "F" | "C";

export type TempKind = "point" | "range" | "threshold" | "safety";

export type TempPrecision = "whole" | "decimal_1" | "decimal_2";

export type TemperatureObject = {
  /** Canonical Fahrenheit value. */
  f: number;
  /** Upper bound, required when kind is "range". */
  f_max?: number;
  kind: TempKind;
  precision: TempPrecision;
  /** Short semantic label, e.g. "saute_start" or "internal_poultry". */
  context: string;
  /**
   * Internal food temperatures always display in both units regardless of the
   * viewer's preference. Underdone chicken is a safety issue, not a styling
   * preference (PRD_V2 section 13).
   */
  force_both_units?: boolean;
};

export const NIST_F_OFFSET = 32;
export const NIST_F_RATIO = 1.8;

export function fToC(f: number): number {
  return (f - NIST_F_OFFSET) / NIST_F_RATIO;
}

export function cToF(c: number): number {
  return c * NIST_F_RATIO + NIST_F_OFFSET;
}

export function formatTemp(
  value: number,
  unit: TempUnit,
  precision: TempPrecision
): string {
  switch (precision) {
    case "whole":
      return `${Math.round(value)}°${unit}`;
    case "decimal_1":
      return `${value.toFixed(1)}°${unit}`;
    case "decimal_2":
      return `${value.toFixed(2)}°${unit}`;
  }
}

/** Snap to the smallest step the device can actually select. */
export function roundToIncrement(f: number, incrementF: number): number {
  if (incrementF <= 0) return f;
  return Math.round(f / incrementF) * incrementF;
}

export type ClampResult = {
  value: number;
  /** True when the requested temperature was outside the device's range. */
  clamped: boolean;
};

/**
 * Constrain a temperature to what the device can reach. The adapter surfaces
 * `clamped` in risk notes rather than silently pretending the setting is
 * achievable (ENGINEERING.md section D.3 rule 9).
 */
export function clampToDevice(f: number, profile: DeviceProfile): ClampResult {
  if (f < profile.minTempF) return { value: profile.minTempF, clamped: true };
  if (f > profile.maxTempF) return { value: profile.maxTempF, clamped: true };
  return { value: f, clamped: false };
}

/**
 * Apply device constraints in Fahrenheit, the device-native unit, before any
 * display conversion. A Celsius viewer should still see a value that
 * corresponds to a dial position the device can actually hit.
 */
export function applyDevice(f: number, profile: DeviceProfile): number {
  return roundToIncrement(clampToDevice(f, profile).value, profile.tempIncrementF);
}

export type RenderOptions = {
  unit: TempUnit;
  /** Show both units for every temperature, not just safety ones. */
  nerdMode?: boolean;
  /** When supplied, clamp and round to this device before formatting. */
  device?: DeviceProfile;
};

export function renderTemperature(
  temp: TemperatureObject,
  opts: RenderOptions
): string {
  const showBoth = temp.force_both_units === true || opts.nerdMode === true;

  // Safety thresholds describe the food, not the appliance, so device limits
  // must never be applied to them: clamping 165°F to a device range would
  // silently rewrite a food-safety figure.
  const constrain = (f: number) =>
    opts.device && temp.kind !== "safety" ? applyDevice(f, opts.device) : f;

  const fValue = constrain(temp.f);
  const fStr = formatTemp(fValue, "F", temp.precision);
  const cStr = formatTemp(fToC(fValue), "C", temp.precision);

  if (temp.kind === "range" && temp.f_max !== undefined) {
    const fMax = constrain(temp.f_max);
    const fMaxStr = formatTemp(fMax, "F", temp.precision);
    const cMaxStr = formatTemp(fToC(fMax), "C", temp.precision);

    if (showBoth) {
      return opts.unit === "F"
        ? `${fStr} to ${fMaxStr} (${cStr} to ${cMaxStr})`
        : `${cStr} to ${cMaxStr} (${fStr} to ${fMaxStr})`;
    }
    return opts.unit === "F"
      ? `${fStr} to ${fMaxStr}`
      : `${cStr} to ${cMaxStr}`;
  }

  if (showBoth) {
    return opts.unit === "F" ? `${fStr} (${cStr})` : `${cStr} (${fStr})`;
  }
  return opts.unit === "F" ? fStr : cStr;
}

/** Matches {{temp_n}} placeholders. Kept here so parser and emitter agree. */
export const TOKEN_PATTERN = /\{\{(temp_[a-z0-9_]+)\}\}/g;

/**
 * Rejects prose that hard-codes a temperature. Used by the eval harness and
 * as a guard on generated output (ENGINEERING.md section D.8).
 */
export const PLAIN_TEMP_PATTERN = /\d+\s*°?\s*[FC]\b/;

export function containsPlainTextTemperature(text: string): boolean {
  return PLAIN_TEMP_PATTERN.test(text);
}

export type TokenAudit = {
  /** Tokens referenced in the template with no matching temps entry. */
  unresolved: string[];
  /** temps entries never referenced by the template. */
  unused: string[];
};

export function auditTokens(
  template: string,
  temps: Record<string, TemperatureObject>
): TokenAudit {
  const referenced = [...template.matchAll(TOKEN_PATTERN)].map((m) => m[1]);
  const defined = Object.keys(temps ?? {});
  return {
    unresolved: referenced.filter((t) => !defined.includes(t)),
    unused: defined.filter((k) => !referenced.includes(k)),
  };
}

/**
 * Normalize a user-entered temperature to both units, preserving what they
 * actually typed. A bare "170" is 76 degrees apart depending on unit, so the
 * entered unit has to survive alongside the normalized values
 * (PRD_V2 section 14, ENGINEERING.md section F.7).
 */
export type NormalizedEntry = {
  input: number;
  unit: TempUnit;
  f: number;
  c: number;
};

export function normalizeEntry(input: number, unit: TempUnit): NormalizedEntry {
  return unit === "F"
    ? { input, unit, f: input, c: fToC(input) }
    : { input, unit, f: cToF(input), c: input };
}

const FAHRENHEIT_REGIONS = new Set(["US", "LR", "BS", "BZ", "KY", "PW", "FM", "MH"]);

/** Locale-based default. Explicit user choice always wins over this. */
export function defaultUnitForLocale(locale: string | undefined): TempUnit {
  if (!locale) return "F";
  const region = locale.split("-")[1]?.toUpperCase();
  if (!region) return "F";
  return FAHRENHEIT_REGIONS.has(region) ? "F" : "C";
}
