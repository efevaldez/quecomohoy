# ¿Qué como hoy?

Comidas para una persona, con poca fricción. Next.js (App Router) + TypeScript + Tailwind.

La IA puede ser:

- **Gemini** (plan gratuito de Google AI Studio): se usa cuando hay `GEMINI_API_KEY`. Es lo que corre en Vercel.
- **Claude Code CLI** (`claude -p`, tu sesión local): se usa cuando no hay `GEMINI_API_KEY`.

Se puede forzar con `AI_PROVIDER=gemini` o `AI_PROVIDER=claude-cli`.

La memoria (me sirve, rechazos, comidas recientes, notas) vive en el navegador de cada persona (`localStorage`). No hay base de datos.

## Correr en tu compu

```bash
npm install
npm run dev
```

Con Claude Code instalado y la sesión iniciada no hace falta nada más. Opcional en `.env.local`:

- `CLAUDE_MODEL`: modelo para `claude -p` (por ejemplo `haiku`).
- `CLAUDE_BIN`: ruta al ejecutable de `claude`, si no lo encuentra solo.

## Publicar gratis en Vercel con Gemini

1. Creá una clave en https://aistudio.google.com/apikey. **No actives la facturación** en ese proyecto de Google: así nunca te puede cobrar. Si se agota el cupo gratuito, la app avisa y hay que esperar.
2. Subí el repo a GitHub.
3. En https://vercel.com, con el plan Hobby (gratis), importá el repo con "Add New → Project".
4. En "Environment Variables" agregá `GEMINI_API_KEY` con tu clave. Opcional: `GEMINI_MODEL` (por defecto `gemini-3.5-flash-lite`).
5. Deploy. Cada `git push` vuelve a publicar.

Importante: en el plan gratuito, Google puede usar lo que se le envía para mejorar sus productos. No pongas datos personales en las notas.

## Estructura

- `app/page.tsx`: pantalla principal.
- `app/api/meal/route.ts`: arma el prompt con la memoria que manda el navegador y valida la respuesta con Zod.
- `lib/ai.ts`: elige el motor (Gemini o Claude Code).
- `lib/gemini.ts`: llamada a Gemini con JSON Schema (`@google/genai`).
- `lib/claudeCli.ts`: ejecuta `claude -p` con `child_process.spawn`.
- `lib/memory.ts` y `lib/memoryStore.ts`: lógica de feedback y guardado en el navegador.
- `app/api/memory/route.ts`: sólo lectura, importa una vez el viejo `data/memory.json` si existe.
- `lib/types.ts`: schemas compartidos.
