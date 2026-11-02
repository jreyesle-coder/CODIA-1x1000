/** Acceso por contraseña compartida (APP_CLAVE). Sin APP_CLAVE la app queda abierta (uso local). */
export const COOKIE = "codia1x1000";

export async function huella(clave: string) {
  const datos = new TextEncoder().encode(`codia-1x1000:${clave}`);
  const h = await crypto.subtle.digest("SHA-256", datos);
  return Buffer.from(h).toString("hex");
}
