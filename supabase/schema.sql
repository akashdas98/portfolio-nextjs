create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  url text,
  category text not null,
  title text not null,
  challenge text not null,
  delivery text not null,
  capabilities text[] not null default '{}',
  metrics jsonb not null default '[]'::jsonb,
  order_index integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  budget text,
  message text not null,
  source text not null default 'portfolio-contact-form',
  status text not null default 'new' check (status in ('new', 'replied', 'qualified', 'proposal_sent', 'won', 'lost', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  notes text,
  next_action text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gmail',
  provider_message_id text not null unique,
  provider_thread_id text,
  from_email text not null,
  to_email text,
  subject text,
  snippet text,
  received_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'unreviewed' check (status in ('unreviewed', 'linked', 'ignored', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create index if not exists projects_order_index_idx on public.projects(order_index);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_next_follow_up_at_idx on public.leads(next_follow_up_at);
create index if not exists email_messages_status_idx on public.email_messages(status);
create index if not exists email_messages_lead_id_idx on public.email_messages(lead_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_email_messages_updated_at on public.email_messages;
create trigger set_email_messages_updated_at
before update on public.email_messages
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.leads enable row level security;
alter table public.email_messages enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "Admin users can read own admin record" on public.admin_users;
create policy "Admin users can read own admin record"
on public.admin_users for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Published projects are public" on public.projects;
create policy "Published projects are public"
on public.projects for select
using (status = 'published');

drop policy if exists "Authenticated users manage projects" on public.projects;
drop policy if exists "Admin users manage projects" on public.projects;
create policy "Admin users manage projects"
on public.projects for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Authenticated users manage leads" on public.leads;
drop policy if exists "Admin users manage leads" on public.leads;
create policy "Admin users manage leads"
on public.leads for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Authenticated users manage email messages" on public.email_messages;
drop policy if exists "Admin users manage email messages" on public.email_messages;
create policy "Admin users manage email messages"
on public.email_messages for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
