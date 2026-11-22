import type { Plan } from "@/lib/types";

function Meta({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <dt className="text-xs text-comment">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${tone}`}>{value}</dd>
    </div>
  );
}

export function PlanView({ plan }: { plan: Plan }) {
  const multi = plan.meals.length > 1;

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-pink">{plan.title}</h2>
        {plan.summary && <p className="text-sm leading-relaxed text-muted">{plan.summary}</p>}
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface px-4 py-3">
          <Meta label={multi ? "Tiempo total" : "Tiempo real"} value={`${plan.totalMinutes} min`} tone="text-yellow" />
          <Meta label="Costo de lavado" value={plan.washCost} tone="text-cyan" />
        </dl>
      </header>

      {plan.shoppingList.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs text-comment">
            {plan.meals.length > 1 ? "Compra" : "Si te falta"}
          </h3>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {plan.shoppingList.map((s, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
                <span>
                  {s.item}
                  {s.note && <span className="ml-2 text-xs text-muted">{s.note}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-yellow">{s.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        {plan.meals.map((m, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-medium">
                {multi && <span className="mr-2 text-xs text-purple">{m.when}</span>}
                {m.name}
              </h3>
              <span className="text-xs text-cyan">
                {m.minutes} min · {m.washCost}
              </span>
            </div>

            {m.ingredients.length > 0 && (
              <p className="mt-3 text-sm leading-relaxed text-muted">{m.ingredients.join(" · ")}</p>
            )}

            <ol className="mt-3 space-y-1.5 text-sm leading-relaxed">
              {m.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="w-4 shrink-0 text-right tabular-nums text-pink">{j + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {plan.leftovers.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs text-comment">
            Lo que sobra y cómo usarlo
          </h3>
          <ul className="space-y-2 text-sm">
            {plan.leftovers.map((l, i) => (
              <li key={i} className="border-l-2 border-orange pl-3">
                <span className="font-medium text-orange">{l.item}:</span> {l.reuse}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.portionNote && (
        <p className="text-xs leading-relaxed text-muted">Porción: {plan.portionNote}</p>
      )}
    </article>
  );
}
