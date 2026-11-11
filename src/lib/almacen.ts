/**
 * Dónde viven los datos.
 * - Con SUPABASE_URL + SUPABASE_ANON_KEY + CRON_SECRET: Supabase. Lee con la clave pública (las tablas
 *   son de lectura abierta: datos públicos de la Tesorería) y escribe solo a través de funciones
 *   que exigen CRON_SECRET.
 * - Sin esas variables, en la PC: un archivo local (datos/almacen.json) para probar.
 *   En un servidor (Vercel) la falta de variables es un error y se muestra como tal.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PagoObra } from "./lector";

export const VARIABLES = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "CRON_SECRET"] as const;

export class ErrorConfiguracion extends Error {
  constructor(public faltan: string[]) {
    super(`Faltan variables de entorno: ${faltan.join(", ")}`);
  }
}

export interface ArchivoGuardado {
  anio: number;
  mes: number;
  phoca_id: number;
  titulo: string;
  url: string;
  sha256: string;
  filas_obras: number;
  descargado_en: string;
}

export interface Sincronizacion {
  inicio: string;
  fin: string | null;
  estado: "ok" | "sin_cambios" | "error";
  detalle: string | null;
}

export interface Almacen {
  tipo: "supabase" | "local";
  archivos(): Promise<ArchivoGuardado[]>;
  reemplazarMes(a: ArchivoGuardado, filas: PagoObra[]): Promise<void>;
  pagos(anio: number): Promise<PagoObra[]>;
  registrarSync(s: Sincronizacion): Promise<void>;
  ultimaSync(): Promise<Sincronizacion | null>;
}

// ---------- Supabase ----------
function supabase(url: string, llave: string, secreto: string): Almacen {
  const sb: SupabaseClient = createClient(url, llave, { auth: { persistSession: false } });
  const ok = <T>(r: { data: T | null; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };
  return {
    tipo: "supabase",
    async archivos() {
      return ok(await sb.from("archivos_tn").select("*").order("anio").order("mes"));
    },
    async reemplazarMes(a, filas) {
      ok(await sb.rpc("sync_reemplazar_mes", { p_secreto: secreto, p_archivo: a, p_filas: filas }));
    },
    async pagos(anio) {
      const out: PagoObra[] = [];
      for (let desde = 0; ; desde += 1000) {
        const lote = ok<PagoObra[]>(
          await sb.from("pagos_obras")
            .select("anio,mes,moneda,fecha,institucion,unidad_ejecutora,libramiento,proveedor,concepto,monto_bruto,retencion,monto_neto,cesion")
            .eq("anio", anio).order("id").range(desde, desde + 999),
        );
        out.push(...lote.map((p) => ({ ...p, monto_bruto: Number(p.monto_bruto), retencion: Number(p.retencion), monto_neto: Number(p.monto_neto) })));
        if (lote.length < 1000) return out;
      }
    },
    async registrarSync(s) {
      ok(await sb.rpc("sync_registrar", { p_secreto: secreto, p_inicio: s.inicio, p_fin: s.fin, p_estado: s.estado, p_detalle: s.detalle }));
    },
    async ultimaSync() {
      const d = ok<Sincronizacion[]>(await sb.from("sincronizaciones").select("inicio,fin,estado,detalle").order("inicio", { ascending: false }).limit(1));
      return d[0] ?? null;
    },
  };
}

// ---------- Local (JSON) ----------
interface DatosLocales { archivos: ArchivoGuardado[]; pagos: PagoObra[]; sincronizaciones: Sincronizacion[] }

function local(): Almacen {
  const ruta = path.join(process.cwd(), "datos", "almacen.json");
  const leer = async (): Promise<DatosLocales> => {
    try { return JSON.parse(await readFile(ruta, "utf8")); } catch { return { archivos: [], pagos: [], sincronizaciones: [] }; }
  };
  const escribir = async (d: DatosLocales) => {
    await mkdir(path.dirname(ruta), { recursive: true });
    await writeFile(ruta, JSON.stringify(d));
  };
  return {
    tipo: "local",
    async archivos() { return (await leer()).archivos; },
    async reemplazarMes(a, filas) {
      const d = await leer();
      d.pagos = d.pagos.filter((p) => !(p.anio === a.anio && p.mes === a.mes)).concat(filas);
      d.archivos = d.archivos.filter((x) => !(x.anio === a.anio && x.mes === a.mes)).concat(a);
      await escribir(d);
    },
    async pagos(anio) { return (await leer()).pagos.filter((p) => p.anio === anio); },
    async registrarSync(s) {
      const d = await leer();
      d.sincronizaciones = [...d.sincronizaciones, s].slice(-50);
      await escribir(d);
    },
    async ultimaSync() { return (await leer()).sincronizaciones.at(-1) ?? null; },
  };
}

export function variablesFaltantes(): string[] {
  return VARIABLES.filter((v) => !process.env[v]);
}

export function almacen(): Almacen {
  const faltan = variablesFaltantes();
  if (faltan.length === 0) return supabase(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, process.env.CRON_SECRET!);
  // En un servidor nunca se cae en silencio al archivo local: se exige la configuración.
  if (process.env.VERCEL || process.env.GITHUB_ACTIONS || process.env.NODE_ENV === "production") throw new ErrorConfiguracion(faltan);
  return local();
}
