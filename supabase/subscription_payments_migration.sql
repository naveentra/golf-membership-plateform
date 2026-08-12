-- FAIRCHANCE RAZORPAY TEST-MODE SUBSCRIPTIONS
-- Run this after backend_repair.sql in Supabase Dashboard -> SQL Editor.
-- It is safe to run more than once.

-- These fields provide an audit trail for verified Razorpay payments while
-- keeping the existing subscriptions table as the single source of truth.
alter table public.subscriptions add column if not exists started_at timestamptz;
alter table public.subscriptions add column if not exists paid_at timestamptz;
alter table public.subscriptions add column if not exists razorpay_order_id text;
alter table public.subscriptions add column if not exists razorpay_payment_id text;

create unique index if not exists subscriptions_razorpay_order_id_key
  on public.subscriptions (razorpay_order_id)
  where razorpay_order_id is not null;

create unique index if not exists subscriptions_razorpay_payment_id_key
  on public.subscriptions (razorpay_payment_id)
  where razorpay_payment_id is not null;

create index if not exists subscriptions_user_paid_at_idx
  on public.subscriptions (user_id, paid_at desc);

-- Members should not be able to set a plan or payment status from the browser.
-- Charity selection remains available through the narrowly scoped RPC below.
drop policy if exists "Subscriptions: add own" on public.subscriptions;
drop policy if exists "Subscriptions: update own" on public.subscriptions;
revoke insert, update, delete on public.subscriptions from authenticated;

create or replace function public.save_subscription_charity_choice(
  p_charity_id uuid,
  p_charity_percentage numeric
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_subscription_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  if p_charity_percentage is null
     or p_charity_percentage < 10
     or p_charity_percentage > 100 then
    raise exception 'Charity contribution must be between 10 and 100';
  end if;

  if not exists (select 1 from public.charities where id = p_charity_id) then
    raise exception 'Selected charity was not found';
  end if;

  select id into v_subscription_id
  from public.subscriptions
  where user_id = auth.uid()
  order by paid_at desc nulls last, created_at desc
  limit 1;

  if v_subscription_id is null then
    insert into public.subscriptions (
      user_id,
      plan,
      status,
      charity_id,
      charity_percentage
    ) values (
      auth.uid(),
      'monthly',
      'inactive',
      p_charity_id,
      p_charity_percentage
    ) returning id into v_subscription_id;
  else
    update public.subscriptions
    set charity_id = p_charity_id,
        charity_percentage = p_charity_percentage
    where id = v_subscription_id
      and user_id = auth.uid();
  end if;

  return v_subscription_id;
end;
$$;

revoke all on function public.save_subscription_charity_choice(uuid, numeric) from public;
grant execute on function public.save_subscription_charity_choice(uuid, numeric) to authenticated;
