-- Testes de banco da spec 003, T7/T8: conferir e validar cupom de resgate
-- (critérios 15–19, RNF03, RNF05, RNF12, D6). Roda depois de painel_rls.test.sql,
-- por isso usa ids (f0…) e códigos (7000xx) próprios.
\set ON_ERROR_STOP on

-- Pessoas: admin, lojista da Moda Cerrado, lojista do Burger, visitante.
insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-00000000000a', 'admin2@shopping.test'),
  ('f0000000-0000-4000-8000-00000000000b', 'caixa@moda.test'),
  ('f0000000-0000-4000-8000-00000000000d', 'caixa@burger.test'),
  ('f0000000-0000-4000-8000-00000000000c', 'marina.souza@visitante.test');

select private.grant_staff('admin2@shopping.test', 'admin', null);
select private.grant_staff('caixa@moda.test', 'lojista', 'a1000000-0000-4000-8000-000000000001');
select private.grant_staff('caixa@burger.test', 'lojista', 'a1000000-0000-4000-8000-000000000002');
update public.profiles set name = 'Marina Souza Lima', lifetime_points = 650
 where id = 'f0000000-0000-4000-8000-00000000000c';

-- Recompensas do seed: b…01 estacionamento (sem loja), b…02 Moda Cerrado, b…03 Burger.
insert into public.redemptions (id, user_id, reward_id, status, code, expires_at, created_at) values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'reserved', '700001', now() + interval '1 hour', now()),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000003', 'reserved', '700002', now() + interval '1 hour', now()),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000001', 'reserved', '700003', now() + interval '1 hour', now()),
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'reserved', '700004', now() - interval '1 minute', now() - interval '1 day'),
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'reserved', '700006', now() + interval '1 hour', now());
-- Resgates antigos que reaproveitam códigos (o índice único só cobre os reservados).
insert into public.redemptions (id, user_id, reward_id, status, code, redeemed_at, validated_by, validated_by_store_id, created_at) values
  ('f1000000-0000-4000-8000-000000000016', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'redeemed', '700006',
    now() - interval '9 days', 'f0000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000001', now() - interval '10 days');
insert into public.redemptions (id, user_id, reward_id, status, code, expired_at, created_at) values
  ('f1000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'expired', '700007',
    now() - interval '1 day', now() - interval '2 days');

-- Lojista da Moda Cerrado ----------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000b';
do $$
declare
  v jsonb;
begin
  -- Critério 15 / RNF05: benefício, primeiro nome e pontos históricos; nada além.
  v := public.preview_redemption('700001');
  assert v ->> 'result' = 'ok', format('critério 15: conferir deve dar ok, veio %s', v);
  assert v ->> 'first_name' = 'Marina', 'critério 15: só o primeiro nome';
  assert (v ->> 'lifetime_points')::int = 650, 'critério 15: pontos históricos para o nível';
  assert v -> 'benefit' ->> 'kind' = 'discount_percent', 'critério 15: benefício';
  assert v ->> 'reward_title' = '15% na Moda Cerrado', 'critério 15: título da recompensa';
  assert (select array_agg(k order by k) from jsonb_object_keys(v) k)
       = array['benefit', 'expires_at', 'first_name', 'lifetime_points', 'result', 'reward_title', 'store_id'],
    format('RNF05: a conferência não devolve chaves além do necessário: %s', v);
  assert v::text !~ '(Souza|visitante\.test|f0000000-0000-4000-8000-00000000000c)', 'RNF05: sem sobrenome, e-mail ou id do visitante';
  assert (select status from public.redemptions where code = '700001') = 'reserved', 'conferir não altera nada';

  -- Critério 16: confirma, e a segunda validação vê "já usado" com data e hora.
  v := public.validate_redemption('700001');
  assert v ->> 'result' = 'ok', format('critério 16: validar deve dar ok, veio %s', v);
  assert v ? 'redeemed_at', 'validar devolve a hora';
end $$;

-- Nova transação: a confirmação acima já está gravada.
do $$
declare
  v jsonb;
