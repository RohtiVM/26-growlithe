-- Growlithe · esquema inicial (Supabase / Postgres 15+)
--
-- Espelha os tipos de src/domain/schemas.ts e o banco em memória de src/server/db.ts.
-- Regras que o banco garante sozinho (mesmo com requisições simultâneas):
--   * 1 scan por visitante, por ponto, por dia ............ UNIQUE scans(user_id, checkpoint_id, scanned_on)
--   * cupom fiscal vale uma vez no sistema inteiro ........ UNIQUE receipts(access_key_hash)
--   * missão não passa do limite por visitante ............ award_mission / award_receipt com FOR UPDATE
--   * saldo nunca negativo, código de resgate único ....... CHECK + índice parcial
--   * pontos só mudam por função (livro-razão append-only)  credit_points
--
-- Segurança: RLS ligada SEM políticas. Só o servidor (service role) acessa;
-- a chave anônima não lê nem escreve nada.

-- ------------------------------------------------------------------
-- Lojas e checkpoints
-- ------------------------------------------------------------------

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  cnpj char(14) not null unique check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  category text not null check (category in (
    'vestuario','calcados','alimentacao','beleza','eletronicos',
    'esportes','livraria','casa','lazer','servicos')),
  active boolean not null default true
);

create table checkpoints (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 2 and 80),
  kind text not null check (kind in ('entrance','store','event','spot')),
  store_id uuid references stores(id),
  scan_points int not null default 0 check (scan_points between 0 and 500),
  hint text check (char_length(hint) <= 140),
  active boolean not null default true
);

-- ------------------------------------------------------------------
-- Visitantes (perfil ligado ao auth.users quando o Supabase Auth entrar)
-- ------------------------------------------------------------------

create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null unique,
  phone text check (phone ~ '^\+55[0-9]{10,11}$'),
  points int not null default 0 check (points >= 0),
  lifetime_points int not null default 0 check (lifetime_points >= 0),
  presence_status text not null default 'away' check (presence_status in ('away','at_mall')),
  checked_in_at timestamptz,
  entrance text,
  last_visit_at timestamptz,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Presence é união discriminada no domínio: "at_mall" exige hora e entrada.
  constraint presence_consistent check (
    presence_status = 'away' or (checked_in_at is not null and entrance is not null)
  )
);

-- ------------------------------------------------------------------
-- Missões e progresso
-- ------------------------------------------------------------------

create table missions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  description text not null default '' check (char_length(description) <= 280),
  requirement jsonb not null check (requirement ? 'kind'),   -- validado por MissionRequirement (Zod)
  launch jsonb not null check (launch ? 'type'),             -- validado por MissionLaunch (Zod)
  points_reward int not null check (points_reward > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_completions_per_user int not null default 1 check (max_completions_per_user > 0),
  store_id uuid references stores(id),
  created_at timestamptz not null default now(),
  constraint ends_after_start check (ends_at > starts_at)
);

create table mission_progress (
  user_id uuid not null references profiles(id),
  mission_id uuid not null references missions(id),
  found uuid[] not null default '{}',          -- caça ao tesouro: pontos da rodada atual
  started_at timestamptz not null default now(),
  completions int not null default 0 check (completions >= 0),
  last_completed_at timestamptz,
  points_awarded int not null default 0 check (points_awarded >= 0),
  primary key (user_id, mission_id)
);

-- ------------------------------------------------------------------
-- Eventos: scans, livro-razão e cupons fiscais
-- ------------------------------------------------------------------

create table scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id),
  checkpoint_id uuid not null references checkpoints(id),
  scanned_on date not null,          -- dia local do shopping (America/Araguaina)
  scanned_at timestamptz not null default now(),
  unique (user_id, checkpoint_id, scanned_on)
);
create index scans_day_idx on scans (scanned_on);

create table point_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id),
  delta int not null check (delta <> 0),
  reason text not null check (reason in (
    'checkpoint_scan','mission_completed','receipt','redemption','redemption_refund')),
  ref_id text not null,
  created_at timestamptz not null default now()
);
create index point_ledger_user_idx on point_ledger (user_id, created_at desc);

