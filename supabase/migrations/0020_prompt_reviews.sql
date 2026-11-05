-- 0020_prompt_reviews.sql
-- Revision de Victor a los prompts que suben las rondas de Code (2026-11-05, ficha de
-- Victor: «Salen y los reviso despues»). Las rondas siguen publicando como hoy; cada alta
-- queda en catalog_changes (0015) y aparece en /admin/revision hasta que Victor la aprueba
-- o la despublica. Esta tabla guarda esa decision, una fila por prompt.
--
-- Solo crea una tabla nueva: no toca ninguna existente (la llave foranea solo lee
-- prompts.id). RLS activo sin politicas, sin privilegios para anon ni authenticated (0016
-- ya los quita por defecto; el revoke va explicito igual, D16) y grant explicito a
-- service_role, que es el unico que la lee y escribe, desde el servidor.
--
-- Sin la tabla, /admin/revision muestra el error de lectura y no lista nada; el resto del
-- sitio no la usa. Se puede aplicar antes o despues del merge.
begin;

create table if not exists public.prompt_reviews (
  prompt_id   text        primary key references public.prompts (id) on delete cascade,
  status      text        not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  constraint prompt_reviews_status_check check (status in ('pending', 'approved', 'unpublished')),
  -- Una decision siempre dice quien y cuando.
  constraint prompt_reviews_decision_check check (status = 'pending' or (reviewed_by is not null and reviewed_at is not null)),
  constraint prompt_reviews_note_check check (note is null or char_length(note) <= 2000)
);

create index if not exists prompt_reviews_status_idx on public.prompt_reviews (status);

comment on table public.prompt_reviews is
  'Revision de Victor a las altas del catalogo (2026-11-05). Pendiente = alta en catalog_changes sin fila approved o unpublished aqui.';

alter table public.prompt_reviews enable row level security;
revoke all on table public.prompt_reviews from anon, authenticated;
grant select, insert, update, delete on table public.prompt_reviews to service_role;

notify pgrst, 'reload schema';
commit;

-- Verificacion (despues de aplicar):
--   select has_table_privilege('anon', 'public.prompt_reviews', 'SELECT'),            -- f
--          has_table_privilege('authenticated', 'public.prompt_reviews', 'SELECT'),   -- f
--          has_table_privilege('service_role', 'public.prompt_reviews', 'SELECT'),    -- t
--          relrowsecurity from pg_class where oid = 'public.prompt_reviews'::regclass; -- t
-- Y con la llave de servicio: GET /rest/v1/prompt_reviews?select=prompt_id&limit=1 -> 200 []
