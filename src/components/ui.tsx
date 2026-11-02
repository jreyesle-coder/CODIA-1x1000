import type { ReactNode } from "react";
import type { Sincronizacion } from "@/lib/almacen";

export function Tarjeta({ titulo, valor, nota, tono }: { titulo: string; valor: string; nota?: string; tono?: "bueno" | "malo" }) {
  return (
    <div className="rounded-lg border border-borde bg-superficie p-4">
      <div className="text-xs font-medium text-tinta-2">{titulo}</div>
      <div className="cifra mt-1 text-2xl font-bold text-tinta">{valor}</div>
      {nota && <div className={`mt-1 text-xs ${tono === "bueno" ? "text-bueno" : tono === "malo" ? "text-malo" : "text-tinta-3"}`}>{nota}</div>}
    </div>
  );
}

export function Seccion({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-borde bg-superficie p-4 sm:p-5">
      <h2 className="text-base font-semibold text-tinta">{titulo}</h2>
      {subtitulo && <p className="mb-3 mt-0.5 text-sm text-tinta-2">{subtitulo}</p>}
      <div className={subtitulo ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export function EstadoSync({ s }: { s: Sincronizacion | null }) {
  if (!s) return null;
  const err = s.estado === "error";
  const cuando = new Date(s.fin ?? s.inicio).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <span title={s.detalle ?? ""} className={`rounded-full border px-3 py-1 text-xs ${err ? "border-malo/30 bg-malo/10 text-malo" : "border-bueno/30 bg-bueno/10 text-bueno"}`}>
      {err ? "⚠ Error al actualizar" : "✓ Al día"} · {cuando}
    </span>
  );
}

export function SinDatos({ ultimaSync }: { ultimaSync: Sincronizacion | null }) {
  return (
    <div className="rounded-lg border border-borde bg-superficie p-8 text-center">
      <h1 className="text-lg font-semibold">Todavía no hay datos</h1>
      <p className="mt-2 text-sm text-tinta-2">La primera sincronización con la Tesorería no ha corrido. Se ejecuta sola cada día, o a mano con <code>npm run sync</code>.</p>
      {ultimaSync?.detalle && <p className="mt-3 text-xs text-malo">{ultimaSync.detalle}</p>}
    </div>
  );
}
