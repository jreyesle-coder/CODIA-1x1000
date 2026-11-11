/** Se muestra mientras una página carga sus datos. */
export default function Cargando() {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-tinta-2" role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-codia border-t-transparent" />
      Cargando…
    </div>
  );
}
