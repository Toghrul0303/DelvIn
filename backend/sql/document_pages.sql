-- Apply in the Supabase SQL editor. This repo has no migration runner.
-- The API writes these rows with the signed-in user's JWT (see tools.py).
-- document_chunks / match_document_chunks are unchanged and stay the vector store.

create table if not exists public.document_pages (
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id text not null,
  file_path text not null default '',
  page_index integer not null,
  content text not null default '',
  printed_label text not null default '',
  primary key (user_id, thread_id, page_index)
);

create index if not exists document_pages_thread_idx
  on public.document_pages (user_id, thread_id, page_index);

create table if not exists public.document_indexes (
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id text not null,
  file_path text not null default '',
  page_count integer not null default 0,
  outline jsonb not null default '[]'::jsonb,
  label_map jsonb not null default '{}'::jsonb,
  label_reverse jsonb not null default '{}'::jsonb,
  printed_offset integer,
  scan boolean not null default false,
  embed_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

alter table public.document_pages enable row level security;
alter table public.document_indexes enable row level security;

drop policy if exists "users read own document pages" on public.document_pages;
drop policy if exists "users write own document pages" on public.document_pages;
drop policy if exists "users update own document pages" on public.document_pages;
drop policy if exists "users delete own document pages" on public.document_pages;

create policy "users read own document pages"
  on public.document_pages for select to authenticated
  using (auth.uid() = user_id);

create policy "users write own document pages"
  on public.document_pages for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users update own document pages"
  on public.document_pages for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own document pages"
  on public.document_pages for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users read own document indexes" on public.document_indexes;
drop policy if exists "users write own document indexes" on public.document_indexes;
drop policy if exists "users update own document indexes" on public.document_indexes;
drop policy if exists "users delete own document indexes" on public.document_indexes;

create policy "users read own document indexes"
  on public.document_indexes for select to authenticated
  using (auth.uid() = user_id);

create policy "users write own document indexes"
  on public.document_indexes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users update own document indexes"
  on public.document_indexes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own document indexes"
  on public.document_indexes for delete to authenticated
  using (auth.uid() = user_id);
