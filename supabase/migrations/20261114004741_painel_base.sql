-- Spec 003 · ticket T2 (#4): base do banco para o painel do shopping.
-- Tabelas: stores, profiles (com papel), checkpoints, rewards, redemptions.
-- Os valores de texto espelham os enums de src/domain/schemas.ts.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Lojas
-- ------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  -- CNPJ alfanumérico a partir de jul/2026: 12 posições [0-9A-Z] + 2 dígitos.
  cnpj text not null unique check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  category text not null check (category in (
    'vestuario', 'calcados', 'alimentacao', 'beleza', 'eletronicos',
    'esportes', 'livraria', 'casa', 'lazer', 'servicos'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Perfis: um por usuário do Supabase Auth. `staff_role` libera o painel (D2).
-- ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  points integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  staff_role text check (staff_role in ('admin', 'lojista')),
  store_id uuid references public.stores (id),
  created_at timestamptz not null default now(),
  -- Lojista sempre tem loja; admin e visitante nunca (D1, D6).
  constraint profiles_store_matches_role check (
    (staff_role = 'lojista') = (store_id is not null)
  )
);
create index profiles_store_id_idx on public.profiles (store_id) where store_id is not null;

-- Cria o perfil no primeiro login por link mágico.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Papel e loja de quem está logado. Lidos uma vez por consulta nas políticas.
create function private.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select staff_role from public.profiles where id = (select auth.uid());
$$;

create function private.staff_store_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select store_id from public.profiles where id = (select auth.uid());
$$;

grant usage on schema private to authenticated;
revoke execute on function private.staff_role(), private.staff_store_id() from public, anon;
grant execute on function private.staff_role(), private.staff_store_id() to authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Checkpoints: pontos físicos com QR. `store_id null` = ponto do shopping.
-- ------------------------------------------------------------------
create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id),
  label text not null check (char_length(btrim(label)) between 2 and 60),
  dynamic_qr boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- UC6: nome repetido na mesma loja (ou dois iguais do shopping) é erro.
  constraint checkpoints_label_per_store unique nulls not distinct (store_id, label)
);

-- ------------------------------------------------------------------
-- Recompensas: entram por seed no MVP (D5). `benefit` segue RewardBenefit (Zod).
-- ------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  cost_points integer not null check (cost_points > 0),
  benefit jsonb not null check (
    benefit ->> 'kind' in ('discount_percent', 'discount_fixed', 'free_parking', 'gift')
    and ((benefit ->> 'kind' = 'free_parking') = (benefit ->> 'storeId' is null))
  ),
  -- Loja dona do benefício; null = benefício do shopping (só o admin valida — D6).
  store_id uuid generated always as ((benefit ->> 'storeId')::uuid) stored
    references public.stores (id),
  stock integer check (stock >= 0),
  min_tier text not null default 'bronze' check (min_tier in ('bronze', 'prata', 'ouro', 'diamante')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index rewards_store_id_idx on public.rewards (store_id) where store_id is not null;

-- ------------------------------------------------------------------
-- Resgates: espelham a união Redemption (reserved | redeemed | expired).
-- ------------------------------------------------------------------
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id),
  status text not null check (status in ('reserved', 'redeemed', 'expired')),
  code text check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz,
  redeemed_at timestamptz,
  expired_at timestamptz,
  validated_by uuid references public.profiles (id),
  validated_by_store_id uuid references public.stores (id),
  created_at timestamptz not null default now(),
  -- Estado inválido não entra no banco, como no tipo.
  constraint redemptions_state check (
    case status
      when 'reserved' then code is not null and expires_at is not null
        and redeemed_at is null and validated_by is null
      when 'redeemed' then code is not null and redeemed_at is not null
        and validated_by is not null  -- RNF12: quem validou fica registrado
      when 'expired' then expired_at is not null and redeemed_at is null
    end
  )
);
create index redemptions_user_id_idx on public.redemptions (user_id);
create index redemptions_reward_id_idx on public.redemptions (reward_id);
create index redemptions_validated_by_idx on public.redemptions (validated_by) where validated_by is not null;
create index redemptions_validated_by_store_id_idx on public.redemptions (validated_by_store_id)
  where validated_by_store_id is not null;
-- Código de 6 dígitos é único entre os cupons de resgate ainda válidos.
create unique index redemptions_reserved_code_key on public.redemptions (code) where status = 'reserved';

-- ------------------------------------------------------------------
-- RLS (RNF02). Escritas sensíveis passam por funções do servidor (T7),
-- então `authenticated` só ganha o mínimo.
-- ------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.checkpoints enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

-- O Supabase concede ALL a anon e authenticated em tabelas novas do schema
-- public. Tiramos tudo e devolvemos só o mínimo, coluna a coluna quando preciso.
revoke all on public.stores, public.profiles, public.checkpoints, public.rewards, public.redemptions
  from anon, authenticated;

grant select on public.stores, public.checkpoints, public.rewards to authenticated;
grant select on public.profiles, public.redemptions to authenticated;
grant insert, update on public.checkpoints to authenticated;
-- Ninguém muda o próprio papel, loja ou pontos pelo cliente: só o nome.
grant update (name) on public.profiles to authenticated;

create policy stores_read on public.stores
  for select to authenticated using (true);

create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.staff_role()) = 'admin');

create policy profiles_update_own_name on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy checkpoints_read on public.checkpoints
  for select to authenticated
  using (active or (select private.staff_role()) = 'admin');

create policy checkpoints_admin_insert on public.checkpoints
  for insert to authenticated
  with check ((select private.staff_role()) = 'admin');

create policy checkpoints_admin_update on public.checkpoints
  for update to authenticated
  using ((select private.staff_role()) = 'admin')
  with check ((select private.staff_role()) = 'admin');

create policy rewards_read on public.rewards
  for select to authenticated
  using (active or (select private.staff_role()) = 'admin');

-- Visitante vê os seus; admin vê todos; lojista vê os da própria loja.
create policy redemptions_read on public.redemptions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.staff_role()) = 'admin'
    or (
      (select private.staff_role()) = 'lojista'
      and exists (
        select 1 from public.rewards r
        where r.id = redemptions.reward_id
          and r.store_id = (select private.staff_store_id())
      )
    )
  );

-- ------------------------------------------------------------------
-- D8: equipe é criada pelo time, no SQL Editor (service role), depois do
-- primeiro login da pessoa por link mágico.
--   select private.grant_staff('marketing@shopping.com', 'admin', null);
--   select private.grant_staff('gerente@loja.com', 'lojista', '<store uuid>');
-- ------------------------------------------------------------------
create function private.grant_staff(p_email text, p_role text, p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'Usuário % ainda não entrou no app. Peça para fazer o primeiro login.', p_email;
  end if;
  update public.profiles
     set staff_role = p_role, store_id = p_store_id
   where id = v_user;
end;
$$;
revoke execute on function private.grant_staff(text, text, uuid) from public, anon, authenticated;