begin
  v := public.validate_redemption('700001');
  assert v ->> 'result' = 'already_used', format('critério 16/19: segunda validação deve dar already_used, veio %s', v);
  assert (v ->> 'redeemed_at')::timestamptz is not null, 'critério 16: já usado vem com data e hora';
  v := public.preview_redemption('700001');
  assert v ->> 'result' = 'already_used', 'critério 16: conferir de novo também mostra já usado';
  assert v - 'result' - 'redeemed_at' = '{}'::jsonb, 'já usado não traz dado do visitante';

  -- Critério 17: outra loja — recusado nas duas funções e nada muda.
  assert public.preview_redemption('700002') ->> 'result' = 'other_store', 'critério 17: conferir cupom de resgate de outra loja';
  assert public.validate_redemption('700002') ->> 'result' = 'other_store', 'critério 17: validar cupom de resgate de outra loja';

  -- Critério 18: estacionamento grátis — lojista não valida.
  assert public.preview_redemption('700003') ->> 'result' = 'admin_only', 'critério 18: lojista conferindo estacionamento';
  assert public.validate_redemption('700003') ->> 'result' = 'admin_only', 'critério 18: lojista validando estacionamento';

  -- Vencido (reservado com prazo passado ou já marcado expired), inexistente, malformado.
  assert public.preview_redemption('700004') ->> 'result' = 'expired', 'reservado vencido';
  assert public.validate_redemption('700004') ->> 'result' = 'expired', 'validar reservado vencido';
  assert public.validate_redemption('700007') ->> 'result' = 'expired', 'resgate expirado';
  assert public.preview_redemption('700005') ->> 'result' = 'not_found', 'código inexistente';
  assert public.validate_redemption('700005') ->> 'result' = 'not_found', 'validar código inexistente';
  assert public.validate_redemption('12ab') ->> 'result' = 'not_found', 'código malformado';
  assert public.validate_redemption(null) ->> 'result' = 'not_found', 'código nulo';

  -- Código reaproveitado: vale o reservado, não o resgate antigo.
  assert public.preview_redemption('700006') ->> 'result' = 'ok', 'código reaproveitado: vale o reservado';
  assert public.validate_redemption('700006') ->> 'result' = 'ok', 'código reaproveitado: valida o reservado';

  -- Escrita direta continua barrada: só a função muda resgates.
  begin
    update public.redemptions set status = 'redeemed' where code = '700002';
    raise exception 'FALHOU: lojista alterou resgate sem a função';
  exception when insufficient_privilege then null; end;
end $$;

-- Lojista do Burger: o cupom de resgate da Moda Cerrado é "de outra loja", mesmo já usado
-- (não revela quando foi usado).
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000d';
do $$ begin
  assert public.preview_redemption('700001') ->> 'result' = 'other_store', 'D6: loja é conferida antes do estado';
  assert public.preview_redemption('700002') ->> 'result' = 'ok', 'lojista do Burger confere o próprio cupom de resgate';
end $$;

-- Admin ----------------------------------------------------------------------
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000a';
do $$
declare
  v jsonb;
begin
  -- Critério 18: admin aceita o estacionamento grátis.
  assert public.preview_redemption('700003') ->> 'result' = 'ok', 'critério 18: admin confere estacionamento';
  v := public.validate_redemption('700003');
  assert v ->> 'result' = 'ok', format('critério 18: admin valida estacionamento, veio %s', v);
  -- Código reaproveitado já usado: o "já usado" é o do resgate mais recente.
  v := public.preview_redemption('700006');
  assert v ->> 'result' = 'already_used', 'código reaproveitado já usado';
  assert (v ->> 'redeemed_at')::timestamptz > now() - interval '1 hour', 'já usado mostra o resgate mais recente';
end $$;

-- Visitante (sem papel) e anon -----------------------------------------------
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000c';
do $$ begin
  begin
    perform public.preview_redemption('700002');
    raise exception 'FALHOU: visitante conferiu cupom de resgate';
  exception when insufficient_privilege then null; end;
  begin
    perform public.validate_redemption('700002');
    raise exception 'FALHOU: visitante validou o próprio cupom de resgate';
  exception when insufficient_privilege then null; end;
end $$;

