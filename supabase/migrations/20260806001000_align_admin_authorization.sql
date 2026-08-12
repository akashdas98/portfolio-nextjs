create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

insert into public.admin_users (email)
values ('akash42662012@gmail.com')
on conflict (email) do nothing;

drop policy if exists "Admin users can read own admin record" on public.admin_users;
create policy "Admin users can read own admin record"
on public.admin_users for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

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
