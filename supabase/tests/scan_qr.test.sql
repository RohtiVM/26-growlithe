-- Testes de banco da spec 004 (check-in e missão por QR). Roda numa transação
-- desfeita no fim, para não mexer nas contagens dos outros testes.
\set ON_ERROR_STOP on
begin;

-- Pessoas e pontos próprios deste teste.
insert into auth.users (id, email) values
  ('e4000000-0000-4000-8000-00000000000a', 'admin-scan@test.dev'),
  ('e4000000-0000-4000-8000-00000000000b', 'visitante-scan@test.dev');
select private.grant_staff('admin-scan@test.dev', 'admin', null);
update public.profiles set name = 'Marina Souza' where id = 'e4000000-0000-4000-8000-00000000000b';

insert into public.checkpoints (id, label, is_entrance) values
  ('e4c00000-0000-4000-8000-0000000000a1', 'Teste A', false),
  ('e4c00000-0000-4000-8000-0000000000b1', 'Teste B', false),
  ('e4c00000-0000-4000-8000-0000000000c1', 'Teste C', false),
  ('e4c00000-0000-4000-8000-0000000000d1', 'Teste D', false),
  ('e4c00000-0000-4000-8000-0000000000e1', 'Teste E', false),
  ('e4c00000-0000-4000-8000-0000000000f1', 'Teste F', false);

insert into public.missions (title, requirement, points_reward, starts_at, ends_at, launch) values
  ('Caça A-B', '{"kind":"qr_scan","checkpointIds":["e4c00000-0000-4000-8000-0000000000a1","e4c00000-0000-4000-8000-0000000000b1"],"ordered":true}',
    300, now() - interval '1 hour', now() + interval '1 day', '{"type":"scheduled"}'),
  ('Caça C-D', '{"kind":"qr_scan","checkpointIds":["e4c00000-0000-4000-8000-0000000000c1","e4c00000-0000-4000-8000-0000000000d1"],"ordered":true}',
    300, now() - interval '1 hour', now() + interval '1 day', '{"type":"scheduled"}'),
  ('Relâmpago E', '{"kind":"qr_scan","checkpointIds":["e4c00000-0000-4000-8000-0000000000e1"],"ordered":false}',
    50, now() - interval '1 hour', now() + interval '2 hours',
    '{"type":"flash","pushTitle":"Corre!","pushBody":"Pontos em dobro agora","pointsMultiplier":2}'),
  ('Encerrada F', '{"kind":"qr_scan","checkpointIds":["e4c00000-0000-4000-8000-0000000000f1"],"ordered":false}',
    999, now() - interval '2 days', now() - interval '1 day', '{"type":"scheduled"}');

