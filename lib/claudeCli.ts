import { spawn } from "child_process";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { AiError, type AiRun } from "./aiError";

/**
 * Ejecuta el CLI de Claude Code en modo no interactivo (`claude -p`) y
 * devuelve la salida estructurada. Usa la sesión con la que ya iniciaste
 * Claude Code en esta máquina: no hace falta ANTHROPIC_API_KEY.
 */

let cachedBin: string | null = null;

/**
 * En Windows, `claude` instalado con npm es un shim `.cmd`, que `spawn` no puede
 * lanzar sin `shell: true` (y con shell el quoting del JSON schema se rompe).
 * Por eso buscamos el `claude.exe` real. Se puede forzar con CLAUDE_BIN.
 */
function resolveClaudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (cachedBin) return cachedBin;
  if (process.platform !== "win32") return (cachedBin = "claude");

  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const candidates = [
    ...dirs.map((d) => path.join(d, "claude.exe")),
    // Layout de `npm install -g @anthropic-ai/claude-code`
    ...dirs.map((d) => path.join(d, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe")),
    // Instalador nativo
    path.join(os.homedir(), ".local", "bin", "claude.exe"),
  ];
  return (cachedBin = candidates.find((c) => existsSync(c)) ?? "claude.exe");
}

type CliResult = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  modelUsage?: Record<string, { outputTokens?: number }>;
};

/** El modelo que generó la respuesta: el de más tokens de salida en modelUsage. */
function mainModel(out: CliResult): string | null {
  const entries = Object.entries(out.modelUsage ?? {});
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1].outputTokens ?? 0) - (a[1].outputTokens ?? 0));
  return entries[0][0];
}

function parseCliOutput(stdout: string): CliResult {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Por si algo se imprimió antes del JSON final: probamos con la última línea.
    const last = text.split(/\r?\n/).pop() ?? "";
    try {
      return JSON.parse(last);
    } catch {
      throw new AiError("El CLI no devolvió JSON.", "bad_output");
    }
  }
}

export async function runClaude(opts: {
  systemPrompt: string;
  prompt: string;
  jsonSchema: object;
  model?: string;
  timeoutMs?: number;
}): Promise<AiRun> {
  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", JSON.stringify(opts.jsonSchema),
    "--system-prompt", opts.systemPrompt,
    "--tools", "", // sin herramientas: sólo tiene que pensar y responder
    "--strict-mcp-config", // no levantar servidores MCP del usuario
    "--no-session-persistence",
  ];
  if (opts.model) args.push("--model", opts.model);

  const timeoutMs = opts.timeoutMs ?? 150_000;

  return new Promise((resolve, reject) => {
    const child = spawn(resolveClaudeBin(), args, {
      // Directorio neutro, para que no tome CLAUDE.md ni settings de este proyecto.
      cwd: os.tmpdir(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new AiError("Claude tardó demasiado en responder.", "timeout")));
    }, timeoutMs);

    child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr += d));

    child.on("error", (err: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          err.code === "ENOENT"
            ? new AiError("No encontré el CLI de Claude Code (`claude`).", "not_found")
            : new AiError(`No se pudo ejecutar claude: ${err.message}`, "failed"),
        ),
      );
    });

    child.on("close", (code) => {
      finish(() => {
        if (!stdout.trim()) {
          return reject(
            new AiError(
              `claude terminó con código ${code}. ${stderr.trim().slice(-500)}`,
              "failed",
            ),
          );
        }
        let out: CliResult;
        try {
          out = parseCliOutput(stdout);
        } catch (e) {
          return reject(e);
        }
        if (out.is_error || (out.subtype && out.subtype !== "success")) {
          return reject(
            new AiError(
              `claude devolvió un error (${out.subtype ?? "desconocido"}): ${String(out.result ?? "").slice(0, 500)}`,
              "failed",
            ),
          );
        }
        const model = mainModel(out);
        if (out.structured_output !== undefined) {
          return resolve({ data: out.structured_output, model });
        }
        try {
          resolve({ data: JSON.parse(out.result ?? ""), model });
        } catch {
          reject(new AiError("La respuesta no vino en JSON.", "bad_output"));
        }
      });
    });

    // El prompt va por stdin: evita límites de longitud y problemas de comillas.
    child.stdin.end(opts.prompt, "utf8");
  });
}
