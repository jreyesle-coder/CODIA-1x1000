"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { almacen } from "@/lib/almacen";
import { aniosPorDefecto, sincronizar } from "@/lib/sincronizar";

/** Botón «Actualizar ahora»: revisa la Tesorería y recarga el tablero. */
export async function actualizarAhora() {
  try {
    await sincronizar(almacen(), aniosPorDefecto(), { limiteMs: 50_000, log: () => {} });
  } catch {
    // Sin configuración no hay dónde guardar: el tablero ya explica qué falta.
  }
  revalidatePath("/");
  redirect("/?sync=1");
}
