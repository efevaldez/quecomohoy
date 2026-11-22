"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MemoryPanel } from "@/components/MemoryPanel";
import { OptionGroup, type Tone } from "@/components/OptionGroup";
import { PlanView } from "@/components/PlanView";
import {
  ENERGY_LABELS,
  ENERGY_MODES,
  FORMAT_LABELS,
  OUTPUT_FORMATS,
  type EnergyMode,
  MemorySchema,
  type Feedback,
  type OutputFormat,
  type Plan,
} from "@/lib/types";
import { applyFeedback } from "@/lib/memory";
import {
  getMemory,
  getServerMemory,
  hasStoredMemory,
  setMemory,
  subscribeMemory,
} from "@/lib/memoryStore";

const ENERGY_TONES: Record<EnergyMode, Tone> = { zombie: "green", normal: "purple", finde: "orange" };
const FORMAT_TONES: Record<OutputFormat, Tone> = { idea: "cyan", combo: "pink", compra: "yellow" };

const energyOptions = ENERGY_MODES.map((v) => ({ value: v, tone: ENERGY_TONES[v], ...ENERGY_LABELS[v] }));
const formatOptions = OUTPUT_FORMATS.map((v) => ({ value: v, tone: FORMAT_TONES[v], ...FORMAT_LABELS[v] }));

type FeedbackState = "idle" | "liked" | "skipping";

/* Preferencia "Saludable", recordada en este navegador. */
const HEALTHY_KEY = "healthy";
const HEALTHY_EVENT = "healthy-change";
let healthyFallback = false; // si localStorage no está disponible

function readHealthy(): boolean {
  try {
    const v = localStorage.getItem(HEALTHY_KEY);
    if (v !== null) healthyFallback = v === "1";
  } catch {}
  return healthyFallback;
}

function subscribeHealthy(onChange: () => void) {
  const handler = () => {
    try {
      localStorage.getItem(HEALTHY_KEY);
    } catch {
      healthyFallback = !healthyFallback; // sin storage, alternamos en memoria
    }
    onChange();
  };
  window.addEventListener(HEALTHY_EVENT, handler);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(HEALTHY_EVENT, handler);
    window.removeEventListener("storage", onChange);
  };
}

