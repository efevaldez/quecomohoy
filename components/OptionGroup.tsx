"use client";

import type { CSSProperties } from "react";

export type Tone = "purple" | "pink" | "cyan" | "green" | "orange" | "yellow";

type Option<T extends string> = { value: T; title: string; hint: string; tone: Tone };

export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-comment">{label}</legend>
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = o.value === value;
          const style = { "--tone": `var(--${o.tone})` } as CSSProperties;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              style={style}
              className={`rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${
                active
                  ? "border-(--tone) bg-[color-mix(in_srgb,var(--tone)_13%,transparent)]"
                  : "border-line bg-surface hover:border-(--tone)/60"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full bg-(--tone) transition-opacity ${
                    active ? "opacity-100" : "opacity-40"
                  }`}
                />
                <span className={active ? "text-(--tone)" : ""}>{o.title}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
