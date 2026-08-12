-- FAIRCHANCE WINNER PROOF WORKFLOW
-- Run this after backend_repair.sql and admin_migration.sql in
-- Supabase Dashboard -> SQL Editor -> Run.
-- This file is safe to run again.

-- Keep the existing proof_url column for backwards compatibility. New uploads
-- use proof_path because the Storage bucket is private and files are served
-- through time-limited signed URLs.
alter table public.winners add column if not exists proof_path text;
alter table public.winners add column if not exists proof_uploaded_at timestamptz;
alter table public.winners add column if not exists reviewed_at timestamptz;
alter table public.winners add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.winners add column if not exists review_notes text;

create index if not exists winners_proof_review_idx
  on public.winners (verification_status, proof_uploaded_at desc)
  where proof_path is not null;

-- Ensures the storage policies below work even if this migration is run before
-- the previous admin migration.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Private image-only bucket for score screenshots. Five megabytes keeps uploads
-- fast and works well with the regular Supabase upload API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'winner-proofs',
  'winner-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Winner proofs: member uploads own folder" on storage.objects;
drop policy if exists "Winner proofs: member reads own folder" on storage.objects;
drop policy if exists "Winner proofs: member deletes own folder" on storage.objects;
drop policy if exists "Winner proofs: admins read all" on storage.objects;

create policy "Winner proofs: member uploads own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'winner-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Winner proofs: member reads own folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'winner-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Winner proofs: member deletes own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'winner-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Winner proofs: admins read all"
on storage.objects for select to authenticated
using (bucket_id = 'winner-proofs' and public.is_admin());

-- Members cannot directly update a winner record. This narrowly scoped RPC
-- records the uploaded path while resetting a re-submitted proof to pending.
create or replace function public.submit_winner_proof(
  p_winner_id uuid,
  p_proof_path text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_proof_path is null
     or split_part(p_proof_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid proof file path';
  end if;

  update public.winners
  set proof_path = p_proof_path,
      proof_url = null,
      proof_uploaded_at = now(),
      verification_status = 'pending',
      reviewed_at = null,
      reviewed_by = null,
      review_notes = null
  where id = p_winner_id and user_id = auth.uid();

  if not found then
    raise exception 'Winner record not found for this account';
  end if;
end;
$$;

-- Only an administrator can make a verification decision.
create or replace function public.review_winner_proof(
  p_winner_id uuid,
  p_verification_status text,
  p_review_notes text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_verification_status not in ('approved', 'rejected') then
    raise exception 'Invalid verification status';
  end if;

  update public.winners
  set verification_status = p_verification_status,
      review_notes = nullif(trim(coalesce(p_review_notes, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_winner_id
    and proof_path is not null;

  if not found then
    raise exception 'A submitted proof was not found';
  end if;
end;
$$;

create or replace function public.mark_winner_paid(p_winner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.winners
  set payment_status = 'paid'
  where id = p_winner_id
    and verification_status = 'approved';

  if not found then
    raise exception 'Only an approved winner can be marked paid';
  end if;
end;
$$;

revoke all on function public.submit_winner_proof(uuid, text) from public;
revoke all on function public.review_winner_proof(uuid, text, text) from public;
revoke all on function public.mark_winner_paid(uuid) from public;
grant execute on function public.submit_winner_proof(uuid, text) to authenticated;
grant execute on function public.review_winner_proof(uuid, text, text) to authenticated;
grant execute on function public.mark_winner_paid(uuid) to authenticated;
