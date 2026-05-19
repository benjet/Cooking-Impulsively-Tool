export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "rounded-md border border-amber-300 bg-amber-50 text-amber-900 " +
        (compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm")
      }
    >
      <strong>Independent project.</strong> Cooking Impulsively is not
      affiliated with, endorsed by, or sponsored by Impulse Labs. Always use
      this card alongside the original recipe and your own judgment.
    </div>
  );
}
