"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { almacen } from "@/lib/almacen";
import { COOKIE, cookieValida } from "@/lib/sesion";
import { aniosPorDefecto, sincronizar } from "@/lib/sincronizar";

/** La acción comprueba la sesión por sí misma, sin depender del proxy. */
async function sesionValida(): Promise<boolean> {
  if (!process.env.APP_CLAVE) return true;
  return cookieValida((await cookies()).get(COOKIE)?.value);
}

/** Botón «Actualizar ahora»: revisa la Tesorería y vuelve al tablero con el resultado real. */
export async function actualizarAhora() {
  if (!(await sesionValida())) redirect("/login");
  let estado = "error";
  let detalle = "";
  try {
    const r = await sincronizar(almacen(), aniosPorDefecto(), { limiteMs: 50_000, log: () => {} });
    estado = r.estado;
    detalle = r.detalle;
  } catch (e) {
    detalle = (e as Error).message; // p. ej. faltan variables: el tablero ya explica cuáles
  }
  revalidatePath("/");
  redirect(`/?sync=1&estado=${estado}&detalle=${encodeURIComponent(detalle.slice(0, 600))}`);
}
