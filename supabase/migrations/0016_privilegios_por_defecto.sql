-- 0016_privilegios_por_defecto.sql
-- Las tablas, secuencias y funciones NUEVAS de public nacen cerradas a la API publica
-- (2026-10-12, con el si de Victor, pregunta 59). Hasta hoy, los privilegios por defecto
-- del rol postgres daban arwdDxtm a anon y authenticated en cada tabla nueva, y cada una
-- habia que cerrarla a mano (0006, 0007, 0009, 0014). Asi nacio el hueco de H-63/H-64.
--
-- Solo cambia lo que se crea de aqui en adelante: no toca ninguna tabla ni funcion que ya
-- exista. service_role (el servidor) conserva todo. Una tabla nueva que si deba leerse
-- desde el navegador necesita su GRANT explicito y su politica RLS en la misma migracion.
-- Los privilegios por defecto de supabase_admin (tablas creadas por la plataforma) no se
-- pueden cambiar desde postgres y no se tocan.
begin;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
-- Funciones: el EXECUTE a PUBLIC viene del default cableado de Postgres y una entrada por
-- esquema no lo quita (solo suma). Hace falta la entrada global del rol (auditoria de
-- Fable de 4ce14d7). Afecta a las funciones nuevas de postgres en cualquier esquema; hoy
-- postgres solo crea funciones en public (storage, auth y realtime las crean los roles de
-- Supabase, con sus propias entradas).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

commit;

-- Verificacion (en una transaccion que se deshace):
--   begin;
--   create table public._prueba_privilegios (id int);
--   select has_table_privilege('anon', 'public._prueba_privilegios', 'SELECT'),
--          has_table_privilege('authenticated', 'public._prueba_privilegios', 'INSERT'),
--          has_table_privilege('service_role', 'public._prueba_privilegios', 'SELECT');
--   -- esperado: f, f, t
--   create function public._prueba_fn() returns int language sql as 'select 1';
--   select has_function_privilege('anon', 'public._prueba_fn()', 'EXECUTE'),
--          has_function_privilege('authenticated', 'public._prueba_fn()', 'EXECUTE'),
--          has_function_privilege('service_role', 'public._prueba_fn()', 'EXECUTE');
--   -- esperado: f, f, t
--   create sequence public._prueba_seq;
--   select has_sequence_privilege('anon', 'public._prueba_seq', 'USAGE');  -- f
--   rollback;
