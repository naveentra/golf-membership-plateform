-- FAIRCHANCE ADMIN ACCESS
-- Run once in Supabase SQL Editor after backend_repair.sql.
-- Then promote your own account using the final UPDATE line at the bottom.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "Admins: read all profiles" on public.profiles;
drop policy if exists "Admins: manage charities" on public.charities;
drop policy if exists "Admins: read all scores" on public.golf_scores;
drop policy if exists "Admins: manage draws" on public.draws;
drop policy if exists "Admins: manage winners" on public.winners;

create policy "Admins: read all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins: manage charities" on public.charities for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins: read all scores" on public.golf_scores for select using (public.is_admin());
create policy "Admins: manage draws" on public.draws for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins: manage winners" on public.winners for all using (public.is_admin()) with check (public.is_admin());

-- IMPORTANT: Replace YOUR-LOGIN-EMAIL with the email you used to sign up, then run only this line.
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR-LOGIN-EMAIL');
