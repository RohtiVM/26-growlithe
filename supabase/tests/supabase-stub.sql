-- Substituto mínimo do que o Supabase já traz, para testar migrations num
-- Postgres comum (CI ou local). NÃO aplicar no projeto Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Como no Supabase: toda tabela nova em public nasce com ALL para estes papéis.
-- Sem isto, os testes passariam mesmo com a migration esquecendo de revogar.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
