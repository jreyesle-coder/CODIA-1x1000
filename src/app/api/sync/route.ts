import { NextResponse, type NextRequest } from "next/server";
import { almacen } from "@/lib/almacen";
import { aniosPorDefecto, sincronizar } from "@/lib/sincronizar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron llama aquí cada día (ver vercel.json) con `Authorization: Bearer <CRON_SECRET>`.
 * También sirve para forzar una corrida desde fuera con ese mismo encabezado.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const r = await sincronizar(almacen(), aniosPorDefecto(), { limiteMs: 50_000 });
    return NextResponse.json(r, { status: r.estado === "error" ? 500 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
