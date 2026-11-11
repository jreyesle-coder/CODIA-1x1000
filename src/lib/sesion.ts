/**
 * Sesión del tablero: una cookie firmada (HMAC-SHA256) con fecha de caducidad y un valor
 * aleatorio por sesión. La firma usa CRON_SECRET y APP_CLAVE, así que cambiar la contraseña
 * invalida todas las sesiones y una cookie filtrada no sirve para deducir la contraseña.
 * Código apto para el proxy y para las acciones de servidor (solo Web Crypto).
 */
export const COOKIE = "codia1x1000";
export const DIAS_SESION = 30;

function material(): string {
  return `codia-1x1000|${process.env.CRON_SECRET ?? ""}|${process.env.APP_CLAVE ?? ""}`;
}

async function firmar(cuerpo: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(material()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(cuerpo));
  return hex(new Uint8Array(f));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function emitirCookie(ahora = Date.now()): Promise<string> {
  const exp = ahora + DIAS_SESION * 86_400_000;
  const cuerpo = `${exp}.${hex(crypto.getRandomValues(new Uint8Array(16)))}`;
  return `${cuerpo}.${await firmar(cuerpo)}`;
}

export async function cookieValida(valor: string | undefined, ahora = Date.now()): Promise<boolean> {
  if (!valor) return false;
  const [exp, nonce, firma] = valor.split(".");
  if (!exp || !nonce || !firma || !/^\d+$/.test(exp) || Number(exp) < ahora) return false;
  return igual(await firmar(`${exp}.${nonce}`), firma);
}
