-- FAIRCHANCE OFFICIAL DRAW MANAGEMENT
-- Run this after backend_repair.sql, admin_migration.sql, and
-- winner_proof_migration.sql in Supabase Dashboard -> SQL Editor -> Run.
-- It is safe to run again.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Creates a new draft or updates an existing draft. Published draws are locked.
create or replace function public.save_draw_draft(
  p_title text,
  p_draw_month date,
  p_mode text,
  p_prize_pool_inr numeric,
  p_draw_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_draw_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Draw title is required';
  end if;

  if p_draw_month is null then
    raise exception 'Draw month is required';
  end if;

  if p_mode not in ('random', 'algorithmic') then
    raise exception 'Invalid draw mode';
  end if;

  if p_prize_pool_inr is null or p_prize_pool_inr < 0 then
    raise exception 'Prize pool must be zero or greater';
  end if;

  if p_draw_id is not null then
    update public.draws
    set title = trim(p_title),
        draw_month = p_draw_month,
        mode = p_mode,
        prize_pool_inr = p_prize_pool_inr
    where id = p_draw_id
      and status = 'draft'
    returning id into v_draw_id;
  else
    insert into public.draws (title, draw_month, status, mode, prize_pool_inr)
    values (trim(p_title), p_draw_month, 'draft', p_mode, p_prize_pool_inr)
    on conflict (draw_month) do update
      set title = excluded.title,
          mode = excluded.mode,
          prize_pool_inr = excluded.prize_pool_inr
      where public.draws.status = 'draft'
    returning id into v_draw_id;
  end if;

  if v_draw_id is null then
    raise exception 'This draw is already published and cannot be changed';
  end if;

  return v_draw_id;
end;
$$;

-- Publishes the official five numbers and freezes matching winners. A member
-- needs five saved scores; while payment is in test mode, the active-payment
-- eligibility check is intentionally not applied yet.
create or replace function public.publish_draw_and_create_winners(
  p_draw_id uuid,
  p_winning_numbers integer[]
)
returns table (winner_count integer) language plpgsql security definer set search_path = public as $$
declare
  v_prize_pool numeric(12,2);
  v_status public.draw_status;
  v_winner_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if coalesce(array_length(p_winning_numbers, 1), 0) <> 5
     or exists (select 1 from unnest(p_winning_numbers) as number where number < 1 or number > 45)
     or (select count(distinct number) from unnest(p_winning_numbers) as number) <> 5 then
    raise exception 'Provide five unique numbers between 1 and 45';
  end if;

  select status, prize_pool_inr into v_status, v_prize_pool
  from public.draws
  where id = p_draw_id
  for update;

  if not found then
    raise exception 'Draw not found';
  end if;

  if v_status <> 'draft' then
    raise exception 'Only a draft draw can be published';
  end if;

  update public.draws
  set status = 'published',
      winning_numbers = p_winning_numbers
  where id = p_draw_id;

  with ranked_scores as (
    select
      user_id,
      score,
      played_on,
      created_at,
      row_number() over (
        partition by user_id
        order by played_on desc, created_at desc
      ) as score_rank
    from public.golf_scores
  ),
  entries as (
    select user_id, array_agg(score order by played_on desc, created_at desc) as scores
    from ranked_scores
    where score_rank <= 5
    group by user_id
    having count(*) = 5
  ),
  matched_entries as (
    select
      entries.user_id,
      (
        select count(*)::integer
        from unnest(p_winning_numbers) as number
        where number = any(entries.scores)
      ) as match_count
    from entries
  ),
  winning_entries as (
    select user_id, match_count
    from matched_entries
    where match_count between 3 and 5
  ),
  category_counts as (
    select
      count(*) filter (where match_count = 5)::numeric as five_matches,
      count(*) filter (where match_count = 4)::numeric as four_matches,
      count(*) filter (where match_count = 3)::numeric as three_matches
    from winning_entries
  )
  insert into public.winners (draw_id, user_id, match_count, prize_amount_inr)
  select
    p_draw_id,
    winning_entries.user_id,
    winning_entries.match_count,
    case winning_entries.match_count
      when 5 then case when category_counts.five_matches > 0 then round(v_prize_pool * 0.40 / category_counts.five_matches, 2) else 0 end
      when 4 then case when category_counts.four_matches > 0 then round(v_prize_pool * 0.35 / category_counts.four_matches, 2) else 0 end
      when 3 then case when category_counts.three_matches > 0 then round(v_prize_pool * 0.25 / category_counts.three_matches, 2) else 0 end
      else 0
    end
  from winning_entries
  cross join category_counts;

  get diagnostics v_winner_count = row_count;
  return query select v_winner_count;
end;
$$;

revoke all on function public.save_draw_draft(text, date, text, numeric, uuid) from public;
revoke all on function public.publish_draw_and_create_winners(uuid, integer[]) from public;
grant execute on function public.save_draw_draft(text, date, text, numeric, uuid) to authenticated;
grant execute on function public.publish_draw_and_create_winners(uuid, integer[]) to authenticated;
