import type { ReactNode } from "react";
import type { Sincronizacion } from "@/lib/almacen";
import { actualizarAhora } from "@/app/acciones";

const TONOS = {
  bueno: "border-bueno/30 bg-bueno/10 text-bueno",
  aviso: "border-aviso/30 bg-aviso/10 text-aviso",
  malo: "border-malo/30 bg-malo/10 text-malo",
};

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

/** Estado de la última revisión de la Tesorería. Si lleva más de 26 h sin revisar, lo dice. */
export function EstadoSync({ s, horas }: { s: Sincronizacion | null; horas: number }) {
  if (!s) return null;
  const fin = new Date(s.fin ?? s.inicio);
  const vieja = horas > 26;
  const tono = s.estado === "error" || vieja ? "malo" : s.estado === "parcial" ? "aviso" : "bueno";
  const texto = vieja ? `⚠ Sin revisar desde hace ${Math.round(horas)} h`
    : s.estado === "error" ? "⚠ Error al actualizar"
    : s.estado === "parcial" ? "Revisado con avisos"
    : "✓ Al día";
  const cuando = fin.toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <span title={s.detalle ?? ""} className={`rounded-full border px-3 py-1 text-xs ${TONOS[tono]}`}>
      {texto} · {cuando}
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

const TITULOS: Record<string, string> = {
  ok: "Datos actualizados",
  sin_cambios: "Revisado: no hay archivos nuevos en la Tesorería",
  parcial: "Revisado con avisos",
  error: "La revisión terminó con errores",
};

/** Resultado real de la corrida que acaba de pedir «Actualizar ahora». */
export function AvisoSync({ estado, detalle }: { estado: string; detalle: string }) {
  const tono = estado === "error" ? "malo" : estado === "parcial" ? "aviso" : "bueno";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${TONOS[tono]}`}>
      {TITULOS[estado] ?? estado}
      {detalle && <span className="text-tinta-2"> · {detalle}</span>}
    </div>
  );
}

export function SinDatos({ ultimaSync }: { ultimaSync: Sincronizacion | null }) {
  return (
    <div className="rounded-lg border border-borde bg-superficie p-8 text-center">
      <h1 className="text-lg font-semibold">Todavía no hay datos</h1>
      <p className="mt-2 text-sm text-tinta-2">Aún no se ha descargado ningún mes de la Tesorería. Se revisa sola cada día entre 7:00 y 8:00 a. m., o ahora mismo con este botón.</p>
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
