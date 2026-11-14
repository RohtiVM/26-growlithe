-- Testes de banco da spec 003 (T6): missões. Cada bloco falha com exceção se a regra quebrar.
-- Roda numa transação desfeita no fim: não deixa usuários nem missões para os outros testes.
-- Dentro da transação `now()` é fixo, então "encerrar agora" é determinístico.
\set ON_ERROR_STOP on
begin;

-- Pessoas próprias deste arquivo: admin, lojista da Moda Cerrado, visitante.
insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-00000000000a', 'admin@missoes.test'),
  ('f0000000-0000-4000-8000-00000000000b', 'gerente@missoes.test'),
  ('f0000000-0000-4000-8000-00000000000c', 'visitante@missoes.test');
select private.grant_staff('admin@missoes.test', 'admin', null);
select private.grant_staff('gerente@missoes.test', 'lojista', 'a1000000-0000-4000-8000-000000000001');

-- Restrições de integridade --------------------------------------------------
do $$ begin
  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Fim antes do início', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now() - interval '1 day', 'f0000000-0000-4000-8000-00000000000a');
    raise exception 'FALHOU: missão que termina antes de começar foi aceita (critério 9)';
  exception when check_violation then null; end;

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Mesmo instante', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now(), 'f0000000-0000-4000-8000-00000000000a');
    raise exception 'FALHOU: missão com início igual ao fim foi aceita';
  exception when check_violation then null; end;

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Tipo estranho', '{"kind": "dance"}', 100,
            now(), now() + interval '1 day', 'f0000000-0000-4000-8000-00000000000a');
    raise exception 'FALHOU: requisito com kind desconhecido foi aceito';
  exception when check_violation then null; end;

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Pontos zerados', '{"kind": "visit_streak", "days": 3}', 0,
            now(), now() + interval '1 day', 'f0000000-0000-4000-8000-00000000000a');
    raise exception 'FALHOU: missão sem pontos foi aceita';
  exception when check_violation then null; end;

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, launch, created_by)
    values ('Relâmpago sem push', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now() + interval '1 hour', '{"type": "flash", "pushBody": "Corra!", "pointsMultiplier": 2}',
            'f0000000-0000-4000-8000-00000000000a');
    raise exception 'FALHOU: Missão Relâmpago sem título do push foi aceita (critério 11)';
  exception when check_violation then null; end;

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, launch, created_by)
    values ('Multiplicador alto', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now() + interval '1 hour',
            '{"type": "flash", "pushTitle": "Dobro!", "pushBody": "Corra!", "pointsMultiplier": 6}',
            'f0000000-0000-4000-8000-00000000000a');
    raise exception 'FALHOU: multiplicador fora de 1 a 5 foi aceito (RF09)';
  exception when check_violation then null; end;
end $$;

-- RLS como admin: cria (critério 10) -------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000a';
do $$ begin
  insert into public.missions (id, title, requirement, points_reward, starts_at, ends_at, created_by) values
    ('f1000000-0000-4000-8000-000000000001', 'Caça ao tesouro',
      '{"kind": "qr_scan", "checkpointIds": ["c1000000-0000-4000-8000-000000000001", "c1000000-0000-4000-8000-000000000002"], "ordered": true}',
      150, now() - interval '1 day', now() + interval '6 days', 'f0000000-0000-4000-8000-00000000000a'),
    ('f1000000-0000-4000-8000-000000000002', 'Show de Natal',
      '{"kind": "event_checkin", "checkpointId": "c1000000-0000-4000-8000-000000000002", "eventName": "Show de Natal"}',
      200, now() + interval '10 days', now() + interval '11 days', 'f0000000-0000-4000-8000-00000000000a');
  insert into public.missions (id, title, requirement, points_reward, starts_at, ends_at, launch, created_by) values
    ('f1000000-0000-4000-8000-000000000003', 'Relâmpago na praça', '{"kind": "purchase_category", "category": "alimentacao"}',
      100, now() - interval '1 hour', now() + interval '1 hour',
      '{"type": "flash", "pushTitle": "Pontos em dobro!", "pushBody": "Corra até a praça!", "pointsMultiplier": 2}',
      'f0000000-0000-4000-8000-00000000000a');
  assert (select count(*) from public.missions where id::text like 'f1000000-%') = 3, 'admin cria missões';

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Em nome de outro', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now() + interval '1 day', 'f0000000-0000-4000-8000-00000000000c');
    raise exception 'FALHOU: admin criou missão em nome de outra pessoa';
  exception when insufficient_privilege then null; end;
end $$;

-- RLS como lojista: lê, mas não cria nem encerra (critério 3) -------------------
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000b';
do $$
declare
  v_rows integer;
begin
  assert (select count(*) from public.missions where id::text like 'f1000000-%') = 3, 'lojista lê missões';

  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Missão do lojista', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now() + interval '1 day', 'f0000000-0000-4000-8000-00000000000b');
    raise exception 'FALHOU: lojista criou missão (critério 3)';
  exception when insufficient_privilege then null; end;

  update public.missions set ends_at = now() where id = 'f1000000-0000-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'lojista não encerra missão';
end $$;

-- RLS como visitante: lê, mas não cria -------------------------------------------
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000c';
do $$ begin
  assert (select count(*) from public.missions where id::text like 'f1000000-%') = 3, 'visitante lê missões';
  begin
    insert into public.missions (title, requirement, points_reward, starts_at, ends_at, created_by)
    values ('Missão do visitante', '{"kind": "visit_streak", "days": 3}', 100,
            now(), now() + interval '1 day', 'f0000000-0000-4000-8000-00000000000c');
    raise exception 'FALHOU: visitante criou missão';
  exception when insufficient_privilege then null; end;
end $$;

-- RLS como admin: encerra (critério 12) ----------------------------------------
set request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000a';
do $$ begin
  -- O valor enviado é ignorado: o fim vira o `now()` do banco.
  update public.missions set ends_at = now() + interval '1 hour' where id = 'f1000000-0000-4000-8000-000000000001';
  assert (select ends_at from public.missions where id = 'f1000000-0000-4000-8000-000000000001') = now(),
    'encerrar põe o fim em agora';
  assert (select ends_at <= now() from public.missions where id = 'f1000000-0000-4000-8000-000000000001'),
    'missão encerrada saiu do período: visitante não pontua mais';

  begin
    update public.missions set ends_at = now() where id = 'f1000000-0000-4000-8000-000000000001';
    raise exception 'FALHOU: missão já encerrada foi encerrada de novo';
  exception when check_violation then null; end;

  begin
    update public.missions set ends_at = now() where id = 'f1000000-0000-4000-8000-000000000002';
    raise exception 'FALHOU: missão futura foi encerrada';
  exception when check_violation then null; end;

  begin
    update public.missions set title = 'Outro título' where id = 'f1000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU: admin editou o título (editar está fora do escopo)';
  exception when insufficient_privilege then null; end;
end $$;

-- Sem login (anon) -----------------------------------------------------------
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  begin
    perform 1 from public.missions;
    raise exception 'FALHOU: anon leu missões';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
\echo 'OK: testes de banco de missões (T6) passaram'
