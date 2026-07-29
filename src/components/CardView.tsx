"use client";

import type { AdaptationCard } from "@/lib/options";
import { getDeviceProfileOrDefault, modeLabel } from "@/lib/devices";
import { renderTemperature } from "@/lib/temperature";
import { useUnit } from "@/contexts/UnitContext";
import { NarrativeText } from "./NarrativeText";
import { UnitToggle } from "./UnitToggle";

type Props = {
  title: string;
  sourceName: string | null;
  sourceUrl: string | null;
  yieldText: string | null;
  panType: string;
  experience: string;
  goal: string;
  adaptation: AdaptationCard;
};

export function CardView(props: Props) {
  const { adaptation: a } = props;
  const { unit } = useUnit();
  const device = getDeviceProfileOrDefault(a.deviceProfileId);

  // Nerd mode shows both units at once (PRD_V2 section 14).
  const nerdMode = props.experience.toLowerCase().includes("nerd");

  const settingTemp = a.settingTokenKey ? a.temps[a.settingTokenKey] : undefined;
  const settingLabel = settingTemp
    ? renderTemperature(settingTemp, { unit, nerdMode, device })
    : a.powerLevel !== null
    ? `Power ${a.powerLevel}/10`
    : "—";

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="text-xs uppercase tracking-wider text-impulse-700">
            {device.manufacturer} adaptation card
          </div>
          <UnitToggle />
        </div>
        <h1 className="text-3xl font-bold text-stone-900">{props.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-stone-600">
          {props.sourceUrl ? (
            <a
              href={props.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-impulse-700 hover:underline font-medium"
            >
              Open the original recipe →
            </a>
          ) : null}
          {props.sourceName && <span>at {props.sourceName}</span>}
          {props.yieldText && <span>· {props.yieldText}</span>}
        </div>
      </header>

      <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <StatTile
            label={modeLabel(device, "temperature_control")}
            value={a.impulseMode}
            accent
          />
          <StatTile label="Setting" value={settingLabel} />
          <StatTile
            label="Confidence"
            value={a.confidence}
            tone={
              a.confidence === "high"
                ? "good"
                : a.confidence === "low"
                ? "warn"
                : "neutral"
            }
          />
        </div>

        <p className="text-stone-700">
          <NarrativeText
            template={a.rationale}
            temps={a.temps}
            nerdMode={nerdMode}
            device={device}
          />
        </p>

        <Section title="Timing">
          <p>
            <NarrativeText
              template={a.timingNotes}
              temps={a.temps}
              nerdMode={nerdMode}
              device={device}
            />
          </p>
        </Section>

        <Section title="What to look for">
          <Cues label="Visual" items={a.cues.visual} />
          <Cues label="Auditory" items={a.cues.auditory} />
          <Cues label="Smell" items={a.cues.smell} />
        </Section>

        {a.panCautions.length > 0 && (
          <Section title={`Pan notes — ${props.panType}`}>
            <TemplateList
              items={a.panCautions}
              temps={a.temps}
              nerdMode={nerdMode}
              deviceId={a.deviceProfileId}
            />
          </Section>
        )}

        <Section title="Safety">
          {/* Food-safety figures always render in both units regardless of the
              toggle, so this list is intentionally not device-clamped. */}
          <TemplateList
            items={a.safetyReminders}
            temps={a.temps}
            nerdMode={nerdMode}
            deviceId={a.deviceProfileId}
          />
        </Section>

        <Section title="Your context">
          <div className="flex flex-wrap gap-2 text-sm">
            <Pill>{device.model}</Pill>
            <Pill>{props.panType}</Pill>
            <Pill>{props.experience}</Pill>
            <Pill>{props.goal}</Pill>
          </div>
        </Section>
      </div>
    </article>
  );
}

function TemplateList({
  items,
  temps,
  nerdMode,
  deviceId,
}: {
  items: string[];
  temps: AdaptationCard["temps"];
  nerdMode: boolean;
  deviceId: string;
}) {
  const device = getDeviceProfileOrDefault(deviceId);
  return (
    <ul className="list-disc list-inside space-y-1">
      {items.map((item, i) => (
        <li key={i}>
          <NarrativeText
            template={item}
            temps={temps}
            nerdMode={nerdMode}
            device={device}
          />
        </li>
      ))}
    </ul>
  );
}

function StatTile({
  label,
  value,
  accent,
  tone = "neutral",
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : tone === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : accent
      ? "bg-impulse-50 border-impulse-200 text-impulse-900"
      : "bg-stone-50 border-stone-200 text-stone-900";
  return (
    <div className={"rounded border p-3 " + toneClass}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-semibold capitalize mt-1">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-stone-900">{title}</h2>
      <div className="text-stone-700 text-sm space-y-2">{children}</div>
    </section>
  );
}

function Cues({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <ul className="list-disc list-inside">
        {items.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-stone-100 border border-stone-200 px-3 py-1">
      {children}
    </span>
  );
}
