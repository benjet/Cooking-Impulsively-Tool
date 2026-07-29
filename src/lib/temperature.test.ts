import { describe, it, expect } from "vitest";
import {
  fToC,
  cToF,
  renderTemperature,
  roundToIncrement,
  clampToDevice,
  auditTokens,
  containsPlainTextTemperature,
  normalizeEntry,
  defaultUnitForLocale,
  type TemperatureObject,
} from "./temperature";
import { IMPULSE_COOKTOP, type DeviceProfile } from "./devices";

const point = (f: number): TemperatureObject => ({
  f,
  kind: "point",
  precision: "whole",
  context: "test",
});

describe("conversion", () => {
  it("converts F to C at the reference points", () => {
    expect(fToC(212)).toBeCloseTo(100, 5);
    expect(fToC(32)).toBeCloseTo(0, 5);
    expect(fToC(335)).toBeCloseTo(168.33, 2);
  });

  it("converts C to F at the reference points", () => {
    expect(cToF(100)).toBeCloseTo(212, 5);
    expect(cToF(0)).toBeCloseTo(32, 5);
    expect(cToF(168)).toBeCloseTo(334.4, 2);
  });

  it("round-trips without drift", () => {
    for (const f of [68, 212, 335, 482]) {
      expect(cToF(fToC(f))).toBeCloseTo(f, 10);
    }
  });
});

describe("renderTemperature", () => {
  it("renders a point temperature in the selected unit", () => {
    expect(renderTemperature(point(335), { unit: "F" })).toBe("335°F");
    expect(renderTemperature(point(335), { unit: "C" })).toBe("168°C");
  });

  it("converts both endpoints of a range", () => {
    const range: TemperatureObject = {
      f: 330,
      f_max: 350,
      kind: "range",
      precision: "whole",
      context: "test",
    };
    expect(renderTemperature(range, { unit: "F" })).toBe("330°F to 350°F");
    expect(renderTemperature(range, { unit: "C" })).toBe("166°C to 177°C");
  });

  it("forces both units for safety temperatures in either direction", () => {
    const safety: TemperatureObject = {
      f: 165,
      kind: "safety",
      precision: "whole",
      context: "internal_poultry",
      force_both_units: true,
    };
    expect(renderTemperature(safety, { unit: "F" })).toBe("165°F (74°C)");
    expect(renderTemperature(safety, { unit: "C" })).toBe("74°C (165°F)");
  });

  it("shows both units in nerd mode for ordinary temperatures", () => {
    expect(renderTemperature(point(335), { unit: "F", nerdMode: true })).toBe(
      "335°F (168°C)"
    );
    expect(renderTemperature(point(335), { unit: "C", nerdMode: true })).toBe(
      "168°C (335°F)"
    );
  });

  it("preserves decimal precision for high-risk techniques", () => {
    const sugar: TemperatureObject = {
      f: 300,
      kind: "threshold",
      precision: "decimal_1",
      context: "sugar_hard_crack",
    };
    expect(renderTemperature(sugar, { unit: "F" })).toBe("300.0°F");
    expect(renderTemperature(sugar, { unit: "C" })).toBe("148.9°C");
  });
});

