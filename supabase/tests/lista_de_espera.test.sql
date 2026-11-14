-- Testes de banco da spec 002 (T3). Cada bloco falha com exceção se a regra quebrar.
\set ON_ERROR_STOP on
reset role;

-- Sem login (anon): a banca se cadastra pelo QR do slide ------------------------
set role anon;
do $$ begin
  assert public.join_waitlist('Banca do Hackathon', ' Banca@Hackathon.test ', 'visitante', null, 'B',
    'slide', 'qr', 'pitch', true) = 'joined', 'anon entra na lista de espera';

  assert public.join_waitlist('Outra pessoa', 'banca@HACKATHON.test', 'lojista', 'Moda Cerrado', 'A',
    null, null, null, true) = 'already_joined', 'mesmo e-mail com outra caixa não duplica (critério 6)';

  begin
    perform public.join_waitlist('Sem aceite', 'sem-aceite@hackathon.test', 'visitante', null, 'A',
      null, null, null, false);
    raise exception 'FALHOU: lead sem aceite LGPD foi aceito';
  exception when check_violation then null; end;

  begin
    perform public.join_waitlist('Lojista sem loja', 'lojista@hackathon.test', 'lojista', null, 'A',
      null, null, null, true);
    raise exception 'FALHOU: lojista sem empresa foi aceito';
  exception when check_violation then null; end;

  begin
    perform public.join_waitlist('Variante falsa', 'variante@hackathon.test', 'visitante', null, 'C',
      null, null, null, true);
    raise exception 'FALHOU: variante fora de A/B foi aceita';
  exception when check_violation then null; end;

  begin
    perform 1 from public.landing_leads;
    raise exception 'FALHOU: anon leu leads';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.landing_leads (name, email, profile, variant, consent_lgpd)
    values ('Direto', 'direto@hackathon.test', 'visitante', 'A', true);
    raise exception 'FALHOU: anon gravou lead sem passar pela função';
  exception when insufficient_privilege then null; end;
end $$;

-- Logado (authenticated) ------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'd0000000-0000-4000-8000-0000000000ff';
do $$ begin
  assert public.join_waitlist('Marina', 'marina@lista.test', 'shopping', 'Capim Dourado', 'A',
    null, null, null, true) = 'joined', 'authenticated entra na lista de espera';

  begin
    perform 1 from public.landing_leads;
    raise exception 'FALHOU: authenticated leu leads';
  exception when insufficient_privilege then null; end;
end $$;

-- O que ficou gravado ---------------------------------------------------------
reset request.jwt.claim.sub;
reset role;
do $$ begin
  assert (select count(*) from public.landing_leads) = 2, 'dois leads, sem duplicata';
  assert exists (
    select 1 from public.landing_leads
    where email = 'banca@hackathon.test' and profile = 'visitante' and company is null
      and variant = 'B' and utm_source = 'slide' and utm_medium = 'qr' and utm_campaign = 'pitch'
  ), 'primeiro cadastro preservado, com variante e UTM (critério 5)';
end $$;

-- Não deixa leads para os próximos arquivos de teste.
delete from public.landing_leads;
\echo 'OK: todos os testes de banco da spec 002 passaram'
