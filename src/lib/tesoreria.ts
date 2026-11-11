/**
 * Cliente del portal de la Tesorería Nacional (Phoca Download).
 * Encuentra los archivos «Pagos Detallados Suplidores y Contratistas» de cada mes
 * y los descarga. El portal no acepta enlaces directos: hay que enviar el formulario
 * de descarga con la cookie de sesión y el token anti-CSRF de la página del archivo.
 */
const BASE = "https://www.tesoreria.gob.do";
const RAIZ = `${BASE}/index.php/component/phocadownload/category/24.html`;
const UA = "Mozilla/5.0 (CODIA 1x1000; consulta de transparencia)";
const ESPERA_PAGINA_MS = 15_000;
const ESPERA_DESCARGA_MS = 45_000;

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export interface ArchivoTN {
  anio: number;
  mes: number;
  phocaId: number;
  titulo: string;
  url: string; // página del archivo
}

/** Archivos encontrados y lo que no se pudo interpretar (para que una corrida no lo calle). */
export interface ListadoTN {
  archivos: ArchivoTN[];
  avisos: string[];
}

function sinAcentos(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** «Octubre», «Octubre 2026» u «Octubre (corregido)» → 10; 0 si no es un mes. */
function mesDe(texto: string): number {
  const t = sinAcentos(texto);
  return MESES.findIndex((m) => t === m || t.startsWith(m + " ") || t.startsWith(m + "(") || t.startsWith(m + "-")) + 1;
}

async function pedir(url: string, init: RequestInit, esperaMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(esperaMs) });
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new Error(`la Tesorería no respondió en ${esperaMs / 1000} s: ${url}`);
    throw new Error(`no se pudo conectar con la Tesorería (${(e as Error).message}): ${url}`);
  }
}

async function html(url: string): Promise<string> {
  const r = await pedir(url, {}, ESPERA_PAGINA_MS);
  if (!r.ok) throw new Error(`la Tesorería respondió ${r.status} en ${url}`);
  return r.text();
}

function enlaces(pagina: string): { href: string; texto: string }[] {
  const out: { href: string; texto: string }[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of pagina.matchAll(re)) {
    const texto = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    out.push({ href: new URL(m[1].replace(/&amp;/g, "&"), BASE).toString(), texto });
  }
  return out;
}

/** Categoría «Período AAAA» dentro de Pagos Detallados. */
async function categoriaDelAnio(anio: number): Promise<string | null> {
  const e = enlaces(await html(RAIZ)).find((l) => /periodo/.test(sinAcentos(l.texto)) && l.texto.includes(String(anio)));
  return e?.href ?? null;
}

/** Lista los archivos de detalle publicados para un año (normalmente uno por mes). */
export async function listarArchivos(anio: number): Promise<ListadoTN> {
  const avisos: string[] = [];
  const cat = await categoriaDelAnio(anio);
  if (!cat) return { archivos: [], avisos: [`el portal no tiene la categoría «Período ${anio}»`] };
  // Subcategorías del año (un mes cada una). Se ignoran el enlace a la raíz y el del propio año.
  const entradas = enlaces(await html(cat)).filter((l) =>
    /\/category\/\d+/.test(l.href) && l.texto && !/\/category\/24(-|\.html)/.test(l.href) && l.href !== cat && !/^periodo/.test(sinAcentos(l.texto)));
  const porMes = new Map<number, string>();
  for (const e of entradas) {
    const mes = mesDe(e.texto);
    if (!mes) { if (!avisos.includes(`entrada no reconocida en «Período ${anio}»: ${e.texto}`)) avisos.push(`entrada no reconocida en «Período ${anio}»: ${e.texto}`); continue; }
    if (!porMes.has(mes)) porMes.set(mes, e.href);
  }
  const archivos: ArchivoTN[] = [];
  for (const [mes, href] of porMes) {
    const candidatos = enlaces(await html(href))
      .filter((l) => /\/file\/\d+-pagos?-detallad/.test(l.href) && !/consolidad/.test(l.href))
      .map((l) => ({ url: l.href.split("?")[0], id: Number(l.href.match(/\/file\/(\d+)-/)![1]) }));
    // El portal publica el mismo archivo dos o tres veces (el xlsx y copias en otro formato);
    // se intentan en orden de id y el sincronizador se queda con el primero que abra como xlsx.
    const unicos = [...new Map(candidatos.map((c) => [c.id, c])).values()].sort((a, b) => a.id - b.id);
    if (unicos.length === 0) { avisos.push(`${MESES[mes - 1]} ${anio}: la página del mes no tiene archivo de pagos detallados`); continue; }
    for (const c of unicos) {
      archivos.push({ anio, mes, phocaId: c.id, url: c.url, titulo: `Pagos Detallados Suplidores y Contratistas ${MESES[mes - 1]} ${anio}` });
    }
  }
  return { archivos, avisos };
}

/** Descarga el archivo enviando el formulario de Phoca con su token. */
export async function descargar(a: ArchivoTN): Promise<Buffer> {
  const r1 = await pedir(a.url, {}, ESPERA_PAGINA_MS);
  if (!r1.ok) throw new Error(`la Tesorería respondió ${r1.status} en ${a.url}`);
  const cookie = r1.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const pagina = await r1.text();
  const token = pagina.match(/name="([0-9a-f]{32})" value="1"/)?.[1];
  if (!token) throw new Error(`no se encontró el token de descarga en ${a.url} (¿cambió el formulario del portal?)`);
  const cuerpo = new URLSearchParams({ submit: "Descarga", license_agree: "1", download: String(a.phocaId), [token]: "1" });
  const r2 = await pedir(a.url, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded", Referer: a.url },
    body: cuerpo,
  }, ESPERA_DESCARGA_MS);
  if (!r2.ok) throw new Error(`la descarga falló (${r2.status}) en ${a.url}`);
  const buf = Buffer.from(await r2.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== "PK") {
    throw new Error(`el archivo ${a.phocaId} no es un .xlsx (${r2.headers.get("content-type") ?? "sin tipo"})`);
  }
  return buf;
}
