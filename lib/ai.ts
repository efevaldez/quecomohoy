import type { AiRun } from "./aiError";
import { runClaude } from "./claudeCli";
import { runGemini } from "./gemini";

export type Provider = "gemini" | "claude-cli";

/**
 * AI_PROVIDER elige el motor. Si no está:
 * - con GEMINI_API_KEY → Gemini (lo que se usa en Vercel)
 * - sin ella → Claude Code CLI local (tu compu)
 */
export function currentProvider(): Provider {
  const forced = process.env.AI_PROVIDER;
  if (forced === "gemini" || forced === "claude-cli") return forced;
  return process.env.GEMINI_API_KEY ? "gemini" : "claude-cli";
}

export function generateJson(opts: {
  systemPrompt: string;
  prompt: string;
  jsonSchema: object;
}): Promise<AiRun> {
  if (currentProvider() === "gemini") return runGemini(opts);
  return runClaude({ ...opts, model: process.env.CLAUDE_MODEL || undefined });
}
