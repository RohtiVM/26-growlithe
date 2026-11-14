-- Testes de banco do dashboard (spec 003, T9). Transação desfeita no fim.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('e9000000-0000-4000-8000-00000000000a', 'admin-dash@test.dev'),
  ('e9000000-0000-4000-8000-00000000000b', 'lojista-dash@test.dev'),
  ('e9000000-0000-4000-8000-00000000000c', 'v1-dash@test.dev'),
  ('e9000000-0000-4000-8000-00000000000d', 'v2-dash@test.dev');
select private.grant_staff('admin-dash@test.dev', 'admin', null);
select private.grant_staff('lojista-dash@test.dev', 'lojista', 'a1000000-0000-4000-8000-000000000001');

-- Começa do zero só para este teste.
delete from public.scans;
delete from public.landing_leads;
delete from public.landing_visits;

-- 3 check-ins hoje de 2 visitantes (critério 4) e scans em 2 pontos (critério 5).
insert into public.scans (user_id, checkpoint_id, scanned_on, points, is_checkin) values
  ('e9000000-0000-4000-8000-00000000000c', 'c1000000-0000-4000-8000-000000000001', (now() at time zone 'America/Araguaina')::date, 20, true),
  ('e9000000-0000-4000-8000-00000000000d', 'c1000000-0000-4000-8000-000000000001', (now() at time zone 'America/Araguaina')::date, 20, true),
  ('e9000000-0000-4000-8000-00000000000c', 'c1000000-0000-4000-8000-000000000002', (now() at time zone 'America/Araguaina')::date, 10, false),
  ('e9000000-0000-4000-8000-00000000000c', 'c1000000-0000-4000-8000-000000000001', (now() at time zone 'America/Araguaina')::date - 1, 20, true);

-- Leads e visitas por variante (critério 6).
select public.count_landing_visit('A'), public.count_landing_visit('A'), public.count_landing_visit('B'),
       public.count_landing_visit('Z');
select public.join_waitlist('Ana', 'ana-dash@test.dev', 'visitante', null, 'A', null, null, null, true);

set local role authenticated;

-- Admin vê os números.
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-00000000000a', true);
do $$
declare
  m jsonb := public.dashboard_metrics();
begin
  assert (m ->> 'checkinsToday')::int = 2, 'check-ins de hoje: ' || m::text;
  assert (m ->> 'uniqueVisitors7d')::int = 2, 'visitantes únicos 7 dias: ' || m::text;
  assert m -> 'scansByCheckpoint' -> 0 ->> 'label' = 'Entrada principal', 'mais escaneado primeiro: ' || m::text;
  assert (m -> 'scansByCheckpoint' -> 0 ->> 'scans')::int = 3, 'entrada com 3 scans';
  assert (m -> 'leads' -> 'A' ->> 'visits')::int = 2 and (m -> 'leads' -> 'A' ->> 'leads')::int = 1, 'variante A: ' || m::text;
  assert (m -> 'leads' -> 'B' ->> 'visits')::int = 1 and (m -> 'leads' -> 'B' ->> 'leads')::int = 0, 'variante B';
end $$;

-- Lojista e visitante não leem.
select set_config('request.jwt.claim.sub', 'e9000000-0000-4000-8000-00000000000b', true);
do $$ begin
  begin
    perform public.dashboard_metrics();
    raise exception 'FALHOU: lojista leu o dashboard';
  exception when insufficient_privilege then null; end;
end $$;

-- Ninguém lê as visitas direto.
do $$ begin
  begin
    perform 1 from public.landing_visits;
    raise exception 'FALHOU: leu landing_visits direto';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
\echo 'OK: testes de banco do dashboard passaram'
