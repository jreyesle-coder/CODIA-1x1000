import { beforeEach, describe, expect, it } from "vitest";
import { cookieValida, emitirCookie } from "./sesion";

describe("sesión", () => {
  beforeEach(() => {
    process.env.APP_CLAVE = "clave-de-prueba";
    process.env.CRON_SECRET = "secreto-de-prueba";
  });

  it("acepta la cookie emitida y rechaza alteraciones", async () => {
    const c = await emitirCookie();
    expect(await cookieValida(c)).toBe(true);
    expect(await cookieValida(c.slice(0, -1) + (c.endsWith("0") ? "1" : "0"))).toBe(false);
    expect(await cookieValida(undefined)).toBe(false);
    expect(await cookieValida("basura")).toBe(false);
    expect(await cookieValida("")).toBe(false);
  });

  it("caduca a los 30 días", async () => {
    const c = await emitirCookie(0);
    expect(await cookieValida(c, 29 * 86_400_000)).toBe(true);
    expect(await cookieValida(c, 31 * 86_400_000)).toBe(false);
  });

  it("cambiar la contraseña cierra todas las sesiones", async () => {
    const c = await emitirCookie();
    process.env.APP_CLAVE = "otra";
    expect(await cookieValida(c)).toBe(false);
  });

  it("cada sesión es distinta y no deriva solo de la contraseña", async () => {
    expect(await emitirCookie()).not.toBe(await emitirCookie());
  });
});