describe("device constraints", () => {
  const coarse: DeviceProfile = {
    ...IMPULSE_COOKTOP,
    id: "test-coarse",
    tempIncrementF: 25,
    minTempF: 100,
    maxTempF: 400,
  };

  it("rounds to the device increment", () => {
    expect(roundToIncrement(337, 25)).toBe(325);
    expect(roundToIncrement(338, 25)).toBe(350);
    expect(roundToIncrement(335, 1)).toBe(335);
  });

  it("treats a non-positive increment as no rounding", () => {
    expect(roundToIncrement(337.4, 0)).toBe(337.4);
  });

  it("clamps to the device range and reports that it did", () => {
    expect(clampToDevice(50, IMPULSE_COOKTOP)).toEqual({
      value: 68,
      clamped: true,
    });
    expect(clampToDevice(600, IMPULSE_COOKTOP)).toEqual({
      value: 482,
      clamped: true,
    });
    expect(clampToDevice(335, IMPULSE_COOKTOP)).toEqual({
      value: 335,
      clamped: false,
    });
  });

  it("applies rounding before display, in the device-native unit", () => {
    expect(renderTemperature(point(337), { unit: "F", device: coarse })).toBe(
      "325°F"
    );
    // A Celsius viewer still sees a value the device can actually select.
    expect(renderTemperature(point(337), { unit: "C", device: coarse })).toBe(
      "163°C"
    );
  });

  it("clamps out-of-range recommendations", () => {
    expect(renderTemperature(point(600), { unit: "F", device: coarse })).toBe(
      "400°F"
    );
  });

  it("never applies device limits to safety temperatures", () => {
    // 165°F internal is a property of the chicken, not the cooktop. A device
    // with a 200°F floor must not rewrite it to 200.
    const hot: DeviceProfile = { ...coarse, minTempF: 200, tempIncrementF: 1 };
    const safety: TemperatureObject = {
      f: 165,
      kind: "safety",
      precision: "whole",
      context: "internal_poultry",
      force_both_units: true,
    };
    expect(renderTemperature(safety, { unit: "F", device: hot })).toBe(
      "165°F (74°C)"
    );
  });

  it("rounds both ends of a range", () => {
    const range: TemperatureObject = {
      f: 330,
      f_max: 356,
      kind: "range",
      precision: "whole",
      context: "test",
    };
    expect(renderTemperature(range, { unit: "F", device: coarse })).toBe(
      "325°F to 350°F"
    );
  });
});

describe("token auditing", () => {
  it("passes when every token resolves and every temp is used", () => {
    const audit = auditTokens("Start at {{temp_1}} then drop to {{temp_2}}.", {
      temp_1: point(335),
      temp_2: point(285),
    });
    expect(audit).toEqual({ unresolved: [], unused: [] });
  });

  it("reports a token with no matching temps entry", () => {
    const audit = auditTokens("Start at {{temp_1}}, then {{temp_2}}.", {
      temp_1: point(335),
    });
    expect(audit.unresolved).toEqual(["temp_2"]);
  });

  it("reports a temps entry the template never references", () => {
    const audit = auditTokens("Start at {{temp_1}}.", {
      temp_1: point(335),
      temp_orphan: point(400),
    });
    expect(audit.unused).toEqual(["temp_orphan"]);
  });

  it("handles a template with no tokens", () => {
    expect(auditTokens("Stir gently.", {})).toEqual({
      unresolved: [],
      unused: [],
    });
  });
});

describe("plain-text temperature guard", () => {
  it("rejects prose that hard-codes a temperature", () => {
    expect(containsPlainTextTemperature("Start at 335°F and hold.")).toBe(true);
    expect(containsPlainTextTemperature("Start at 335 F and hold.")).toBe(true);
    expect(containsPlainTextTemperature("Hold at 168°C.")).toBe(true);
  });

  it("accepts tokenized prose", () => {
    expect(
      containsPlainTextTemperature("Start at {{temp_1}} and hold.")
    ).toBe(false);
  });

  it("does not fire on ordinary numbers", () => {
    expect(containsPlainTextTemperature("Cook for 5 minutes.")).toBe(false);
  });
});

describe("normalizeEntry", () => {
  it("preserves what the user typed alongside both normalized values", () => {
    // The case that makes this necessary: a bare 170 is 76 degrees apart
    // depending on which unit the cook meant.
    const asC = normalizeEntry(170, "C");
    expect(asC.input).toBe(170);
    expect(asC.unit).toBe("C");
    expect(asC.c).toBe(170);
    expect(asC.f).toBeCloseTo(338, 5);

    const asF = normalizeEntry(170, "F");
    expect(asF.f).toBe(170);
    expect(asF.c).toBeCloseTo(76.67, 2);
  });
});

describe("defaultUnitForLocale", () => {
  it("defaults US and other Fahrenheit regions to F", () => {
    expect(defaultUnitForLocale("en-US")).toBe("F");
    expect(defaultUnitForLocale("en-BZ")).toBe("F");
  });

  it("defaults everywhere else to C", () => {
    expect(defaultUnitForLocale("en-GB")).toBe("C");
    expect(defaultUnitForLocale("fr-FR")).toBe("C");
    expect(defaultUnitForLocale("ja-JP")).toBe("C");
  });

  it("falls back to F when the locale carries no region", () => {
    expect(defaultUnitForLocale("en")).toBe("F");
    expect(defaultUnitForLocale(undefined)).toBe("F");
  });
});
