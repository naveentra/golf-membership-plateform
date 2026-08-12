-- Run this once in Supabase Dashboard → SQL Editor → New query.
-- It creates the database structure for FairChance.

create type public.user_role as enum ('user', 'admin');
create type public.subscription_status as enum ('active', 'inactive', 'cancelled', 'past_due');
create type public.draw_status as enum ('draft', 'published', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status public.subscription_status not null default 'inactive',
  charity_id uuid references public.charities(id) on delete set null,
  charity_percentage numeric(5,2) not null default 10 check (charity_percentage >= 10 and charity_percentage <= 100),
  renewal_date date,
  created_at timestamptz not null default now()
);

create table public.golf_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 1 and 45),
  played_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, played_on)
);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  draw_month date not null unique,
  status public.draw_status not null default 'draft',
  mode text not null check (mode in ('random', 'algorithmic')),
  winning_numbers integer[] check (cardinality(winning_numbers) = 5),
  prize_pool_inr numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.winners (
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

alter table public.profiles enable row level security;
alter table public.charities enable row level security;
alter table public.subscriptions enable row level security;
alter table public.golf_scores enable row level security;
alter table public.draws enable row level security;
alter table public.winners enable row level security;

create policy "Profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles: update own" on public.profiles for update using (auth.uid() = id);
create policy "Charities: public read" on public.charities for select using (true);
create policy "Subscriptions: read own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Scores: read own" on public.golf_scores for select using (auth.uid() = user_id);
create policy "Scores: add own" on public.golf_scores for insert with check (auth.uid() = user_id);
create policy "Scores: update own" on public.golf_scores for update using (auth.uid() = user_id);
create policy "Scores: delete own" on public.golf_scores for delete using (auth.uid() = user_id);
create policy "Draws: public read" on public.draws for select using (status = 'published');
create policy "Winners: read own" on public.winners for select using (auth.uid() = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'FairChance member'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.create_profile_for_new_user();
