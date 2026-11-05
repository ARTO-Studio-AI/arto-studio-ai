-- 0022_promotions.sql
-- Promociones administrables desde /admin/promociones (2026-11-05). Pedido de Victor: «Estas
-- promos van a ser algo usual y vamos a empezar a poner cada vez mas. Hay que disenar un
-- sistema para poderlas levantar y quitar rapidamente, desde el backend.»
--
-- Dos tablas nuevas. No toca ninguna tabla, funcion ni politica que ya exista.
--   promotions          una fila por promo: tipo (porcentaje, monto fijo o dias de prueba),
--                       valor, meses, cupon de Stripe (solo el id; el cupon lo crea Victor en
--                       Stripe), horas del reloj, publico, fechas, interruptor y textos ES/EN.
--                       La valida el servidor con src/lib/promos/tipos.ts antes de guardar y
--                       al leer; los CHECK de aqui son la segunda puerta.
--   promotion_changes   registro de cada cambio hecho en /admin: quien, cuando, de que a que.
--
-- Las dos nacen cerradas (D16): RLS activo, sin politicas, sin privilegios para anon ni
-- authenticated (0016 ya los quita por defecto; el revoke es explicito igual) y grant
-- explicito a service_role. Solo las lee y escribe el servidor con service role.
--
-- ORDEN: se puede aplicar antes o despues de mergear. Sin la tabla el sitio sigue con la
-- promo de STRIPE_PROMO_COUPON_24H, igual que hoy, y /admin/promociones avisa en rojo. Con la
-- tabla vacia, igual. En cuanto hay una fila (aunque este apagada) la variable deja de contar.
-- Idempotente: se puede correr dos veces.
begin;

create table if not exists public.promotions (
  id                  text        primary key,
  name                text        not null,
  kind                text        not null,
  percent_off         numeric(5, 2),
  amount_off_cents    integer,
  currency            text,
  duration_months     integer,
  trial_days          integer,
  stripe_coupon_id    text,
  clock_hours         integer     not null,
  audience            text        not null,
  utm_campaign        text,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  enabled             boolean     not null default false,
  copy                jsonb       not null,
  coupon_verified_at  timestamptz,
  coupon_snapshot     jsonb,
  created_by          text        not null,
  created_at          timestamptz not null default now(),
  updated_by          text        not null,
  updated_at          timestamptz not null default now(),
  constraint promotions_id_check check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 60),
  constraint promotions_name_check check (char_length(name) between 1 and 120),
  constraint promotions_kind_check check (kind in ('percent', 'amount', 'trial')),
  -- Cada tipo con sus campos y sin los de los otros. Los «is not null» van explicitos porque
  -- un CHECK que da null deja pasar la fila.
  constraint promotions_percent_check check (
    kind <> 'percent' or (
      percent_off is not null and percent_off > 0 and percent_off <= 100
      and amount_off_cents is null and currency is null and trial_days is null
      and stripe_coupon_id is not null and duration_months is not null and duration_months between 1 and 36
    )
  ),
  constraint promotions_amount_check check (
    kind <> 'amount' or (
      amount_off_cents is not null and amount_off_cents > 0
      and currency is not null and currency ~ '^[a-z]{3}$'
      and percent_off is null and trial_days is null
      and stripe_coupon_id is not null and duration_months is not null and duration_months between 1 and 36
    )
  ),
  constraint promotions_trial_check check (
    kind <> 'trial' or (
      trial_days is not null and trial_days between 1 and 730
      and percent_off is null and amount_off_cents is null and currency is null
      and stripe_coupon_id is null and duration_months is null
    )
  ),
  constraint promotions_coupon_check check (stripe_coupon_id is null or stripe_coupon_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  constraint promotions_clock_check check (clock_hours between 1 and 720),
  constraint promotions_audience_check check (audience in ('anon', 'free_never_pro', 'utm')),
  constraint promotions_utm_check check (
    (audience = 'utm' and utm_campaign is not null and char_length(utm_campaign) between 1 and 200)
    or (audience <> 'utm' and utm_campaign is null)
  ),
  constraint promotions_dates_check check (ends_at > starts_at),
  constraint promotions_copy_check check (
    jsonb_typeof(copy) = 'object'
    and jsonb_typeof(copy -> 'es') = 'object'
    and jsonb_typeof(copy -> 'en') = 'object'
  ),
  -- Una promo con cupon no se prende sin haber leido el cupon en Stripe.
  constraint promotions_verified_check check (not enabled or kind = 'trial' or coupon_verified_at is not null)
);

create index if not exists promotions_live_idx on public.promotions (audience, starts_at desc) where enabled;

comment on table public.promotions is
  'Promociones de Pro administradas en /admin/promociones (2026-11-05). El sitio las lee con cache de 60 s. Si la tabla esta vacia o no existe, sale la promo de STRIPE_PROMO_COUPON_24H.';

create table if not exists public.promotion_changes (
  id            bigint      generated always as identity primary key,
  promotion_id  text        not null,
  action        text        not null,
  before        jsonb,
  after         jsonb,
  changed_by    text        not null,
  created_at    timestamptz not null default now(),
  constraint promotion_changes_action_check check (action in ('create', 'update', 'enable', 'disable'))
);

create index if not exists promotion_changes_created_idx on public.promotion_changes (created_at desc);
create index if not exists promotion_changes_promo_idx on public.promotion_changes (promotion_id, created_at desc);

comment on table public.promotion_changes is
  'Cada cambio hecho en /admin/promociones: quien, cuando y de que a que (before y after).';

alter table public.promotions enable row level security;
alter table public.promotion_changes enable row level security;
revoke all on table public.promotions from anon, authenticated;
revoke all on table public.promotion_changes from anon, authenticated;
revoke all on sequence public.promotion_changes_id_seq from anon, authenticated;
-- Grant explicito a service_role (D16), igual que en la 0020 y la 0021.
grant select, insert, update, delete on table public.promotions, public.promotion_changes to service_role;
grant usage, select on sequence public.promotion_changes_id_seq to service_role;

commit;

notify pgrst, 'reload schema';

-- Verificacion (despues de aplicar):
--   select has_table_privilege('anon', 'public.promotions', 'SELECT'),               -- f
--          has_table_privilege('authenticated', 'public.promotions', 'SELECT'),      -- f
--          has_table_privilege('authenticated', 'public.promotion_changes', 'INSERT'), -- f
--          has_table_privilege('service_role', 'public.promotions', 'INSERT'),       -- t
--          has_table_privilege('service_role', 'public.promotion_changes', 'INSERT'); -- t
--   select relname, relrowsecurity from pg_class
--    where oid in ('public.promotions'::regclass, 'public.promotion_changes'::regclass); -- t, t
--   select count(*) from pg_policies where tablename in ('promotions', 'promotion_changes'); -- 0
-- Y con la llave de servicio: GET /rest/v1/promotions?select=id&limit=1 -> 200 []
--
-- Para deshacer (sin datos que conservar; al quitarla el sitio vuelve a la variable):
--   drop table public.promotion_changes, public.promotions;
