-- Testes de banco do modo avaliador (spec 008). Transação desfeita no fim.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('e8000000-0000-4000-8000-00000000000a', null),
  ('e8000000-0000-4000-8000-00000000000b', 'pessoa-com-email@test.dev'),
  ('e8000000-0000-4000-8000-00000000000c', 'admin-real@test.dev');
select private.grant_staff('admin-real@test.dev', 'admin', null);

set local role authenticated;

-- Critério 1/3: sessão anônima dentro do prazo vira admin, com nome padrão.
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-00000000000a', true);
select set_config('request.jwt.claims', '{"is_anonymous": true}', true);
do $$ begin
  assert public.claim_evaluator_access(), 'anônimo deve conseguir o modo avaliador';
  assert private.staff_role() = 'admin', 'avaliador vira admin';
  assert (select name from public.profiles where id = 'e8000000-0000-4000-8000-00000000000a') = 'Avaliador(a)', 'nome padrão';
end $$;

-- Critério 5: conta com e-mail não muda.
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-00000000000b', true);
select set_config('request.jwt.claims', '{"is_anonymous": false}', true);
do $$ begin
  assert not public.claim_evaluator_access(), 'conta com e-mail não usa o modo avaliador';
  assert private.staff_role() is null, 'continua sem papel';
end $$;

-- Um admin de verdade não perde nem ganha prazo.
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-00000000000c', true);
select set_config('request.jwt.claims', '{"is_anonymous": true}', true);
do $$ begin
  assert not public.claim_evaluator_access(), 'admin real não é rebaixado a avaliador';
  assert private.staff_role() = 'admin', 'admin real continua admin';
end $$;

-- Critério 4: com o prazo vencido, o papel do avaliador deixa de valer.
reset role;
update public.profiles set evaluator_until = now() - interval '1 second'
 where id = 'e8000000-0000-4000-8000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e8000000-0000-4000-8000-00000000000a', true);
do $$ begin
  assert private.staff_role() is null, 'prazo vencido: sem papel';
  begin
    insert into public.checkpoints (label) values ('Ponto de avaliador vencido');
    raise exception 'FALHOU: avaliador vencido criou checkpoint';
  exception when insufficient_privilege then null; end;
end $$;

-- Sem login não chama.
reset role;
set local role anon;
do $$ begin
  begin
    perform public.claim_evaluator_access();
    raise exception 'FALHOU: anon chamou o modo avaliador';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
\echo 'OK: testes de banco do modo avaliador passaram'
