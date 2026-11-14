-- Spec 003 · ticket T6 (#8): missões criadas pelo admin no painel.
-- Espelha o schema `Mission` de src/domain/schemas.ts. `requirement` e `launch`
-- são uniões discriminadas (Zod) guardadas em jsonb; o banco confere o discriminante.

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  description text not null default '' check (char_length(description) <= 280),
  requirement jsonb not null check (requirement ->> 'kind' in (
    'qr_scan', 'visit_streak', 'purchase', 'purchase_category', 'event_checkin'
  )),
  points_reward integer not null check (points_reward > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_completions_per_user integer not null default 1 check (max_completions_per_user > 0),
  -- null = missão criada pelo próprio shopping.
  store_id uuid references public.stores (id),
  launch jsonb not null default '{"type": "scheduled"}' check (launch ->> 'type' in ('scheduled', 'flash')),
  -- Quem criou. Fica null se o perfil for apagado (LGPD): a missão continua no histórico.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Critério 9: a missão termina depois de começar.
  constraint missions_period check (ends_at > starts_at),
  -- RF09: Missão Relâmpago sempre tem título e texto do push e multiplicador de 1 a 5.
  constraint missions_flash_push check (
    case launch ->> 'type'
      when 'flash' then
        char_length(coalesce(launch ->> 'pushTitle', '')) between 3 and 50
        and char_length(coalesce(launch ->> 'pushBody', '')) between 3 and 120
        and case jsonb_typeof(launch -> 'pointsMultiplier')
          when 'number' then (launch ->> 'pointsMultiplier')::numeric in (1, 2, 3, 4, 5)
          else false
        end
      else true
    end
  )
);
create index missions_store_id_idx on public.missions (store_id) where store_id is not null;
create index missions_created_by_idx on public.missions (created_by) where created_by is not null;
-- O app do visitante busca as missões que ainda não terminaram.
create index missions_ends_at_idx on public.missions (ends_at);

-- ------------------------------------------------------------------
-- Encerrar (UC4, critério 12) = `update ... set ends_at = now()`.
-- Editar missão está fora do escopo, então a única mudança aceita é
-- antecipar o fim de uma missão ATIVA para o instante do banco (`now()`),
-- seja qual for o valor enviado. Decisão: missão futura não é
-- encerrada (o fim ficaria antes do início); no MVP ela fica como está.
-- Erro com SQLSTATE check_violation, o mesmo do CHECK `missions_period`.
-- ------------------------------------------------------------------
create function private.missions_only_end_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.starts_at > now() or old.ends_at <= now() then
    raise exception 'Só uma missão ativa pode ser encerrada'
      using errcode = 'check_violation';
  end if;
  -- O relógio do banco manda: qualquer valor enviado vira "agora".
  new.ends_at := now();
  return new;
end;
$$;
revoke execute on function private.missions_only_end_active() from public, anon, authenticated;

create trigger missions_only_end_active
  before update of ends_at on public.missions
  for each row execute function private.missions_only_end_active();

-- ------------------------------------------------------------------
-- RLS (RNF01, RNF02). Todo logado lê missões; só o admin cria e encerra.
-- ------------------------------------------------------------------
alter table public.missions enable row level security;

-- O Supabase concede ALL a anon e authenticated em tabelas novas do schema
-- public. Tiramos tudo e devolvemos só o mínimo.
revoke all on public.missions from anon, authenticated;
grant select, insert on public.missions to authenticated;
-- Só o fim muda depois de criada (encerrar).
grant update (ends_at) on public.missions to authenticated;

create policy missions_read on public.missions
  for select to authenticated
  using (true);

create policy missions_admin_insert on public.missions
  for insert to authenticated
  with check (
    (select private.staff_role()) = 'admin'
    and created_by = (select auth.uid())
  );

create policy missions_admin_update on public.missions
  for update to authenticated
  using ((select private.staff_role()) = 'admin')
  with check ((select private.staff_role()) = 'admin');
