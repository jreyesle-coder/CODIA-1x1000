import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, huella } from "@/lib/sesion";

/** Pide la contraseña a quien no tenga la cookie de sesión. /api/sync se protege solo, con CRON_SECRET. */
export async function proxy(request: NextRequest) {
  const clave = process.env.APP_CLAVE;
  const ruta = request.nextUrl.pathname;
  if (!clave || ruta === "/login" || ruta.startsWith("/api/sync")) return NextResponse.next();
  if (request.cookies.get(COOKIE)?.value === (await huella(clave))) return NextResponse.next();
  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = "";
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
