-- Creation queue and logs for background Gemini generation

create table if not exists public.creation_queue (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null,
  target_slug text not null,
  status text not null check (status in ('queued','running','succeeded','failed')) default 'queued',
  result_slug text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint uq_creation_unique unique (source_slug, target_slug)
);

create table if not exists public.creation_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.creation_queue(id) on delete cascade,
  ts timestamptz not null default now(),
  level text not null check (level in ('info','warn','error')) default 'info',
  phase text,
  tool_name text,
  message text,
  args_snip text,
  result_snip text,
  meta jsonb
);

-- Helpful indexes
create index if not exists idx_creation_queue_status on public.creation_queue(status);
create index if not exists idx_creation_logs_queue on public.creation_logs(queue_id, ts);

