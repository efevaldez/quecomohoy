export type AiErrorKind =
  | "not_configured"
  | "not_found"
  | "timeout"
  | "rate_limited"
  | "failed"
  | "bad_output";

/** Error común a los dos motores (Gemini y Claude Code CLI). */
export class AiError extends Error {
  constructor(
    message: string,
    public kind: AiErrorKind,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export type AiRun = { data: unknown; model: string | null };
