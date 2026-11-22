import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { emptyMemory, MemorySchema } from "@/lib/types";

/**
 * Sólo lectura: devuelve el data/memory.json de la versión anterior (si existe)
 * para que el navegador lo importe una vez. En Vercel no existe y da vacío.
 */
export async function GET() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "memory.json"), "utf8");
    const parsed = MemorySchema.safeParse(JSON.parse(raw));
    if (parsed.success) return NextResponse.json(parsed.data);
  } catch {}
  return NextResponse.json(emptyMemory());
}
