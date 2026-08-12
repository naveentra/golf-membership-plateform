-- FAIRCHANCE BACKEND REPAIR
-- Run this complete file once in Supabase Dashboard -> SQL Editor -> Run.
-- Safe to run more than once. It creates or repairs the core database schema.

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'inactive', 'cancelled', 'past_due');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.draw_status as enum ('draft', 'published', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  image_url text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status public.subscription_status not null default 'inactive',
  charity_id uuid references public.charities(id) on delete set null,
  charity_percentage numeric(5,2) not null default 10 check (charity_percentage between 10 and 100),
  renewal_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.golf_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 1 and 45),
  played_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, played_on)
);

create index if not exists golf_scores_user_date_idx on public.golf_scores (user_id, played_on desc);

create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  draw_month date not null unique,
  status public.draw_status not null default 'draft',
  mode text not null check (mode in ('random', 'algorithmic')),
  winning_numbers integer[] check (cardinality(winning_numbers) = 5),
  prize_pool_inr numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_count integer not null check (match_count between 3 and 5),
  prize_amount_inr numeric(12,2) not null default 0,
  proof_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'approved', 'rejected')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

-- Every new Auth user automatically receives a profile row.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'FairChance member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

-- Repair profiles for accounts created before the trigger existed.
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', 'FairChance member') from auth.users
on conflict (id) do nothing;

-- Database-level enforcement: retain only the newest five scores per member.
create or replace function public.keep_latest_five_scores()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.golf_scores
  where id in (
    select id from public.golf_scores
    where user_id = new.user_id
    order by played_on desc, created_at desc
    offset 5
  );
  return new;
end;
$$;

drop trigger if exists keep_latest_five_scores_trigger on public.golf_scores;
create trigger keep_latest_five_scores_trigger
  after insert on public.golf_scores
  for each row execute procedure public.keep_latest_five_scores();

alter table public.profiles enable row level security;
alter table public.charities enable row level security;
alter table public.subscriptions enable row level security;
alter table public.golf_scores enable row level security;
alter table public.draws enable row level security;
alter table public.winners enable row level security;

drop policy if exists "Profiles: read own" on public.profiles;
drop policy if exists "Profiles: update own" on public.profiles;
drop policy if exists "Charities: public read" on public.charities;
drop policy if exists "Subscriptions: read own" on public.subscriptions;
drop policy if exists "Subscriptions: add own" on public.subscriptions;
drop policy if exists "Subscriptions: update own" on public.subscriptions;
drop policy if exists "Scores: read own" on public.golf_scores;
drop policy if exists "Scores: add own" on public.golf_scores;
drop policy if exists "Scores: update own" on public.golf_scores;
drop policy if exists "Scores: delete own" on public.golf_scores;
drop policy if exists "Draws: public read" on public.draws;
drop policy if exists "Winners: read own" on public.winners;

create policy "Profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Charities: public read" on public.charities for select using (true);
create policy "Subscriptions: read own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Subscriptions: add own" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "Subscriptions: update own" on public.subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Scores: read own" on public.golf_scores for select using (auth.uid() = user_id);
create policy "Scores: add own" on public.golf_scores for insert with check (auth.uid() = user_id);
create policy "Scores: update own" on public.golf_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Scores: delete own" on public.golf_scores for delete using (auth.uid() = user_id);
create policy "Draws: public read" on public.draws for select using (status = 'published');
create policy "Winners: read own" on public.winners for select using (auth.uid() = user_id);

insert into public.charities (name, description, is_featured) values
  ('First Tee India', 'Helping young people build confidence and life skills through golf.', true),
  ('Teach For India', 'Working towards excellent education for every child in India.', true),
  ('The Akshaya Patra Foundation', 'Serving nutritious mid-day meals to school children.', false),
  ('Milaap', 'Supporting health, education and community-led social impact.', false)
on conflict (name) do nothing;
