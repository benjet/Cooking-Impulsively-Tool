"use client";

type Props = {
  items: string[];
  onChange: (next: string[]) => void;
  label: string;
  placeholder: string;
};

export function ListEditor({ items, onChange, label, placeholder }: Props) {
  function update(i: number, v: string) {
    const next = items.slice();
    next[i] = v;
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, ""]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-medium text-stone-800">{label}</label>
        <button
          type="button"
          onClick={add}
          className="text-sm text-impulse-700 hover:underline"
        >
          + Add
        </button>
      </div>
      <ol className="space-y-2 list-decimal list-inside">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="pt-2 text-stone-400 w-6 text-right">{i + 1}.</span>
            <textarea
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm min-h-[2.25rem]"
              rows={Math.min(6, Math.max(1, Math.ceil(item.length / 80)))}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-stone-400 hover:text-red-600 text-sm pt-2"
              aria-label="Remove"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      {items.length === 0 && (
        <div className="text-sm text-stone-500">
          No entries yet — click <em>+ Add</em> to start.
        </div>
      )}
    </div>
  );
}
