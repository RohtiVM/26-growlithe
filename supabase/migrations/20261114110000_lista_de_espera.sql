-- Spec 002 · ticket T3: lista de espera da landing page (Lead).
-- Os valores de texto espelham `LandingLead` em src/domain/schemas.ts.
-- LGPD: só o necessário para avisar a pessoa e medir o teste A/B. Sem telefone,
-- sem CPF, sem IP.

create table public.landing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254 and email like '_%@_%'),
  profile text not null check (profile in ('visitante', 'lojista', 'shopping')),
  company text check (char_length(company) between 2 and 80),
  variant text not null check (variant in ('A', 'B')),
  utm_source text check (char_length(utm_source) <= 60),
  utm_medium text check (char_length(utm_medium) <= 60),
  utm_campaign text check (char_length(utm_campaign) <= 60),
  consent_lgpd boolean not null check (consent_lgpd),
  created_at timestamptz not null default now(),
  -- Empresa só para lojista e shopping (doc 07).
  constraint landing_leads_company_matches_profile check (
    (profile = 'visitante') = (company is null)
  )
);

-- Critério 6: o mesmo e-mail não cria dois leads, sem diferenciar maiúsculas.
create unique index landing_leads_email_key on public.landing_leads (lower(email));

-- Ninguém lê nem grava leads pelo cliente: só pela função abaixo.
alter table public.landing_leads enable row level security;
revoke all on public.landing_leads from anon, authenticated;

-- Cadastro sem login (a banca escaneia o QR do slide). Devolve 'joined' ou
-- 'already_joined' e nada sobre quem já está na lista.
create function public.join_waitlist(
  p_name text,
  p_email text,
  p_profile text,
  p_company text,
  p_variant text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_consent_lgpd boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.landing_leads (
    name, email, profile, company, variant, utm_source, utm_medium, utm_campaign, consent_lgpd
  ) values (
    btrim(p_name), lower(btrim(p_email)), p_profile, nullif(btrim(p_company), ''), p_variant,
    nullif(btrim(p_utm_source), ''), nullif(btrim(p_utm_medium), ''), nullif(btrim(p_utm_campaign), ''),
    coalesce(p_consent_lgpd, false)
  )
  on conflict ((lower(email))) do nothing
  returning id into v_id;

  return case when v_id is null then 'already_joined' else 'joined' end;
end;
$$;

revoke execute on function public.join_waitlist(text, text, text, text, text, text, text, text, boolean)
  from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, text, text, boolean)
  to anon, authenticated;
