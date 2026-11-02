/**
 * Cliente del portal de la Tesorería Nacional (Phoca Download).
 * Encuentra los archivos «Pagos Detallados Suplidores y Contratistas» de cada mes
 * y los descarga. El portal no acepta enlaces directos: hay que enviar el formulario
 * de descarga con la cookie de sesión y el token anti-CSRF de la página del archivo.
 */
const BASE = "https://www.tesoreria.gob.do";
const RAIZ = `${BASE}/index.php/component/phocadownload/category/24.html`;
const UA = "Mozilla/5.0 (CODIA 1x1000; consulta de transparencia)";

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

function sinAcentos(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

async function html(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Tesorería respondió ${r.status} en ${url}`);
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

/** Lista los archivos de detalle publicados para un año (uno por mes). */
export async function listarArchivos(anio: number): Promise<ArchivoTN[]> {
  const cat = await categoriaDelAnio(anio);
  if (!cat) return [];
  const meses = enlaces(await html(cat))
    .map((l) => ({ ...l, mes: MESES.indexOf(sinAcentos(l.texto)) + 1 }))
    .filter((l) => l.mes > 0 && /\/category\//.test(l.href));
  const vistos = new Set<number>();
  const out: ArchivoTN[] = [];
  for (const m of meses) {
    if (vistos.has(m.mes)) continue;
    vistos.add(m.mes);
    const candidatos = enlaces(await html(m.href))
      .filter((l) => /\/file\/(\d+)-pagos-detallados/.test(l.href))
      .map((l) => ({ url: l.href.split("?")[0], id: Number(l.href.match(/\/file\/(\d+)-/)![1]) }));
    // El portal publica el mismo archivo dos veces (xlsx liviano y una copia más pesada);
    // se usa el de id más bajo y, si no abre como xlsx, el siguiente.
    const unicos = [...new Map(candidatos.map((c) => [c.id, c])).values()].sort((a, b) => a.id - b.id);
    for (const c of unicos) {
      out.push({ anio, mes: m.mes, phocaId: c.id, url: c.url, titulo: `Pagos Detallados Suplidores y Contratistas ${MESES[m.mes - 1]} ${anio}` });
    }
  }
  return out;
}

/** Descarga el archivo enviando el formulario de Phoca con su token. */
export async function descargar(a: ArchivoTN): Promise<Buffer> {
  const r1 = await fetch(a.url, { headers: { "User-Agent": UA } });
  if (!r1.ok) throw new Error(`Tesorería respondió ${r1.status} en ${a.url}`);
  const cookie = r1.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const pagina = await r1.text();
  const token = pagina.match(/name="([0-9a-f]{32})" value="1"/)?.[1];
  if (!token) throw new Error(`No se encontró el token de descarga en ${a.url}`);
  const cuerpo = new URLSearchParams({ submit: "Descarga", license_agree: "1", download: String(a.phocaId), [token]: "1" });
  const r2 = await fetch(a.url, {
    method: "POST",
    headers: { "User-Agent": UA, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded", Referer: a.url },
    body: cuerpo,
  });
  if (!r2.ok) throw new Error(`Descarga falló (${r2.status}) en ${a.url}`);
  const buf = Buffer.from(await r2.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== "PK") throw new Error(`El archivo ${a.phocaId} no es un .xlsx`);
  return buf;
}
