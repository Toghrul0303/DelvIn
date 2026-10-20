-- Apply in the Supabase SQL editor. This repo has no migration runner.
-- Service role writes bypass RLS. Authenticated users can only read their own row.

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'premium')),
  status text not null default 'active',
  polar_subscription_id text unique,
  vision_queries_monthly integer not null default 10,
  text_queries_daily integer,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "users read own subscription" on public.user_subscriptions;

create policy "users read own subscription"
  on public.user_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);
