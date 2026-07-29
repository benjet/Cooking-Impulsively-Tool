/**
 * Device profiles.
 *
 * The analysis engine produces a device-neutral cooking plan; an adapter
 * translates it per device (PRD_V2 section 10.1). A profile describes what a
 * device can physically do, so the adapter can clamp, round, and pick
 * terminology without hard-coding any manufacturer.
 *
 * These are static records for now. They move to the `device_profiles` table
 * in Phase B (#6) with the same shape.
 */

export type DeviceMode =
  | "temperature_control"
  | "power_mode"
  | "heat_intensity"
  | "probe_control"
  | "probe_monitoring";

export type DeviceCapabilities = {
  /** Can hold a target surface/liquid temperature. */
  temperatureControl: boolean;
  /** Has a manual power level independent of a temperature target. */
  manualPower: boolean;
  /** Has a heat-intensity setting distinct from a temperature target. */
  heatIntensity: boolean;
  /** Senses the cooking surface rather than inferring from element output. */
  surfaceSensing: boolean;
  /** Can drive the element from a probe reading. */
  probeControl: boolean;
  /** Can report a probe reading without controlling from it. */
  probeMonitoring: boolean;
  /** Supports timers and multi-step sequences. */
  timers: boolean;
  sequences: boolean;
};

export type DeviceProfile = {
  id: string;
  manufacturer: string;
  model: string;
  /**
   * Bumped whenever capabilities change. Stored alongside every adaptation so
   * a firmware change does not silently invalidate historical feedback
   * (PRD_V2 section 26).
   */
  profileVersion: number;
  minTempF: number;
  maxTempF: number;
  /** Smallest selectable step, in Fahrenheit. Drives rounding. */
  tempIncrementF: number;
  /** Power/intensity scale, when the device exposes one. */
  powerLevels: number | null;
  capabilities: DeviceCapabilities;
  /**
   * Device-specific wording, so a card says "Temperature Control" on an
   * Impulse and "surface temperature" on a Control Freak.
   */
  terminology: Partial<Record<DeviceMode, string>>;
  /** Where the numbers above came from, and when they were last checked. */
  documentationSource: string;
  lastVerified: string;
  /**
   * Set when the figures have not been confirmed against primary
   * documentation. Surfaced to admins rather than silently trusted.
   */
  needsVerification?: boolean;
};

export const IMPULSE_COOKTOP: DeviceProfile = {
  id: "impulse-cooktop",
  manufacturer: "Impulse Labs",
  model: "Impulse Cooktop",
  profileVersion: 1,
  minTempF: 68,
  maxTempF: 482,
  tempIncrementF: 1,
  powerLevels: 10,
  capabilities: {
    temperatureControl: true,
    manualPower: true,
    heatIntensity: false,
    surfaceSensing: true,
    probeControl: false,
    probeMonitoring: false,
    timers: true,
    sequences: false,
  },
  terminology: {
    temperature_control: "Temperature Control",
    power_mode: "Power Mode",
  },
  documentationSource:
    "Published product specification, quoted in ENGINEERING.md section D.3 and PRD_V2 section 11.1",
  lastVerified: "2026-07-28",
  // The range and increment come from the project's own documentation rather
  // than a primary manufacturer source. Confirm before this drives public
  // recommendations; PRD_V2 section 26 lists firmware and product changes as a
  // key risk, and a clamped recommendation is only as good as these bounds.
  needsVerification: true,
};

export const DEVICE_PROFILES: DeviceProfile[] = [IMPULSE_COOKTOP];

export const DEFAULT_DEVICE_ID = IMPULSE_COOKTOP.id;

export function getDeviceProfile(id: string): DeviceProfile | undefined {
  return DEVICE_PROFILES.find((d) => d.id === id);
}

/** Falls back to the default profile rather than throwing, so a stale stored id cannot break a card render. */
export function getDeviceProfileOrDefault(id: string | null | undefined): DeviceProfile {
  return (id ? getDeviceProfile(id) : undefined) ?? IMPULSE_COOKTOP;
}

export function supportsMode(profile: DeviceProfile, mode: DeviceMode): boolean {
  switch (mode) {
    case "temperature_control":
      return profile.capabilities.temperatureControl;
    case "power_mode":
      return profile.capabilities.manualPower;
    case "heat_intensity":
      return profile.capabilities.heatIntensity;
    case "probe_control":
      return profile.capabilities.probeControl;
    case "probe_monitoring":
      return profile.capabilities.probeMonitoring;
  }
}

/** Device-specific label for a mode, falling back to a readable default. */
export function modeLabel(profile: DeviceProfile, mode: DeviceMode): string {
  return profile.terminology[mode] ?? mode.replace(/_/g, " ");
}
