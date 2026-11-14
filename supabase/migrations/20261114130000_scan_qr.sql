-- Spec 004 · T1: check-in e missão por QR Code.
-- O QR é assinado e conferido DENTRO do banco (D16): o segredo nasce aqui e
-- nunca sai. Assim ninguém ganha pontos chamando a API com um id de checkpoint.
--
-- Token (formato da docs/08): base64url( {"v":1,"cp":"<uuid>","exp":<unix>,"sig":"<hex>"} )
-- sig = HMAC-SHA256( '1.<cp>.<exp>', segredo ) em hexadecimal.

-- ------------------------------------------------------------------
-- Segredo do QR (só o dono do banco lê)
-- ------------------------------------------------------------------
create table private.app_secrets (
  name text primary key,
  value text not null check (char_length(value) >= 32)
);
revoke all on private.app_secrets from public, anon, authenticated;

insert into private.app_secrets (name, value)
values ('qr_signing', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

-- ------------------------------------------------------------------
-- Check-in (D3): checkpoint de entrada
-- ------------------------------------------------------------------
alter table public.checkpoints add column is_entrance boolean not null default false;

-- ------------------------------------------------------------------
-- Scans, extrato de pontos e progresso das missões
-- ------------------------------------------------------------------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkpoint_id uuid not null references public.checkpoints (id),
  -- D4: o "dia" é o de Palmas.
  scanned_on date not null,
  scanned_at timestamptz not null default now(),
  points integer not null check (points >= 0),
  is_checkin boolean not null default false,
  -- Critério 2 e 10: um ponto por visitante por dia, mesmo com requisições simultâneas.
  constraint scans_once_per_day unique (user_id, checkpoint_id, scanned_on)
);
create index scans_checkpoint_id_idx on public.scans (checkpoint_id);
create index scans_scanned_on_idx on public.scans (scanned_on);

-- Extrato append-only: o saldo é sempre consequência destes lançamentos.
create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('scan', 'checkin', 'mission')),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index point_ledger_user_id_idx on public.point_ledger (user_id);

create table public.mission_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  current integer not null default 0 check (current >= 0),
  target integer not null check (target > 0),
  completed_at timestamptz,
  points_awarded integer check (points_awarded > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id),
  constraint mission_progress_completed check ((completed_at is null) = (points_awarded is null))
);
create index mission_progress_mission_id_idx on public.mission_progress (mission_id);

alter table public.scans enable row level security;
alter table public.point_ledger enable row level security;
alter table public.mission_progress enable row level security;

-- Tudo muda só pela função scan_checkpoint; o cliente apenas lê o que é seu.
revoke all on public.scans, public.point_ledger, public.mission_progress from anon, authenticated;
grant select on public.scans, public.point_ledger, public.mission_progress to authenticated;

create policy scans_read on public.scans for select to authenticated
  using (user_id = (select auth.uid()) or (select private.staff_role()) = 'admin');
create policy point_ledger_read on public.point_ledger for select to authenticated
  using (user_id = (select auth.uid()) or (select private.staff_role()) = 'admin');
create policy mission_progress_read on public.mission_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select private.staff_role()) = 'admin');