-- Tokens inválidos montados pelo dono do banco (o visitante não acessa a assinatura).
create temp table t (k text primary key, v text);
grant all on t to authenticated;
insert into t values
  ('vencido', rtrim(translate(replace(encode(convert_to(jsonb_build_object(
     'v', 1, 'cp', 'c1000000-0000-4000-8000-000000000002', 'exp', 1000,
     'sig', private.qr_signature('c1000000-0000-4000-8000-000000000002', '1000'))::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=')),
  ('forjado', rtrim(translate(replace(encode(convert_to(jsonb_build_object(
     'v', 1, 'cp', 'c1000000-0000-4000-8000-000000000002', 'exp', 9999999999,
     'sig', repeat('0', 64))::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '='));

-- Admin assina os QR pelo painel.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e4000000-0000-4000-8000-00000000000a', true);
insert into t
  select 'entrada', public.sign_checkpoint_qr('c1000000-0000-4000-8000-000000000001')
  union all select 'praca', public.sign_checkpoint_qr('c1000000-0000-4000-8000-000000000002')
  union all select 'a', public.sign_checkpoint_qr('e4c00000-0000-4000-8000-0000000000a1')
  union all select 'b', public.sign_checkpoint_qr('e4c00000-0000-4000-8000-0000000000b1')
  union all select 'd', public.sign_checkpoint_qr('e4c00000-0000-4000-8000-0000000000d1')
  union all select 'e', public.sign_checkpoint_qr('e4c00000-0000-4000-8000-0000000000e1')
  union all select 'f', public.sign_checkpoint_qr('e4c00000-0000-4000-8000-0000000000f1');

-- Trocar o checkpoint mantendo a assinatura do token da entrada.
insert into t select 'trocado', rtrim(translate(replace(encode(convert_to(jsonb_set(
    convert_from(decode(translate(v, '-_', '+/') || repeat('=', (4 - length(v) % 4) % 4), 'base64'), 'UTF8')::jsonb,
    '{cp}', '"c1000000-0000-4000-8000-000000000003"')::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=')
  from t where k = 'entrada';

-- Visitante escaneia.
select set_config('request.jwt.claim.sub', 'e4000000-0000-4000-8000-00000000000b', true);

do $$
declare
  r jsonb;
  tok text;
begin
  -- Critério 1: check-in na entrada vale 20.
  select v into tok from t where k = 'entrada';
  r := public.scan_checkpoint(tok);
  assert r ->> 'result' = 'ok', 'entrada deve dar ok: ' || r::text;
  assert (r ->> 'is_checkin')::boolean, 'entrada é check-in';
  assert (r ->> 'points_earned')::int = 20, 'check-in vale 20: ' || r::text;

  -- Critério 2: mesmo QR no mesmo dia não pontua.
  r := public.scan_checkpoint(tok);
  assert r ->> 'result' = 'already_scanned_today', 'repetido no dia: ' || r::text;

  -- Scan comum vale 10.
  select v into tok from t where k = 'praca';
  r := public.scan_checkpoint(tok);
  assert r ->> 'result' = 'ok' and (r ->> 'points_earned')::int = 10, 'scan comum vale 10: ' || r::text;
  assert not (r ->> 'is_checkin')::boolean, 'praça não é check-in';

  -- Critério 3: assinatura forjada e checkpoint trocado.
  select v into tok from t where k = 'forjado';
  assert public.scan_checkpoint(tok) ->> 'result' = 'invalid_qr', 'assinatura forjada';
  select v into tok from t where k = 'trocado';
  assert public.scan_checkpoint(tok) ->> 'result' = 'invalid_qr', 'checkpoint trocado';
  assert public.scan_checkpoint('lixo-que-nao-e-token-nenhum') ->> 'result' = 'invalid_qr', 'lixo';

  -- Critério 4: vencido.
  select v into tok from t where k = 'vencido';
  assert public.scan_checkpoint(tok) ->> 'result' = 'expired_qr', 'vencido';

  -- Critério 8: caça ao tesouro em ordem.
  select v into tok from t where k = 'd';
  r := public.scan_checkpoint(tok);
  assert r -> 'missions' -> 0 ->> 'status' = 'out_of_order', 'D antes de C fica fora de ordem: ' || r::text;
  assert (r ->> 'points_earned')::int = 10, 'fora de ordem ganha só a base';

  select v into tok from t where k = 'a';
  r := public.scan_checkpoint(tok);
  assert r -> 'missions' -> 0 ->> 'status' = 'progress' and (r -> 'missions' -> 0 ->> 'current')::int = 1, 'A avança: ' || r::text;
  select v into tok from t where k = 'b';
  r := public.scan_checkpoint(tok);
  assert r -> 'missions' -> 0 ->> 'status' = 'completed', 'B completa a caça: ' || r::text;
  assert (r ->> 'points_earned')::int = 310, 'base + 300 da missão: ' || r::text;

  -- Critério 7 + D12: relâmpago ×2.
  select v into tok from t where k = 'e';
  r := public.scan_checkpoint(tok);
  assert (r -> 'missions' -> 0 ->> 'points')::int = 100, 'relâmpago 50 × 2: ' || r::text;
  assert (r ->> 'points_earned')::int = 110, 'base + 100';

  -- Critério 12: missão encerrada não avança.
  select v into tok from t where k = 'f';
  r := public.scan_checkpoint(tok);
  assert jsonb_array_length(r -> 'missions') = 0, 'missão encerrada não conta: ' || r::text;

  -- Saldo é a soma do extrato: 20 + 10 + 10 + 10 + 310 + 110 + 10 = 480.
  assert (select points from public.profiles) = 480, 'saldo 480';
  assert (select sum(delta) from public.point_ledger) = 480, 'extrato soma 480';
  assert (r ->> 'lifetime_after')::int = 480, 'pontos históricos 480';

  -- O visitante não grava nem assina nada direto.
  begin
    insert into public.scans (user_id, checkpoint_id, scanned_on, points)
    values ('e4000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-000000000004', current_date, 999);
    raise exception 'FALHOU: visitante gravou scan direto';
  exception when insufficient_privilege then null; end;

  begin
    perform public.sign_checkpoint_qr('c1000000-0000-4000-8000-000000000001');
    raise exception 'FALHOU: visitante assinou QR';
  exception when insufficient_privilege then null; end;

  begin
    perform private.verify_qr_token('x');
    raise exception 'FALHOU: visitante chamou a verificação privada';
  exception when insufficient_privilege then null; end;
end $$;

-- Sem login não escaneia.
reset role;
set local role anon;
do $$ begin
  begin
    perform public.scan_checkpoint('qualquer');
    raise exception 'FALHOU: anon escaneou';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
\echo 'OK: testes de banco da spec 004 passaram'
