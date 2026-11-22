import { MEMORY_LIMITS, type Feedback, type Memory } from "./types";

const today = () => new Date().toISOString().slice(0, 10);
const norm = (s: string) => s.trim().toLowerCase();

/** Aplica un feedback y devuelve una memoria nueva (no muta la original). */
export function applyFeedback(prev: Memory, fb: Feedback): Memory {
  const m: Memory = {
    likes: [...prev.likes],
    dislikes: [...prev.dislikes],
    recentMeals: [...prev.recentMeals],
    notes: [...prev.notes],
  };

  switch (fb.action) {
    case "like": {
      const names = fb.meals.length ? fb.meals : [fb.title];
      for (const name of names) m.recentMeals.unshift({ name, date: today() });
      if (!m.likes.some((l) => norm(l) === norm(fb.title))) m.likes.unshift(fb.title);
      break;
    }
    case "dislike": {
      const item = fb.item.trim();
      m.dislikes = m.dislikes.filter((d) => norm(d.item) !== norm(item));
      m.dislikes.unshift({ item, reason: fb.reason?.trim() || undefined, date: today() });
      break;
    }
    case "addNote": {
      const note = fb.note.trim();
      if (!m.notes.some((n) => norm(n) === norm(note))) m.notes.push(note);
      break;
    }
    case "remove": {
      (m[fb.list] as unknown[]).splice(fb.index, 1);
      break;
    }
  }

  m.likes = m.likes.slice(0, MEMORY_LIMITS.likes);
  m.dislikes = m.dislikes.slice(0, MEMORY_LIMITS.dislikes);
  m.recentMeals = m.recentMeals.slice(0, MEMORY_LIMITS.recentMeals);
  m.notes = m.notes.slice(0, MEMORY_LIMITS.notes);
  return m;
}
