"use client";

import { emptyMemory, MemorySchema, type Memory } from "./types";

/**
 * Memoria guardada en el navegador de cada persona (localStorage).
 * Pensado para useSyncExternalStore: getMemory devuelve siempre el mismo
 * objeto hasta que cambia.
 */
const KEY = "qch-memory";
const SERVER_SNAPSHOT: Memory = emptyMemory();

let cache: Memory | null = null;
const listeners = new Set<() => void>();

function load(): Memory {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = MemorySchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {}
  return emptyMemory();
}

export function hasStoredMemory(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function getMemory(): Memory {
  cache ??= load();
  return cache;
}

export function getServerMemory(): Memory {
  return SERVER_SNAPSHOT;
}

export function setMemory(next: Memory): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

export function subscribeMemory(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = load();
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
