-- Testes de banco da spec 003 (T2). Cada bloco falha com exceção se a regra quebrar.
\set ON_ERROR_STOP on

-- Pessoas: admin, lojista da Moda Cerrado, visitante.
insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-00000000000a', 'admin@shopping.test'),
  ('d0000000-0000-4000-8000-00000000000b', 'gerente@moda.test'),
  ('d0000000-0000-4000-8000-00000000000c', 'marina@visitante.test');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'trigger deve criar um perfil por usuário';
end $$;

select private.grant_staff('admin@shopping.test', 'admin', null);
select private.grant_staff('GERENTE@moda.test', 'lojista', 'a1000000-0000-4000-8000-000000000001');

-- Cupons de resgate: um da Moda Cerrado, um do Burger, um de estacionamento.
insert into public.redemptions (id, user_id, reward_id, status, code, expires_at) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000002', 'reserved', '111111', now() + interval '1 hour'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000003', 'reserved', '222222', now() + interval '1 hour'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000001', 'reserved', '333333', now() + interval '1 hour');

-- Restrições de integridade --------------------------------------------------
do $$ begin
  begin
    update public.profiles set staff_role = 'lojista', store_id = null where id = 'd0000000-0000-4000-8000-00000000000c';
    raise exception 'FALHOU: lojista sem loja foi aceito';
  exception when check_violation then null; end;

  begin
    update public.redemptions set status = 'redeemed', redeemed_at = now() where code = '111111';
    raise exception 'FALHOU: resgate validado sem validated_by foi aceito (RNF12)';
  exception when check_violation then null; end;

  begin
    insert into public.redemptions (user_id, reward_id, status, code, expires_at)
    values ('d0000000-0000-4000-8000-00000000000c', 'b1000000-0000-4000-8000-000000000001', 'reserved', '111111', now() + interval '1 hour');
    raise exception 'FALHOU: dois cupons de resgate reservados com o mesmo código';
  exception when unique_violation then null; end;

  begin
    insert into public.checkpoints (store_id, label) values (null, 'Entrada principal');
    raise exception 'FALHOU: checkpoint repetido no shopping foi aceito (UC6)';
  exception when unique_violation then null; end;

  begin
    insert into public.rewards (title, cost_points, benefit) values ('Desconto sem loja', 100, '{"kind": "discount_percent", "percent": 10}');
    raise exception 'FALHOU: desconto sem loja foi aceito';
  exception when check_violation then null; end;

  assert (select store_id from public.rewards where id = 'b1000000-0000-4000-8000-000000000001') is null,
    'estacionamento não tem loja dona';
end $$;

-- RLS como lojista -----------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000b';
do $$ begin
  assert (select count(*) from public.redemptions) = 1, 'lojista vê só cupons de resgate da própria loja (RNF02)';
  assert (select code from public.redemptions) = '111111', 'lojista vê o cupom de resgate da Moda Cerrado';
  assert (select count(*) from public.profiles) = 1, 'lojista vê só o próprio perfil';

  begin
    insert into public.checkpoints (label) values ('Ponto do lojista');
    raise exception 'FALHOU: lojista criou checkpoint (critério 3)';
  exception when insufficient_privilege then null; end;

  begin
    update public.profiles set staff_role = 'admin' where id = 'd0000000-0000-4000-8000-00000000000b';
    raise exception 'FALHOU: lojista se promoveu a admin';
  exception when insufficient_privilege then null; end;
end $$;

-- RLS como visitante ---------------------------------------------------------
set request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000c';
do $$ begin
  assert (select count(*) from public.redemptions) = 3, 'visitante vê os próprios cupons de resgate';
  update public.profiles set name = 'Marina' where id = 'd0000000-0000-4000-8000-00000000000c';
  assert (select name from public.profiles) = 'Marina', 'visitante muda o próprio nome';

  begin
    update public.profiles set points = 99999 where id = 'd0000000-0000-4000-8000-00000000000c';
    raise exception 'FALHOU: visitante mudou os próprios pontos';
  exception when insufficient_privilege then null; end;

  begin
    perform private.grant_staff('marina@visitante.test', 'admin', null);
    raise exception 'FALHOU: visitante chamou grant_staff';
  exception when insufficient_privilege then null; end;
end $$;

-- RLS como admin -------------------------------------------------------------
set request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000a';
do $$ begin
  assert (select count(*) from public.redemptions) = 3, 'admin vê todos os cupons de resgate';
  assert (select count(*) from public.profiles) = 3, 'admin vê todos os perfis';
  insert into public.checkpoints (label) values ('Palco do evento');
  assert exists (select 1 from public.checkpoints where label = 'Palco do evento'), 'admin cria checkpoint';
end $$;

-- Sem login (anon) -----------------------------------------------------------
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  begin
    perform 1 from public.rewards;
    raise exception 'FALHOU: anon leu recompensas';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
\echo 'OK: todos os testes de banco da spec 003 passaram'
