import type { ReactNode } from "react";
import type { Sincronizacion } from "@/lib/almacen";
import { actualizarAhora } from "@/app/acciones";

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

/** Botón que revisa la Tesorería en el momento (tarda hasta un minuto). */
export function BotonActualizar() {
  return (
    <form action={actualizarAhora}>
      <button className="rounded-md border border-codia px-3 py-1 text-xs font-medium text-codia hover:bg-codia hover:text-white">
        Actualizar ahora
      </button>
    </form>
  );
}

/** Resultado de la última corrida, se muestra tras pulsar «Actualizar ahora». */
export function AvisoSync({ s }: { s: Sincronizacion | null }) {
  if (!s) return null;
  const err = s.estado === "error";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${err ? "border-malo/30 bg-malo/10 text-malo" : "border-bueno/30 bg-bueno/10 text-bueno"}`}>
      {err ? "La revisión terminó con errores" : s.estado === "ok" ? "Datos actualizados" : "Revisado: no hay archivos nuevos en la Tesorería"}
      {s.detalle && <span className="text-tinta-2"> · {s.detalle}</span>}
    </div>
  );
}

export function SinDatos({ ultimaSync }: { ultimaSync: Sincronizacion | null }) {
  return (
    <div className="rounded-lg border border-borde bg-superficie p-8 text-center">
      <h1 className="text-lg font-semibold">Todavía no hay datos</h1>
      <p className="mt-2 text-sm text-tinta-2">Aún no se ha descargado ningún mes de la Tesorería. Se revisa sola cada día a las 7:00 a. m., o ahora mismo con este botón.</p>
      <div className="mt-4 flex justify-center"><BotonActualizar /></div>
      {ultimaSync?.detalle && <p className="mt-3 text-xs text-malo">{ultimaSync.detalle}</p>}
    </div>
  );
}

export function FaltaConfiguracion({ faltan }: { faltan: string[] }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-malo/30 bg-superficie p-8">
      <h1 className="text-lg font-semibold text-malo">Falta configurar el servidor</h1>
      <p className="mt-2 text-sm text-tinta-2">La app no puede conectarse a la base de datos porque faltan estas variables de entorno:</p>
      <ul className="mt-3 list-disc space-y-1 pl-6 font-mono text-sm">
        {faltan.map((v) => <li key={v}>{v}</li>)}
      </ul>
      <p className="mt-4 text-sm text-tinta-2">
        En Vercel: proyecto → <b>Settings</b> → <b>Environment Variables</b>, agregue las que faltan y luego <b>Deployments</b> → <b>⋯</b> → <b>Redeploy</b>.
        Los valores están en el README del proyecto.
      </p>
    </div>
  );
}
