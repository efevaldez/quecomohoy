import { z } from "zod";

export const ENERGY_MODES = ["zombie", "normal", "finde"] as const;
export const OUTPUT_FORMATS = ["idea", "combo", "compra"] as const;

export type EnergyMode = (typeof ENERGY_MODES)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const ENERGY_LABELS: Record<EnergyMode, { title: string; hint: string }> = {
  zombie: { title: "Modo Zombie 🧟‍♀️", hint: "Menos de 15 min, cero cabeza, 1 recipiente" },
  normal: { title: "Modo Normal 🕒", hint: "20–30 min, algo rico y simple" },
  finde: { title: "Modo Finde 🪇", hint: "Resolver varios días o adelantar" },
};

export const FORMAT_LABELS: Record<OutputFormat, { title: string; hint: string }> = {
  idea: { title: "Idea suelta 🌯", hint: "1 comida para hoy" },
  combo: { title: "Combo encadenado 🍜", hint: "2–3 comidas que comparten compras y sobras" },
  compra: { title: "Compra chica 🛒", hint: "Lista breve para resolver unos días" },
};

/* ---------- Respuesta de Claude ---------- */

export const MealSchema = z.object({
  name: z.string(),
  when: z.string(),
  minutes: z.number(),
  washCost: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
});

export const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  totalMinutes: z.number(),
  washCost: z.string(),
  meals: z.array(MealSchema).min(1),
  shoppingList: z.array(
    z.object({ item: z.string(), quantity: z.string(), note: z.string() }),
  ),
  leftovers: z.array(z.object({ item: z.string(), reuse: z.string() })),
  portionNote: z.string(),
});

export type Meal = z.infer<typeof MealSchema>;
export type Plan = z.infer<typeof PlanSchema>;

/** JSON Schema equivalente, para `output_config.format` (structured outputs). */
export const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "totalMinutes",
    "washCost",
    "meals",
    "shoppingList",
    "leftovers",
    "portionNote",
  ],
  properties: {
    title: { type: "string", description: "Nombre del plato o del plan" },
    summary: { type: "string", description: "Una línea, sin adornos" },
    totalMinutes: { type: "integer", description: "Tiempo real total de cocina activa + espera" },
    washCost: { type: "string", description: "Qué se ensucia en total, ej: '1 sartén y 1 plato'" },
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "when", "minutes", "washCost", "ingredients", "steps"],
        properties: {
          name: { type: "string" },
          when: { type: "string", description: "Ej: 'Hoy', 'Mañana al mediodía', 'Martes'" },
          minutes: { type: "integer" },
          washCost: { type: "string" },
          ingredients: {
            type: "array",
            items: { type: "string" },
            description: "Con cantidades para 1 persona",
          },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
    shoppingList: {
      type: "array",
      description: "Vacía si no hace falta comprar nada",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "quantity", "note"],
        properties: {
          item: { type: "string" },
          quantity: { type: "string" },
          note: { type: "string", description: "Vacío si no hace falta aclarar" },
        },
      },
    },
    leftovers: {
      type: "array",
      description: "Todo lo que sobra o viene en envase grande, con cómo reusarlo",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "reuse"],
        properties: {
          item: { type: "string" },
          reuse: { type: "string" },
        },
      },
    },
    portionNote: {
      type: "string",
      description: "Cómo se asegura la porción individual real",
    },
  },
} as const;

/* ---------- Memoria (vive en el navegador de cada persona) ---------- */

// Límites: la memoria viaja en cada pedido, así que no puede crecer sin control.
const short = z.string().max(300);
export const MEMORY_LIMITS = { likes: 50, dislikes: 50, recentMeals: 20, notes: 30 } as const;

export const MemorySchema = z.object({
  likes: z.array(short).max(MEMORY_LIMITS.likes).default([]),
  dislikes: z
    .array(
      z.object({
        item: short,
        reason: short.optional(),
        date: z.string().max(20),
      }),
    )
    .max(MEMORY_LIMITS.dislikes)
    .default([]),
  recentMeals: z
    .array(z.object({ name: short, date: z.string().max(20) }))
    .max(MEMORY_LIMITS.recentMeals)
    .default([]),
  notes: z.array(short).max(MEMORY_LIMITS.notes).default([]),
});

export type Memory = z.infer<typeof MemorySchema>;

export const emptyMemory = (): Memory => ({ likes: [], dislikes: [], recentMeals: [], notes: [] });

export const MealRequestSchema = z.object({
  energy: z.enum(ENERGY_MODES),
  format: z.enum(OUTPUT_FORMATS),
  context: z.string().max(500).optional().default(""),
  healthy: z.boolean().optional().default(false),
  /** Títulos ya mostrados en esta sesión ("Cambiar enfoque"). */
  avoidTitles: z.array(short).max(10).optional().default([]),
  changeApproach: z.boolean().optional().default(false),
  memory: MemorySchema.optional(),
});

export type MealRequest = z.infer<typeof MealRequestSchema>;

export const FeedbackSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("like"), title: short, meals: z.array(short) }),
  z.object({
    action: z.literal("dislike"),
    item: short,
    reason: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("addNote"), note: z.string().min(1).max(200) }),
  z.object({
    action: z.literal("remove"),
    list: z.enum(["likes", "dislikes", "recentMeals", "notes"]),
    index: z.number().int().min(0),
  }),
]);

export type Feedback = z.infer<typeof FeedbackSchema>;
