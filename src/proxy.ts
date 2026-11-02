import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, huella } from "@/lib/sesion";

/** Pide la contraseña a quien no tenga la cookie de sesión. */
export async function proxy(request: NextRequest) {
  const clave = process.env.APP_CLAVE;
  if (!clave || request.nextUrl.pathname === "/login") return NextResponse.next();
  if (request.cookies.get(COOKIE)?.value === (await huella(clave))) return NextResponse.next();
  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = "";
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
