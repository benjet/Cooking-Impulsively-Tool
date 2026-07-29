"use client";

import { useMemo, type ReactNode } from "react";
import { useUnit } from "@/contexts/UnitContext";
import {
  renderTemperature,
  TOKEN_PATTERN,
  type TemperatureObject,
} from "@/lib/temperature";
import type { DeviceProfile } from "@/lib/devices";

type Props = {
  template: string;
  temps: Record<string, TemperatureObject>;
  nerdMode?: boolean;
  device?: DeviceProfile;
  className?: string;
};

/**
 * Resolves {{temp_n}} placeholders against the temps dictionary and formats
 * each one in the viewer's current unit. Switching units re-renders this
 * component and nothing else — no refetch, no regeneration.
 */
export function NarrativeText({
  template,
  temps,
  nerdMode = false,
  device,
  className,
}: Props) {
  const { unit } = useUnit();

  const parts = useMemo<ReactNode[]>(() => {
    const out: ReactNode[] = [];
    let lastIndex = 0;

    // The pattern is module-level and stateful with /g, so iterate over a
    // fresh regex rather than mutating shared lastIndex.
    const pattern = new RegExp(TOKEN_PATTERN.source, "g");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(template)) !== null) {
      const [full, key] = match;
      if (match.index > lastIndex) {
        out.push(template.slice(lastIndex, match.index));
      }

      const temp = temps?.[key];
      if (temp) {
        out.push(
          <TemperatureSpan key={`${key}-${match.index}`} temp={temp}>
            {renderTemperature(temp, { unit, nerdMode, device })}
          </TemperatureSpan>
        );
      } else {
        // Render the raw placeholder rather than dropping it: a visibly broken
        // card is far safer than one that silently omits a temperature.
        out.push(
          <span key={`missing-${match.index}`} className="text-red-600">
            {full}
          </span>
        );
      }

      lastIndex = match.index + full.length;
    }

    if (lastIndex < template.length) out.push(template.slice(lastIndex));
    return out;
  }, [template, temps, unit, nerdMode, device]);

  return <span className={className}>{parts}</span>;
}

function TemperatureSpan({
  temp,
  children,
}: {
  temp: TemperatureObject;
  children: ReactNode;
}) {
  const label =
    temp.kind === "safety"
      ? `Food safety temperature: ${temp.context.replace(/_/g, " ")}`
      : `Temperature: ${temp.context.replace(/_/g, " ")}`;

  return (
    <span
      className={
        temp.kind === "safety"
          ? "font-semibold text-stone-900"
          : "font-medium text-stone-900"
      }
      aria-label={label}
      data-context={temp.context}
      data-kind={temp.kind}
    >
      {children}
    </span>
  );
}
