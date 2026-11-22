"use client";

import { useState } from "react";
import type { Feedback, Memory } from "@/lib/types";

type ListKey = "likes" | "dislikes" | "recentMeals" | "notes";

function Chips({
  title,
  items,
  list,
  onRemove,
}: {
  title: string;
  items: string[];
  list: ListKey;
  onRemove: (list: ListKey, index: number) => void;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs text-comment">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted/70">Nada todavía.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((t, i) => (
            <li
              key={`${t}-${i}`}
              className="flex items-center gap-1 rounded-full border border-line bg-background py-0.5 pl-2.5 pr-1 text-xs"
            >
              <span>{t}</span>
              <button
                type="button"
                onClick={() => onRemove(list, i)}
                aria-label={`Quitar ${t}`}
                className="rounded-full px-1.5 text-muted hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MemoryPanel({
  memory,
  onUpdate,
}: {
  memory: Memory | null;
  onUpdate: (fb: Feedback) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  if (!memory) return null;

  const remove = (list: ListKey, index: number) => onUpdate({ action: "remove", list, index });

  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
        <span className="text-purple">Lo que recuerdo de vos</span>
        <span className="text-xs text-muted">
          {memory.likes.length} me sirven · {memory.dislikes.length} rechazos
          <span className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-line px-4 py-4">
        <Chips title="Me sirve" items={memory.likes} list="likes" onRemove={remove} />
        <Chips
          title="Rechazos"
          items={memory.dislikes.map((d) => (d.reason ? `${d.item} (${d.reason})` : d.item))}
          list="dislikes"
          onRemove={remove}
        />
        <Chips
          title="Comidas recientes"
          items={memory.recentMeals.map((r) => r.name)}
          list="recentMeals"
          onRemove={remove}
        />
        <Chips title="Notas fijas" items={memory.notes} list="notes" onRemove={remove} />

        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            await onUpdate({ action: "addNote", note: note.trim() });
            setNote("");
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Nota fija (ej: no como cerdo, tengo microondas y 1 hornalla)"
            className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-1.5 text-sm placeholder:text-comment focus:border-cyan focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-muted"
          >
            Agregar
          </button>
        </form>
      </div>
    </details>
  );
}
