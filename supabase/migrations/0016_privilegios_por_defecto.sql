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
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

commit;

-- Verificacion (en una transaccion que se deshace):
--   begin;
--   create table public._prueba_privilegios (id int);
--   select has_table_privilege('anon', 'public._prueba_privilegios', 'SELECT'),
--          has_table_privilege('authenticated', 'public._prueba_privilegios', 'INSERT'),
--          has_table_privilege('service_role', 'public._prueba_privilegios', 'SELECT');
--   -- esperado: f, f, t
--   rollback;
