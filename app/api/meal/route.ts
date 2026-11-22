import { NextResponse } from "next/server";
import { currentProvider, generateJson } from "@/lib/ai";
import { AiError, type AiErrorKind, type AiRun } from "@/lib/aiError";
import {
  ENERGY_LABELS,
  FORMAT_LABELS,
  MealRequestSchema,
  PLAN_JSON_SCHEMA,
  PlanSchema,
  emptyMemory,
  type MealRequest,
  type Memory,
} from "@/lib/types";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sos el motor de "¿Qué como hoy?": resolvés comidas para UNA sola persona que vive sola, con poca energía y sin inventario cargado. Escribís en español rioplatense, directo y sobrio.

Reglas que nunca rompés:
- Porción individual real. Cantidades para 1 persona (o para 1 persona en varios días, si el formato lo pide). Nada de recetas para 4.
- Si algo se compra en envase grande (paquete de arroz, maple de huevos, bandeja de carne, verdura entera) o va a sobrar, lo listás en "leftovers" con un reuso concreto y cercano en el tiempo (idealmente dentro del mismo plan).
- Tiempo realista: contá picar, precalentar y esperar. No mientas para entrar en el modo.
- "washCost" siempre explícito y concreto: qué recipientes y utensilios se ensucian (ej: "1 sartén, 1 tabla y 1 plato").
- Pasos breves, imperativos, sin relleno ni introducciones. Máximo 6 pasos por comida.
- Ingredientes accesibles en un súper o verdulería común de Argentina.
- Respetá los rechazos del usuario: no propongas platos ni ingredientes que estén en "rechazos" (los más recientes, con prioridad absoluta).
- No repitas platos de "comidas recientes" ni variaciones obvias de ellos.
- Usá los "me gusta" como señal de estilo, no para repetir lo mismo.

Modos de energía:
- zombie: menos de 15 minutos totales, mínima decisión, idealmente 1 solo recipiente. Vale armar, calentar, ensamblar.
- normal: 20 a 30 minutos, algo rico y simple.
- finde: hay tiempo; priorizá cocinar una vez y dejar resueltas comidas de los próximos días (bases, cocciones en tanda, cosas que aguantan heladera o freezer).

Formatos de salida:
- idea: exactamente 1 comida en "meals" para hoy. "shoppingList" sólo con lo que probablemente falte (puede ir vacía).
- combo: 2 o 3 comidas en "meals" encadenadas: comparten ingredientes o una sobra de la primera alimenta a la siguiente. Explicitá el encadenamiento en "summary" y en "leftovers".
- compra: lista breve en "shoppingList" (máximo ~12 ítems, cantidades chicas) que resuelva 3 o 4 comidas, y esas comidas en "meals" con pasos cortos.

"washCost" del plan es el total del plan; cada comida tiene el suyo. "totalMinutes" es la suma de tiempo real de todas las comidas.`;

function describeMemory(m: Memory): string {
  const recent = m.recentMeals.slice(0, 12).map((r) => `${r.name} (${r.date})`);
  const dislikes = m.dislikes
    .slice(0, 25)
    .map((d) => `${d.item}${d.reason ? ` — motivo: ${d.reason}` : ""} (${d.date})`);
  return [
    `Comidas recientes (no repetir): ${recent.length ? recent.join("; ") : "ninguna"}`,
    `Rechazos (evitar): ${dislikes.length ? dislikes.join("; ") : "ninguno"}`,
    `Me gusta: ${m.likes.length ? m.likes.slice(0, 20).join("; ") : "sin datos"}`,
    `Notas del usuario: ${m.notes.length ? m.notes.join("; ") : "ninguna"}`,
  ].join("\n");
}

function buildUserMessage(req: MealRequest, memory: Memory): string {
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const lines = [
    `Hoy es ${today}.`,
    `Modo de energía: ${req.energy} (${ENERGY_LABELS[req.energy].hint}).`,
    `Formato: ${req.format} (${FORMAT_LABELS[req.format].hint}).`,
    req.context.trim()
      ? `Lo que dice el usuario (tiene algo / quiere evitar algo): "${req.context.trim()}"`
      : "El usuario no aclaró nada extra.",
    "",
    "Memoria:",
    describeMemory(memory),
  ];
  if (req.healthy) {
    lines.push(
      "",
      "Quiere que sea SALUDABLE (comida casera real, no de dieta): verdura en cada comida (idealmente la mitad del plato), una proteína (legumbres, huevo, pollo, pescado, carne magra) e integrales cuando se pueda. Evitá ultraprocesados (salchichas, fiambres, rebozados congelados, sopas instantáneas), frituras y exceso de crema o manteca. En modo zombie también aplica: armá con verdura cruda o de lata, legumbres de lata, atún o huevo. Sin hablar de calorías ni de dietas.",
    );
  }
  if (req.avoidTitles.length) {
    lines.push("", `Ya le mostré y no eligió: ${req.avoidTitles.join("; ")}.`);
  }
  if (req.changeApproach) {
    lines.push(
      "Pidió CAMBIAR DE ENFOQUE: proponé algo claramente distinto (otra técnica, otra proteína o base, otro perfil de sabor), no una variante de lo anterior.",
    );
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const input = MealRequestSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // La memoria la manda el navegador de cada persona.
  const memory = input.data.memory ?? emptyMemory();
  const provider = currentProvider();

  let run: AiRun;
  try {
    run = await generateJson({
      systemPrompt: SYSTEM_PROMPT,
      prompt: buildUserMessage(input.data, memory),
      jsonSchema: PLAN_JSON_SCHEMA,
    });
  } catch (err) {
    if (err instanceof AiError) {
      console.error(`[${provider}] ${err.kind}: ${err.message}`);
      return NextResponse.json(
        { error: errorMessage(provider, err.kind) },
        { status: err.kind === "timeout" ? 504 : err.kind === "rate_limited" ? 429 : 502 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }

  console.log(`[${provider}] respondió ${run.model ?? "modelo desconocido"}`);
  const plan = PlanSchema.safeParse(run.data);
  if (!plan.success) {
    console.error("Plan con forma inválida:", plan.error.issues);
    return NextResponse.json(
      { error: "La respuesta llegó incompleta. Probá de nuevo." },
      { status: 502 },
    );
  }

  return NextResponse.json({ plan: plan.data });
}

function errorMessage(provider: string, kind: AiErrorKind): string {
  switch (kind) {
    case "not_configured":
      return "El servidor no tiene configurada la clave de la IA.";
    case "not_found":
      return "No encontré el CLI de Claude Code. Instalalo e iniciá sesión con `claude` en una terminal (o definí CLAUDE_BIN).";
    case "timeout":
      return "Tardó demasiado en responder. Probá de nuevo.";
    case "rate_limited":
      return "Se usó mucho por hoy y se agotó el cupo gratuito. Probá más tarde.";
    case "bad_output":
      return "La respuesta llegó en un formato inesperado. Probá de nuevo.";
    case "failed":
      return provider === "claude-cli"
        ? "Claude Code no pudo responder. Revisá que tengas la sesión iniciada (`claude` en una terminal) y probá de nuevo."
        : "La IA no pudo responder. Probá de nuevo en un momento.";
  }
}