reset request.jwt.claim.sub;
set role anon;
do $$ begin
  begin
    perform public.validate_redemption('700002');
    raise exception 'FALHOU: anon validou cupom de resgate';
  exception when insufficient_privilege then null; end;
end $$;

-- Auditoria (RNF12) e estado final -------------------------------------------
reset role;
do $$ begin
  assert (select validated_by from public.redemptions where id = 'f1000000-0000-4000-8000-000000000001')
       = 'f0000000-0000-4000-8000-00000000000b', 'RNF12: quem validou fica gravado';
  assert (select validated_by_store_id from public.redemptions where id = 'f1000000-0000-4000-8000-000000000001')
       = 'a1000000-0000-4000-8000-000000000001', 'RNF12: loja de quem validou';
  assert (select redeemed_at from public.redemptions where id = 'f1000000-0000-4000-8000-000000000001') is not null, 'RNF12: quando';
  assert (select validated_by_store_id from public.redemptions where id = 'f1000000-0000-4000-8000-000000000003') is null,
    'admin valida sem loja';
  assert (select validated_by from public.redemptions where id = 'f1000000-0000-4000-8000-000000000003')
       = 'f0000000-0000-4000-8000-00000000000a', 'admin fica registrado';
  assert (select status from public.redemptions where id = 'f1000000-0000-4000-8000-000000000002') = 'reserved',
    'critério 17: cupom de resgate de outra loja continua reservado';
  assert (select status from public.redemptions where id = 'f1000000-0000-4000-8000-000000000016') = 'redeemed'
     and (select redeemed_at from public.redemptions where id = 'f1000000-0000-4000-8000-000000000016') < now() - interval '8 days',
    'resgate antigo com o mesmo código não é tocado';
end $$;

-- Critério 19 / RNF03: duas confirmações "ao mesmo tempo". Abre duas conexões
-- com dblink quando a extensão existe; sem ela, o teste sequencial acima cobre
-- a regra (o UPDATE só casa com status = 'reserved').
select exists (select 1 from pg_available_extensions where name = 'dblink') as has_dblink \gset
\if :has_dblink
create extension if not exists dblink;
insert into public.redemptions (id, user_id, reward_id, status, code, expires_at) values
  ('f1000000-0000-4000-8000-000000000019', 'f0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'reserved', '700019', now() + interval '1 hour');
do $$
declare
  v_conn text := format('host=%s port=%s dbname=%s user=postgres',
    coalesce(current_setting('unix_socket_directories', true), ''), current_setting('port'), current_database());
  r1 text;
  r2 text;
begin
  perform dblink_connect('c1', v_conn);
  perform dblink_connect('c2', v_conn);
  -- c1 valida e segura a transação aberta; c2 chega em seguida e fica no lock.
  perform dblink_exec('c1', 'begin; set local role authenticated; set local request.jwt.claim.sub = ''f0000000-0000-4000-8000-00000000000b''');
  select x into r1 from dblink('c1', 'select public.validate_redemption(''700019'')::text') as t(x text);
  perform dblink_exec('c2', 'set role authenticated');
  perform dblink_exec('c2', 'set request.jwt.claim.sub = ''f0000000-0000-4000-8000-00000000000b''');
  perform dblink_send_query('c2', 'select public.validate_redemption(''700019'')::text');
  perform pg_sleep(0.3);
  perform dblink_exec('c1', 'commit');
  select x into r2 from dblink_get_result('c2') as t(x text);
  perform dblink_disconnect('c1');
  perform dblink_disconnect('c2');
  assert r1::jsonb ->> 'result' = 'ok', format('critério 19: a primeira confirma, veio %s', r1);
  assert r2::jsonb ->> 'result' = 'already_used', format('critério 19: a segunda vê já usado, veio %s', r2);
  assert (select count(*) from public.redemptions where code = '700019' and status = 'redeemed') = 1,
    'RNF03: só uma confirmação gravada';
end $$;
\else
\echo 'dblink indisponível: teste de concorrência real pulado (regra coberta pelo teste sequencial)'
\endif

\echo 'OK: testes de validar cupom de resgate (spec 003, T7/T8) passaram'
