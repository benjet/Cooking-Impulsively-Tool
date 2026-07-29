"use client";

import { useUnit } from "@/contexts/UnitContext";
import type { TempUnit } from "@/lib/temperature";

/**
 * Two buttons rather than a switch: neither unit is "the default" once a cook
 * has chosen, and aria-pressed states the active option plainly to screen
 * readers. Toggling only re-renders — it never regenerates the card.
 */
export function UnitToggle({ className = "" }: { className?: string }) {
  const { unit, setUnit } = useUnit();

  return (
    <div
      className={`inline-flex rounded border border-stone-300 overflow-hidden text-sm ${className}`}
      role="group"
      aria-label="Temperature unit"
    >
      {(["F", "C"] as TempUnit[]).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          aria-pressed={unit === u}
          className={
            "px-3 py-1.5 " +
            (unit === u
              ? "bg-impulse-600 text-white"
              : "bg-white text-stone-600 hover:bg-stone-50")
          }
        >
          °{u}
        </button>
      ))}
    </div>
  );
}