-- LGPD: guardamos o hash da chave, a loja e a hora. Nunca a chave nem o CPF.
create table receipts (
  access_key_hash char(64) primary key,
  user_id uuid not null references profiles(id),
  store_id uuid not null references stores(id),
  mission_id uuid not null references missions(id),
  verified_by text not null check (verified_by in ('local','sefaz')),
  scanned_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Recompensas e resgates
-- ------------------------------------------------------------------

create table rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  cost_points int not null check (cost_points > 0),
  benefit jsonb not null check (benefit ? 'kind'),   -- validado por RewardBenefit (Zod)
  stock int check (stock >= 0),                      -- null = ilimitado
  min_tier text not null default 'bronze' check (min_tier in ('bronze','prata','ouro','diamante')),
  active boolean not null default true
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  reward_id uuid not null references rewards(id),
  status text not null check (status in ('reserved','redeemed','expired')),
  code char(6),
  expires_at timestamptz,
  redeemed_at timestamptz,
  validated_by_store_id uuid references stores(id),
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  -- Mesma união discriminada do domínio: cada status só tem os campos dele.
  constraint redemption_state check (
    (status = 'reserved' and code is not null and expires_at is not null and redeemed_at is null)
    or (status = 'redeemed' and code is not null and redeemed_at is not null)
    or (status = 'expired' and expired_at is not null)
  )
);
-- Dois códigos abertos nunca colidem.
create unique index redemptions_open_code_idx on redemptions (code) where status = 'reserved';

-- ------------------------------------------------------------------
-- Landing page e push
-- ------------------------------------------------------------------

create table landing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null unique,
  profile text not null check (profile in ('visitante','lojista','shopping')),
  company text check (char_length(company) <= 80),
  variant char(1) not null check (variant in ('A','B')),
  utm_source text, utm_medium text, utm_campaign text,
  consent_lgpd boolean not null check (consent_lgpd),
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%'),
  user_id uuid not null references profiles(id),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- RLS: ligada em tudo, sem políticas (só a service role passa)
-- ------------------------------------------------------------------

alter table stores enable row level security;
alter table checkpoints enable row level security;
alter table profiles enable row level security;
alter table missions enable row level security;
alter table mission_progress enable row level security;
alter table scans enable row level security;
alter table point_ledger enable row level security;
alter table receipts enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;
alter table landing_leads enable row level security;
alter table push_subscriptions enable row level security;

-- ------------------------------------------------------------------
-- Funções transacionais (as únicas que mudam pontos)
-- ------------------------------------------------------------------

-- Lança no livro-razão e atualiza o saldo. Ganho soma nos pontos históricos; gasto e estorno não.
create function credit_points(p_user uuid, p_delta int, p_reason text, p_ref text)
returns void language plpgsql as $$
begin
  if p_delta = 0 then return; end if;
  insert into point_ledger (user_id, delta, reason, ref_id) values (p_user, p_delta, p_reason, p_ref);
  update profiles
     set points = points + p_delta,
         lifetime_points = lifetime_points
           + case when p_delta > 0 and p_reason <> 'redemption_refund' then p_delta else 0 end
   where id = p_user;
end $$;

-- Scan de checkpoint. Devolve 'ok', 'invalid_qr' ou 'already_scanned_today'
-- (os mesmos nomes de SCAN_ERRORS). O UNIQUE resolve a corrida de dois scans juntos.
create function record_scan(p_user uuid, p_checkpoint uuid, p_day date)
returns text language plpgsql as $$
declare
  cp checkpoints%rowtype;
begin
  select * into cp from checkpoints where id = p_checkpoint and active;
  if not found then return 'invalid_qr'; end if;

  insert into scans (user_id, checkpoint_id, scanned_on) values (p_user, p_checkpoint, p_day)
  on conflict (user_id, checkpoint_id, scanned_on) do nothing;
  if not found then return 'already_scanned_today'; end if;

  if cp.kind = 'entrance' then
    update profiles set presence_status = 'at_mall', checked_in_at = now(), entrance = cp.label
     where id = p_user;
  end if;
  perform credit_points(p_user, cp.scan_points, 'checkpoint_scan', p_checkpoint::text);
  return 'ok';
end $$;

-- Conclui uma missão respeitando o limite por visitante. A linha fica travada
-- (FOR UPDATE), então duas conclusões simultâneas não pagam em dobro.
create function award_mission(p_user uuid, p_mission uuid, p_points int)
returns boolean language plpgsql as $$
declare
  m missions%rowtype;
  done int;
begin
  select * into m from missions where id = p_mission;
  if not found then return false; end if;

  insert into mission_progress (user_id, mission_id) values (p_user, p_mission)
  on conflict (user_id, mission_id) do nothing;
  select completions into done from mission_progress
   where user_id = p_user and mission_id = p_mission for update;
  if done >= m.max_completions_per_user then return false; end if;

  update mission_progress
     set completions = completions + 1, found = '{}', last_completed_at = now(),
         points_awarded = points_awarded + p_points
   where user_id = p_user and mission_id = p_mission;
  perform credit_points(p_user, p_points, 'mission_completed', p_mission::text);
  return true;
