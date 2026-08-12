-- Run once in Supabase Dashboard -> SQL Editor.
-- Adds member permissions and sample Indian charities for the FairChance charity module.

create policy "Subscriptions: add own" on public.subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Subscriptions: update own" on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.charities (name, description, is_featured) values
  ('First Tee India', 'Helping young people build confidence and life skills through golf.', true),
  ('Teach For India', 'Working towards excellent education for every child in India.', true),
  ('The Akshaya Patra Foundation', 'Serving nutritious mid-day meals to school children.', false),
  ('Milaap', 'Supporting health, education and community-led social impact.', false)
on conflict do nothing;
