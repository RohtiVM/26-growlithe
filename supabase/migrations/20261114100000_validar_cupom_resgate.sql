-- Spec 003 · tickets T7 (#9) e T8 (#10): conferir e validar cupom de resgate.
-- As duas funções são a única porta para o painel ler e mudar um resgate pelo
-- código de 6 dígitos. Respondem jsonb com `result`:
--   ok | not_found | already_used | expired | other_store | admin_only
-- Os códigos espelham REDEMPTION_LOOKUP_ERRORS em src/domain/schemas.ts.
--
-- Regra D6: admin valida qualquer cupom de resgate; lojista só os da própria
-- loja; benefício sem loja (estacionamento grátis) só o admin valida.
-- A loja é conferida antes do estado, para o lojista não saber quando um
-- cupom de resgate de outra loja foi usado.

-- O índice único só cobre os reservados; a busca do motivo do erro olha
-- também os resgates antigos com o mesmo código (RNF07: responder em até 1 s).
create index redemptions_code_created_at_idx on public.redemptions (code, created_at desc)
  where code is not null;

-- ------------------------------------------------------------------
-- Conferir (critério 15, RNF05): não altera nada e devolve só o que a tela
-- mostra. Do visitante, só o primeiro nome e os pontos históricos (para o
-- nível); nunca e-mail, telefone ou CPF.
-- ------------------------------------------------------------------
create function public.preview_redemption(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.staff_role();
  v_store uuid := private.staff_store_id();
  v record;
begin
  if v_role is null or v_role not in ('admin', 'lojista') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_code is null or p_code !~ '^[0-9]{6}$' then
    return jsonb_build_object('result', 'not_found');
  end if;

  -- Um código pode se repetir entre resgates antigos; vale o reservado (único)
  -- e, sem ele, o mais recente.
  select r.status, r.expires_at, r.redeemed_at,
         w.title, w.benefit, w.store_id,
         p.name, p.lifetime_points
    into v
    from public.redemptions r
    join public.rewards w on w.id = r.reward_id
    join public.profiles p on p.id = r.user_id
   where r.code = p_code
   order by (r.status = 'reserved') desc, r.created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  if v_role = 'lojista' then
    if v.store_id is null then
      return jsonb_build_object('result', 'admin_only');
    end if;
    if v.store_id is distinct from v_store then
      return jsonb_build_object('result', 'other_store');
    end if;
  end if;

  if v.status = 'redeemed' then
    return jsonb_build_object('result', 'already_used', 'redeemed_at', v.redeemed_at);
  end if;
  if v.status = 'expired' or v.expires_at <= now() then
    return jsonb_build_object('result', 'expired');
  end if;

  return jsonb_build_object(
    'result', 'ok',
    'benefit', v.benefit,
    'reward_title', v.title,
    'store_id', v.store_id,
    'first_name', split_part(btrim(v.name), ' ', 1),
    'lifetime_points', v.lifetime_points,
    'expires_at', v.expires_at
  );
end;
$$;

-- ------------------------------------------------------------------
-- Validar (critérios 16–19, RNF03, RNF12): um único UPDATE condicional.
-- Duas chamadas simultâneas disputam o lock da mesma linha; a segunda, ao
-- reler a linha já 'redeemed', não casa com `status = 'reserved'` e não
-- altera nada. Quem validou e de qual loja fica gravado.
-- ------------------------------------------------------------------
create function public.validate_redemption(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := private.staff_role();
  v_store uuid := private.staff_store_id();
  v_redeemed_at timestamptz;
  v_reason jsonb;
begin
  if v_role is null or v_role not in ('admin', 'lojista') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_code is not null and p_code ~ '^[0-9]{6}$' then
    update public.redemptions r
       set status = 'redeemed',
           redeemed_at = now(),
           validated_by = v_uid,
           validated_by_store_id = v_store  -- null para o admin
      from public.rewards w
     where w.id = r.reward_id
       and r.code = p_code
       and r.status = 'reserved'
       and r.expires_at > now()
       and (v_role = 'admin' or (w.store_id is not null and w.store_id = v_store))
    returning r.redeemed_at into v_redeemed_at;

    if v_redeemed_at is not null then
      return jsonb_build_object('result', 'ok', 'redeemed_at', v_redeemed_at);
    end if;
  end if;

  -- Nada mudou: a conferência explica o motivo, com a mesma regra.
  v_reason := public.preview_redemption(p_code);
  if v_reason ->> 'result' = 'ok' then
    return jsonb_build_object('result', 'not_found');
  end if;
  return v_reason;
end;
$$;

revoke execute on function public.preview_redemption(text), public.validate_redemption(text)
  from public, anon;
grant execute on function public.preview_redemption(text), public.validate_redemption(text)
  to authenticated;