end $$;

-- Missão Relâmpago com cupom fiscal: grava o cupom (único) e paga, numa transação só.
-- Devolve 'ok', 'receipt_already_used' ou 'mission_already_completed'.
create function award_receipt(
  p_user uuid, p_mission uuid, p_store uuid, p_hash text, p_points int, p_verified_by text
) returns text language plpgsql as $$
declare
  m missions%rowtype;
  done int;
begin
  select * into m from missions where id = p_mission;
  insert into mission_progress (user_id, mission_id) values (p_user, p_mission)
  on conflict (user_id, mission_id) do nothing;
  select completions into done from mission_progress
   where user_id = p_user and mission_id = p_mission for update;
  if done >= m.max_completions_per_user then return 'mission_already_completed'; end if;

  insert into receipts (access_key_hash, user_id, store_id, mission_id, verified_by)
  values (p_hash, p_user, p_store, p_mission, p_verified_by)
  on conflict (access_key_hash) do nothing;
  if not found then return 'receipt_already_used'; end if;

  update mission_progress
     set completions = completions + 1, last_completed_at = now(),
         points_awarded = points_awarded + p_points
   where user_id = p_user and mission_id = p_mission;
  perform credit_points(p_user, p_points, 'receipt', p_hash);
  return 'ok';
end $$;

-- Resgate: trava perfil e recompensa, confere saldo/estoque, debita e gera o código.
-- Nível (min_tier) é conferido antes, no servidor, porque é derivado dos pontos históricos.
-- Devolve (redemption_id, null) ou (null, erro) com os nomes de REDEEM_ERRORS.
create function reserve_reward(
  p_user uuid, p_reward uuid, p_ttl interval default interval '24 hours',
  out redemption_id uuid, out error text
) language plpgsql as $$
declare
  r rewards%rowtype;
  balance int;
  new_code char(6);
begin
  select * into r from rewards where id = p_reward and active for update;
  if not found then error := 'reward_unavailable'; return; end if;
  select points into balance from profiles where id = p_user for update;
  if r.stock is not null and r.stock <= 0 then error := 'out_of_stock'; return; end if;
  if balance < r.cost_points then error := 'insufficient_points'; return; end if;

  loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from redemptions where code = new_code and status = 'reserved');
  end loop;

  insert into redemptions (user_id, reward_id, status, code, expires_at)
  values (p_user, p_reward, 'reserved', new_code, now() + p_ttl)
  returning id into redemption_id;
  if r.stock is not null then update rewards set stock = stock - 1 where id = p_reward; end if;
  perform credit_points(p_user, -r.cost_points, 'redemption', redemption_id::text);
end $$;

-- Lojista valida o código. Só um caixa consegue (UPDATE ... WHERE status = 'reserved').
-- Devolve o id do resgate validado, ou null se o código não existe / venceu / já foi usado.
create function validate_redemption(p_code text, p_store uuid default null)
returns uuid language plpgsql as $$
declare
  validated uuid;
begin
  update redemptions
     set status = 'redeemed', redeemed_at = now(), validated_by_store_id = p_store
   where code = p_code and status = 'reserved' and expires_at >= now()
  returning id into validated;
  return validated;
end $$;

-- Vence cupons de resgate e devolve pontos e estoque. Rodar por cron (pg_cron) ou nas leituras.
create function expire_redemptions()
returns int language plpgsql as $$
declare
  row record;
  n int := 0;
begin
  for row in
    update redemptions d
       set status = 'expired', expired_at = now()
      from rewards r
     where d.reward_id = r.id and d.status = 'reserved' and d.expires_at < now()
    returning d.id, d.user_id, d.reward_id, r.cost_points, r.stock
  loop
    perform credit_points(row.user_id, row.cost_points, 'redemption_refund', row.id::text);
    if row.stock is not null then update rewards set stock = stock + 1 where id = row.reward_id; end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- As funções mexem em saldo: ninguém além do servidor pode chamá-las.
revoke all on function credit_points(uuid, int, text, text) from public;
revoke all on function record_scan(uuid, uuid, date) from public;
revoke all on function award_mission(uuid, uuid, int) from public;
revoke all on function award_receipt(uuid, uuid, uuid, text, int, text) from public;
revoke all on function reserve_reward(uuid, uuid, interval) from public;
revoke all on function validate_redemption(text, uuid) from public;
revoke all on function expire_redemptions() from public;
