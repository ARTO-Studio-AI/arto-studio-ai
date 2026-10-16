-- 0019_digest_sends.sql
-- Registro de los prompts que salieron en el resumen semanal (16 oct 2026).
--
-- Victor aprobo el digest de marca (PR #99) con una regla: nunca se repite un prompt en
-- el resumen. Cada envio deja una fila con su fecha y los ids que llevo; la seleccion de
-- la semana excluye todo lo que ya aparece aqui. Una fila por dia (sent_on unica): si la
-- funcion se relanza el mismo dia, reutiliza la seleccion en vez de sortear otra.
--
-- ORDEN: aplicar ANTES de mergear el PR #99. Sin la tabla, la ruta responde 500 y no
-- manda nada (falla cerrado).
--
-- Solo crea una tabla nueva: no toca ninguna existente. RLS activo sin politicas y sin
-- grants a anon ni authenticated (0016 ya los quita por defecto; el revoke es explicito
-- igual). La lee y escribe solo el servidor con service role.
begin;

create table if not exists public.digest_sends (
  id          bigint generated always as identity primary key,
  sent_on     date        not null,
  prompt_ids  text[]      not null,
  strategy    text        not null default 'new_then_random',
  created_at  timestamptz not null default now(),
  constraint digest_sends_sent_on_key unique (sent_on),
  constraint digest_sends_prompt_ids_check check (cardinality(prompt_ids) between 1 and 20)
);

comment on table public.digest_sends is
  'Prompts enviados en cada resumen semanal. La seleccion excluye todos los ids de esta tabla (regla de Victor del 16 oct: nunca repetir).';

alter table public.digest_sends enable row level security;
revoke all on table public.digest_sends from anon, authenticated;

commit;

notify pgrst, 'reload schema';
