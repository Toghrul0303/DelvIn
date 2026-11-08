-- Apply in the Supabase SQL editor after user_subscriptions.sql.
-- This repo has no migration runner. Service role calls consume_quota.
-- Authenticated clients can read their row and cannot increment it.

alter table public.user_subscriptions
  add column if not exists text_used integer not null default 0,
  add column if not exists text_period date,
  add column if not exists vision_used integer not null default 0,
  add column if not exists vision_period date;

create or replace function public.consume_quota(p_user_id uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.user_subscriptions%rowtype;
  effective_plan text;
  paid_alive boolean;
  cap integer;
  used integer;
  today date := (timezone('utc', now()))::date;
  month_start date := date_trunc('month', timezone('utc', now()))::date;
begin
  if p_kind not in ('text', 'vision') then
    raise exception 'invalid quota kind';
  end if;

  insert into public.user_subscriptions (
    user_id, plan, status, vision_queries_monthly, text_queries_daily
  )
  values (p_user_id, 'free', 'active', 10, 20)
  on conflict (user_id) do nothing;

  select * into strict sub
  from public.user_subscriptions
  where user_id = p_user_id
  for update;

  paid_alive := sub.plan in ('pro', 'premium')
    and (sub.current_period_end is null or sub.current_period_end > now());

  if paid_alive then
    effective_plan := sub.plan;
    if p_kind = 'text' then
      cap := sub.text_queries_daily;
    else
      cap := sub.vision_queries_monthly;
    end if;
  else
    effective_plan := 'free';
    if p_kind = 'text' then
      cap := 20;
    else
      cap := 10;
    end if;
  end if;

  if p_kind = 'text' then
    if sub.text_period is distinct from today then
      used := 0;
    else
      used := sub.text_used;
    end if;
  else
    if sub.vision_period is distinct from month_start then
      used := 0;
    else
      used := sub.vision_used;
    end if;
  end if;

  if cap is null then
    return jsonb_build_object(
      'allowed', true,
      'kind', p_kind,
      'plan', effective_plan,
      'limit', null,
      'used', used
    );
  end if;

  if used >= cap then
    return jsonb_build_object(
      'allowed', false,
      'kind', p_kind,
      'plan', effective_plan,
      'limit', cap,
      'used', used
    );
  end if;

  used := used + 1;
  if p_kind = 'text' then
    update public.user_subscriptions
    set text_used = used,
        text_period = today,
        updated_at = now()
    where user_id = p_user_id;
  else
    update public.user_subscriptions
    set vision_used = used,
        vision_period = month_start,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'kind', p_kind,
    'plan', effective_plan,
    'limit', cap,
    'used', used
  );
end;
$$;

revoke all on function public.consume_quota(uuid, text) from public;
revoke all on function public.consume_quota(uuid, text) from anon;
revoke all on function public.consume_quota(uuid, text) from authenticated;
grant execute on function public.consume_quota(uuid, text) to service_role;
