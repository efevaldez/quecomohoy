import { ApiError, GoogleGenAI } from "@google/genai";
import { AiError, type AiRun } from "./aiError";

/**
 * Gemini API (plan gratuito de Google AI Studio). Requiere GEMINI_API_KEY.
 * Modelo configurable con GEMINI_MODEL.
 */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;

export async function runGemini(opts: {
  systemPrompt: string;
  prompt: string;
  jsonSchema: object;
}): Promise<AiRun> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("Falta GEMINI_API_KEY.", "not_configured");
  client ??= new GoogleGenAI({ apiKey });

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let text: string | undefined;
  try {
    const response = await client.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: opts.jsonSchema,
        abortSignal: AbortSignal.timeout(55_000),
      },
    });
    text = response.text;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 429) {
        throw new AiError("Se agotó el cupo gratuito de Gemini por ahora.", "rate_limited");
      }
      throw new AiError(`Gemini respondió ${err.status}: ${err.message}`, "failed");
    }
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new AiError("Gemini tardó demasiado.", "timeout");
    }
    throw new AiError(`No se pudo llamar a Gemini: ${String(err)}`, "failed");
  }

  if (!text) throw new AiError("Gemini no devolvió texto.", "bad_output");
  try {
    return { data: JSON.parse(text), model };
  } catch {
    throw new AiError("Gemini no devolvió JSON válido.", "bad_output");
  }
}