-- ------------------------------------------------------------------
-- Assinar e conferir o token
-- ------------------------------------------------------------------
create function private.qr_signature(p_cp text, p_exp text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.hmac(
      convert_to('1.' || p_cp || '.' || p_exp, 'UTF8'),
      convert_to((select value from private.app_secrets where name = 'qr_signing'), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

-- Devolve {"result":"ok","cp":uuid} | {"result":"invalid_qr"} | {"result":"expired_qr"}.
-- Nunca lança: qualquer lixo vira invalid_qr.
create function private.verify_qr_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b64 text;
  v_json jsonb;
  v_cp text;
  v_exp text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{20,600}$' then
    return jsonb_build_object('result', 'invalid_qr');
  end if;

  v_b64 := translate(p_token, '-_', '+/');
  v_b64 := v_b64 || repeat('=', (4 - length(v_b64) % 4) % 4);
  begin
    v_json := convert_from(decode(v_b64, 'base64'), 'UTF8')::jsonb;
  exception when others then
    return jsonb_build_object('result', 'invalid_qr');
  end;

  if jsonb_typeof(v_json) <> 'object' or v_json ->> 'v' is distinct from '1' then
    return jsonb_build_object('result', 'invalid_qr');
  end if;
  v_cp := v_json ->> 'cp';
  v_exp := v_json ->> 'exp';
  if v_cp is null or v_cp !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_exp is null or v_exp !~ '^[0-9]{1,12}$'
     or v_json ->> 'sig' is distinct from private.qr_signature(v_cp, v_exp) then
    return jsonb_build_object('result', 'invalid_qr');
  end if;

  if v_exp::bigint <= extract(epoch from now())::bigint then
    return jsonb_build_object('result', 'expired_qr');
  end if;
  return jsonb_build_object('result', 'ok', 'cp', v_cp);
end;
$$;

-- Painel (UC7): só o admin gera o token de um checkpoint. QR impresso vale 1 ano.
create function public.sign_checkpoint_qr(p_checkpoint uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cp text;
  v_exp text := (extract(epoch from now() + interval '365 days'))::bigint::text;
begin
  if private.staff_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select id::text into v_cp from public.checkpoints where id = p_checkpoint;
  if v_cp is null then
    return null;
  end if;
  return rtrim(translate(replace(encode(convert_to(
    jsonb_build_object('v', 1, 'cp', v_cp, 'exp', v_exp::bigint, 'sig', private.qr_signature(v_cp, v_exp))::text,
    'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
end;
$$;

-- ------------------------------------------------------------------
-- Escanear (critérios 1–12): uma transação; devolve jsonb com `result`:
--   ok | not_authenticated | invalid_qr | expired_qr | already_scanned_today
-- ------------------------------------------------------------------
create function public.scan_checkpoint(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Araguaina')::date;
  v_check jsonb;
  v_cp uuid;
  v_label text;
  v_entrance boolean;
  v_active boolean;
  v_life_before integer;
  v_life_after integer;
  v_balance integer;
  v_checkin boolean;
  v_base integer;
  v_scan_id uuid;
  v_earned integer;
  v_missions jsonb := '[]'::jsonb;
  m record;
  v_list uuid[];
  v_target integer;
  v_cur integer;
  v_award integer;
begin
  if v_uid is null then
    return jsonb_build_object('result', 'not_authenticated');
  end if;

  v_check := private.verify_qr_token(p_token);
  if v_check ->> 'result' <> 'ok' then
    return v_check;
  end if;
  v_cp := (v_check ->> 'cp')::uuid;

  select label, is_entrance, active into v_label, v_entrance, v_active
    from public.checkpoints where id = v_cp;
  if not found or not v_active then
    return jsonb_build_object('result', 'invalid_qr');
  end if;

  -- Trava o perfil: scans simultâneos do mesmo visitante entram em fila.
  select lifetime_points into v_life_before from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('result', 'not_authenticated');
  end if;

  -- D9: 20 pts no primeiro check-in de entrada do dia; 10 nos demais scans.
  v_checkin := v_entrance and not exists (
    select 1 from public.scans where user_id = v_uid and scanned_on = v_today and is_checkin
  );
  v_base := case when v_checkin then 20 else 10 end;

  insert into public.scans (user_id, checkpoint_id, scanned_on, points, is_checkin)
  values (v_uid, v_cp, v_today, v_base, v_checkin)
  on conflict (user_id, checkpoint_id, scanned_on) do nothing
  returning id into v_scan_id;

  if v_scan_id is null then
    return jsonb_build_object('result', 'already_scanned_today', 'checkpoint', v_label);
  end if;

  insert into public.point_ledger (user_id, delta, reason, ref_id)
  values (v_uid, v_base, case when v_checkin then 'checkin' else 'scan' end, v_scan_id);
  v_earned := v_base;

  -- D6: missões ativas que usam este checkpoint. D11: cada uma completa uma vez.
  for m in
    select mi.* from public.missions mi
     where mi.starts_at <= now() and mi.ends_at > now()
       and (
         (mi.requirement ->> 'kind' = 'qr_scan' and mi.requirement -> 'checkpointIds' ? v_cp::text)
         or (mi.requirement ->> 'kind' = 'event_checkin' and mi.requirement ->> 'checkpointId' = v_cp::text)
       )
       and not exists (
         select 1 from public.mission_progress mp
          where mp.user_id = v_uid and mp.mission_id = mi.id and mp.completed_at is not null
       )
     order by mi.created_at
  loop
    if m.requirement ->> 'kind' = 'event_checkin' then
      v_target := 1;
      v_cur := 1;
    else
      v_list := array(
        select x::uuid from jsonb_array_elements_text(m.requirement -> 'checkpointIds') with ordinality t(x, i) order by i
      );
      v_target := cardinality(v_list);
      if coalesce((m.requirement ->> 'ordered')::boolean, false) then
        select coalesce(max(mp.current), 0) into v_cur
          from public.mission_progress mp where mp.user_id = v_uid and mp.mission_id = m.id;
        if v_list[v_cur + 1] is distinct from v_cp then
          -- D10: fora de ordem ganha os pontos base, mas a missão não avança.
          v_missions := v_missions || jsonb_build_object(
            'title', m.title, 'status', 'out_of_order', 'current', v_cur, 'target', v_target,
            'expected', v_cur + 1, 'scanned', array_position(v_list, v_cp)
          );
          continue;
        end if;
        v_cur := v_cur + 1;
      else
        select count(distinct s.checkpoint_id) into v_cur
          from public.scans s
         where s.user_id = v_uid and s.checkpoint_id = any (v_list) and s.scanned_at >= m.starts_at;
      end if;
    end if;

    if v_cur >= v_target then
      -- D12: relâmpago multiplica os pontos da missão.
      v_award := m.points_reward * case
        when m.launch ->> 'type' = 'flash' then (m.launch ->> 'pointsMultiplier')::integer
        else 1
      end;
      insert into public.mission_progress (user_id, mission_id, current, target, completed_at, points_awarded)
      values (v_uid, m.id, v_target, v_target, now(), v_award)
      on conflict (user_id, mission_id) do update
        set current = excluded.current, target = excluded.target, completed_at = excluded.completed_at,
            points_awarded = excluded.points_awarded, updated_at = now();
      insert into public.point_ledger (user_id, delta, reason, ref_id) values (v_uid, v_award, 'mission', m.id);
      v_earned := v_earned + v_award;
      v_missions := v_missions || jsonb_build_object(
        'title', m.title, 'status', 'completed', 'current', v_target, 'target', v_target, 'points', v_award
      );
    else
      insert into public.mission_progress (user_id, mission_id, current, target)
      values (v_uid, m.id, v_cur, v_target)
      on conflict (user_id, mission_id) do update
        set current = excluded.current, target = excluded.target, updated_at = now();
      v_missions := v_missions || jsonb_build_object(
        'title', m.title, 'status', 'progress', 'current', v_cur, 'target', v_target
      );
    end if;
  end loop;

  update public.profiles
     set points = points + v_earned, lifetime_points = lifetime_points + v_earned
   where id = v_uid
   returning lifetime_points, points into v_life_after, v_balance;

  return jsonb_build_object(
    'result', 'ok',
    'checkpoint', v_label,
    'is_checkin', v_checkin,
    'base_points', v_base,
    'points_earned', v_earned,
    'points_balance', v_balance,
    'lifetime_before', v_life_before,
    'lifetime_after', v_life_after,
    'missions', v_missions
  );
end;
$$;

revoke execute on function private.qr_signature(text, text), private.verify_qr_token(text)
  from public, anon, authenticated;
revoke execute on function public.sign_checkpoint_qr(uuid), public.scan_checkpoint(text) from public, anon;
grant execute on function public.sign_checkpoint_qr(uuid), public.scan_checkpoint(text) to authenticated;
