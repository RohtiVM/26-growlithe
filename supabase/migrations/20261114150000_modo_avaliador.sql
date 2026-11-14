-- Spec 008 · modo avaliador: login anônimo vira admin por tempo limitado.
-- Prazo (D3): 15/11/2026 23h59 em Palmas (UTC−3) = 16/11/2026 02:59:59 UTC.

alter table public.profiles add column evaluator_until timestamptz;

-- O papel de quem entrou pelo modo avaliador deixa de valer sozinho no prazo (critério 4).
create or replace function private.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when p.evaluator_until is not null and p.evaluator_until <= now() then null
           else p.staff_role
         end
    from public.profiles p
   where p.id = (select auth.uid());
$$;

-- Critérios 1, 3 e 5: só sessão anônima, só dentro do prazo, só conta sem papel.
create function public.claim_evaluator_access()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_until timestamptz := timestamptz '2026-11-16 02:59:59+00';
begin
  if v_uid is null
     or coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'true'
     or now() >= v_until then
    return false;
  end if;

  update public.profiles
     set staff_role = 'admin',
         store_id = null,
         evaluator_until = v_until,
         name = case when btrim(name) = '' then 'Avaliador(a)' else name end
   where id = v_uid
     and (staff_role is null or evaluator_until is not null);
  return found;
end;
$$;

revoke execute on function public.claim_evaluator_access() from public, anon;
grant execute on function public.claim_evaluator_access() to authenticated;
