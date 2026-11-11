-- CODIA 1x1000 · 003: candado por mes y anio/mes forzados en sync_reemplazar_mes
-- (misma firma que en 002; los permisos se conservan)
create or replace function public.sync_reemplazar_mes(p_secreto text, p_archivo jsonb, p_filas jsonb) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_anio int := (p_archivo->>'anio')::int;
  v_mes  int := (p_archivo->>'mes')::int;
  v_n    int;
begin
  if not privado.secreto_valido('sync', p_secreto) then
    raise exception 'Secreto de sincronización inválido' using errcode = '28000';
  end if;
  -- Serializa las corridas del mismo mes (cron + «Actualizar ahora»): la segunda espera a que la
  -- primera confirme y su DELETE ya ve esas filas, así no quedan duplicados.
  perform pg_advisory_xact_lock(hashtext('sync_reemplazar_mes'), v_anio * 100 + v_mes);
  delete from pagos_obras where anio = v_anio and mes = v_mes;
  -- anio y mes se toman del archivo que se reemplaza, nunca de cada fila.
  insert into pagos_obras (anio, mes, moneda, fecha, institucion, unidad_ejecutora, libramiento, proveedor, concepto, monto_bruto, retencion, monto_neto, cesion)
  select v_anio, v_mes, moneda, fecha, institucion, unidad_ejecutora, libramiento, proveedor, concepto, monto_bruto, retencion, monto_neto, cesion
  from jsonb_to_recordset(p_filas) as f(
    moneda text, fecha date, institucion text, unidad_ejecutora text, libramiento text,
    proveedor text, concepto text, monto_bruto numeric, retencion numeric, monto_neto numeric, cesion boolean);
  get diagnostics v_n = row_count;
  insert into archivos_tn (anio, mes, phoca_id, titulo, url, sha256, filas_obras, descargado_en)
  values (v_anio, v_mes, (p_archivo->>'phoca_id')::int, p_archivo->>'titulo', p_archivo->>'url', p_archivo->>'sha256',
          (p_archivo->>'filas_obras')::int, coalesce((p_archivo->>'descargado_en')::timestamptz, now()))
  on conflict (anio, mes) do update set
    phoca_id = excluded.phoca_id, titulo = excluded.titulo, url = excluded.url, sha256 = excluded.sha256,
    filas_obras = excluded.filas_obras, descargado_en = excluded.descargado_en;
  return v_n;
end $$;
