-- CODIA 1x1000 · acceso
-- Lectura: abierta a la clave pública (datos públicos de la Tesorería).
-- Escritura: solo a través de funciones que exigen el secreto del sincronizador (CRON_SECRET).
--
-- Después de correr este archivo, guarde el hash del secreto (nunca el secreto) con:
--   insert into privado.secretos (nombre, hash_sha256)
--   values ('sync', encode(sha256(convert_to('EL-SECRETO', 'UTF8')), 'hex'))
--   on conflict (nombre) do update set hash_sha256 = excluded.hash_sha256;

create policy "lectura_publica" on archivos_tn      for select to anon, authenticated using (true);
create policy "lectura_publica" on pagos_obras      for select to anon, authenticated using (true);
create policy "lectura_publica" on sincronizaciones for select to anon, authenticated using (true);
grant select on archivos_tn, pagos_obras, sincronizaciones to anon, authenticated;
revoke insert, update, delete on archivos_tn, pagos_obras, sincronizaciones from anon, authenticated;

-- El secreto se guarda solo como hash, en un esquema que la API no expone.
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create table if not exists privado.secretos (
  nombre       text primary key,
  hash_sha256  text not null
);

create or replace function privado.secreto_valido(p_nombre text, p_secreto text) returns boolean
language sql security definer set search_path = privado, pg_temp as $$
  select exists (
    select 1 from privado.secretos
    where nombre = p_nombre and hash_sha256 = encode(sha256(convert_to(p_secreto, 'UTF8')), 'hex')
  );
$$;
revoke all on function privado.secreto_valido(text, text) from public, anon, authenticated;

-- Reemplaza los pagos de un mes y registra el archivo del que salieron. Devuelve filas insertadas.
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
  delete from pagos_obras where anio = v_anio and mes = v_mes;
  insert into pagos_obras (anio, mes, moneda, fecha, institucion, unidad_ejecutora, libramiento, proveedor, concepto, monto_bruto, retencion, monto_neto, cesion)
  select anio, mes, moneda, fecha, institucion, unidad_ejecutora, libramiento, proveedor, concepto, monto_bruto, retencion, monto_neto, cesion
  from jsonb_to_recordset(p_filas) as f(
    anio int, mes int, moneda text, fecha date, institucion text, unidad_ejecutora text, libramiento text,
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

create or replace function public.sync_registrar(p_secreto text, p_inicio timestamptz, p_fin timestamptz, p_estado text, p_detalle text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not privado.secreto_valido('sync', p_secreto) then
    raise exception 'Secreto de sincronización inválido' using errcode = '28000';
  end if;
  insert into sincronizaciones (inicio, fin, estado, detalle) values (p_inicio, p_fin, p_estado, p_detalle);
end $$;

revoke all on function public.sync_reemplazar_mes(text, jsonb, jsonb) from public;
revoke all on function public.sync_registrar(text, timestamptz, timestamptz, text, text) from public;
grant execute on function public.sync_reemplazar_mes(text, jsonb, jsonb) to anon, service_role;
grant execute on function public.sync_registrar(text, timestamptz, timestamptz, text, text) to anon, service_role;