export default function Home() {
  const [energy, setEnergy] = useState<EnergyMode>("normal");
  const [format, setFormat] = useState<OutputFormat>("idea");
  const [context, setContext] = useState("");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fbState, setFbState] = useState<FeedbackState>("idle");
  const [skipReason, setSkipReason] = useState("");

  const memory = useSyncExternalStore(subscribeMemory, getMemory, getServerMemory);
  const resultRef = useRef<HTMLDivElement>(null);

  const healthy = useSyncExternalStore(subscribeHealthy, readHealthy, () => false);

  function toggleHealthy() {
    try {
      localStorage.setItem(HEALTHY_KEY, healthy ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(HEALTHY_EVENT));
  }

  // Una sola vez: si este navegador no tiene memoria, importa la de data/memory.json
  // (versión anterior, sólo existe en tu compu).
  useEffect(() => {
    if (hasStoredMemory()) return;
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const parsed = MemorySchema.safeParse(data);
        if (parsed.success && !hasStoredMemory()) setMemory(parsed.data);
      })
      .catch(() => {});
  }, []);

  async function sendFeedback(fb: Feedback) {
    setMemory(applyFeedback(getMemory(), fb));
  }

  async function generate(opts: { changeApproach?: boolean; avoid?: string[] } = {}) {
    setLoading(true);
    setError(null);
    setFbState("idle");
    setSkipReason("");
    const avoid = opts.avoid ?? shown;
    try {
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          energy,
          format,
          context,
          healthy,
          avoidTitles: avoid.slice(-10),
          changeApproach: !!opts.changeApproach,
          memory: getMemory(), // siempre la última, aunque se haya actualizado recién
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.plan) {
        throw new Error(data.error ?? "No se pudo generar la propuesta.");
      }
      setPlan(data.plan);
      setShown([...avoid, data.plan.title]);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function onLike() {
    if (!plan) return;
    await sendFeedback({ action: "like", title: plan.title, meals: plan.meals.map((m) => m.name) });
    setFbState("liked");
  }

  async function onSkipConfirm() {
    if (!plan) return;
    await sendFeedback({ action: "dislike", item: plan.title, reason: skipReason || undefined });
    await generate();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-linear-to-r from-pink to-purple bg-clip-text text-transparent">
            ¿Qué como hoy?
          </span>{" "}
          {/* El emoji va fuera del degradé: bg-clip-text lo pintaría como una silueta rosa. */}
          <span aria-hidden>🫪</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Estás en tus treintis, vivís sola/o y no tenés idea de qué cocinar</p>
      </header>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          setShown([]);
          generate({ avoid: [] });
        }}
      >
        <OptionGroup label="Energía" options={energyOptions} value={energy} onChange={setEnergy} />
        <OptionGroup label="Formato" options={formatOptions} value={format} onChange={setFormat} />

        <div>
          <label htmlFor="ctx" className="mb-2 block text-xs text-comment">
            Si ya tenés algo o querés evitar algo (opcional)
          </label>
          <input
            id="ctx"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            maxLength={500}
            placeholder="tengo medio morrón · basta de arroz · algo rico y rápido"
            className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm placeholder:text-comment focus:border-cyan focus:outline-none"
          />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={healthy}
          onClick={toggleHealthy}
          className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${
            healthy ? "border-green bg-green/10" : "border-line bg-surface hover:border-green/60"
          }`}
        >
          <span>
            <span className={`block text-sm font-medium ${healthy ? "text-green" : ""}`}>
              Saludable <span aria-hidden>🥦</span>
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Verdura y proteína en cada comida, sin ultraprocesados
            </span>
          </span>
          <span
            aria-hidden
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              healthy ? "bg-green" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
                healthy ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-linear-to-r from-pink to-purple px-4 py-3 text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Pensando…" : "Resolver"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-6">
        {error && (
          <p role="alert" className="mt-8 rounded-lg border border-danger/40 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {loading && !plan && (
          <div className="mt-10 space-y-3" aria-hidden>
            <div className="h-7 w-2/3 animate-pulse rounded bg-line" />
            <div className="h-16 animate-pulse rounded-lg bg-line/60" />
            <div className="h-40 animate-pulse rounded-lg bg-line/60" />
          </div>
        )}

        {plan && (
          <section className={`mt-10 transition-opacity ${loading ? "opacity-40" : ""}`}>
            <PlanView plan={plan} />

            <div className="mt-8 border-t border-line pt-5">
              {fbState === "skipping" ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSkipConfirm();
                  }}
                >
                  <input
                    autoFocus
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    maxLength={200}
                    placeholder="Motivo (opcional): no me gusta el atún, muy pesado…"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-comment focus:border-orange focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 rounded-lg bg-orange px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                    >
                      Guardar y otra
                    </button>
                    <button
                      type="button"
                      onClick={() => setFbState("idle")}
                      className="rounded-lg border border-line px-3 py-2 text-sm text-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <FbButton onClick={onLike} disabled={loading || fbState === "liked"} primary>
                    {fbState === "liked" ? "Guardado" : "Me sirve"}
                  </FbButton>
                  <FbButton onClick={() => setFbState("skipping")} disabled={loading}>
                    Paso / No hoy
                  </FbButton>
                  <FbButton onClick={() => generate({ changeApproach: true })} disabled={loading}>
                    Cambiar enfoque
                  </FbButton>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="mt-14">
        <MemoryPanel memory={memory} onUpdate={sendFeedback} />
      </div>
    </main>
  );
}

function FbButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
        primary
          ? "border-green bg-green/10 text-green hover:bg-green/20"
          : "border-line bg-surface hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}
