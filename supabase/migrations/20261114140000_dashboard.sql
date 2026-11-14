-- Spec 003 · T9 (#11): dashboard do admin. Uma função só devolve os seis
-- indicadores (D7), no formato de `DashboardMetrics` (src/domain/schemas.ts).
-- Visitas da landing por variante viram contadores diários (sem dado pessoal).

create table public.landing_visits (
  visited_on date not null,
  variant text not null check (variant in ('A', 'B')),
  visits integer not null default 0 check (visits >= 0),
  primary key (visited_on, variant)
);
alter table public.landing_visits enable row level security;
revoke all on public.landing_visits from anon, authenticated;

-- Chamada pelo middleware quando um visitante novo recebe a variante do teste A/B.
create function public.count_landing_visit(p_variant text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_variant is null or p_variant not in ('A', 'B') then
    return;
  end if;
  insert into public.landing_visits (visited_on, variant, visits)
  values ((now() at time zone 'America/Araguaina')::date, p_variant, 1)
  on conflict (visited_on, variant) do update set visits = public.landing_visits.visits + 1;
end;
$$;

-- Só o admin lê os números (critérios 4–7).
create function public.dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Araguaina')::date;
begin
  if private.staff_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'checkinsToday', (select count(*) from public.scans where scanned_on = v_today and is_checkin),
    'uniqueVisitors7d', (select count(distinct user_id) from public.scans where scanned_on > v_today - 7),
    'scansByCheckpoint', coalesce((
      select jsonb_agg(jsonb_build_object('checkpointId', c.id, 'label', c.label, 'scans', c.n) order by c.n desc, c.label)
        from (
          select cp.id, cp.label, count(s.id) as n
            from public.checkpoints cp
            join public.scans s on s.checkpoint_id = cp.id
           group by cp.id, cp.label
        ) c
    ), '[]'::jsonb),
    'missionsCompleted', (select count(*) from public.mission_progress where completed_at is not null),
    'redemptionsValidated', (select count(*) from public.redemptions where status = 'redeemed'),
    'leads', jsonb_build_object(
      'A', jsonb_build_object(
        'visits', (select coalesce(sum(visits), 0) from public.landing_visits where variant = 'A'),
        'leads', (select count(*) from public.landing_leads where variant = 'A')
      ),
      'B', jsonb_build_object(
        'visits', (select coalesce(sum(visits), 0) from public.landing_visits where variant = 'B'),
        'leads', (select count(*) from public.landing_leads where variant = 'B')
      )
    )
  );
end;
$$;

revoke execute on function public.count_landing_visit(text), public.dashboard_metrics() from public;
grant execute on function public.count_landing_visit(text) to anon, authenticated;
revoke execute on function public.dashboard_metrics() from anon;
grant execute on function public.dashboard_metrics() to authenticated;
