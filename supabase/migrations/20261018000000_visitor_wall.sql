-- Visitor Wall (Phase 6, D8/D9): visitors pin 24×24 PNG drawings, Jay moderates.
--
-- * Visitors sign in anonymously (Supabase anonymous sign-in) the first time they pin.
-- * Each visitor holds at most one pending drawing; a new one withdraws the old one.
-- * Nothing is public until a moderator (a row in public.admins) approves it.
-- * Every status check uses public.is_admin(), in RLS and in the triggers.
-- * Rows are never deleted by clients: rejected, removed and withdrawn rows stay for audit.
--
-- Error codes raised by the triggers (errcode P0001, the message is the code):
--   auth_required, rate_limited, queue_full, immutable, forbidden, bad_transition

create type public.drawing_status as enum ('pending','approved','rejected','removed','withdrawn');

-- ---------------------------------------------------------------------------
-- Moderators
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now());
alter table public.admins enable row level security;
create policy admins_select_own on public.admins for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.admins a where a.user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Drawings
-- ---------------------------------------------------------------------------
create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status public.drawing_status not null default 'pending',
  png text not null,                                   -- base64 PNG, no data: prefix
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  constraint png_size  check (length(png) <= 5464),    -- ≤ 4096 bytes decoded
  constraint png_magic check (left(png, 11) = 'iVBORw0KGgo'),
  constraint png_dims  check (substring(decode(png, 'base64') from 17 for 8) = '\x0000001800000018'::bytea));
create unique index drawings_one_pending_per_user on public.drawings (user_id) where status = 'pending';
create index drawings_approved_recent on public.drawings (decided_at desc) where status = 'approved';
create index drawings_user_recent on public.drawings (user_id, created_at desc);
alter table public.drawings enable row level security;

create policy drawings_public_approved on public.drawings for select to anon, authenticated using (status = 'approved');
create policy drawings_own_select     on public.drawings for select to authenticated using (user_id = (select auth.uid()));
create policy drawings_admin_select   on public.drawings for select to authenticated using ((select public.is_admin()));
create policy drawings_own_insert     on public.drawings for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy drawings_admin_update   on public.drawings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- no delete policy: soft states only
revoke all on public.drawings from anon, authenticated;
grant select (id, png, status, created_at, decided_at) on public.drawings to anon, authenticated;
grant insert (png) on public.drawings to authenticated;
grant update (status) on public.drawings to authenticated;

-- ---------------------------------------------------------------------------
-- Insert trigger: identity, rate limits, queue size, one pending per visitor
-- ---------------------------------------------------------------------------
create function public.drawings_before_insert() returns trigger
language plpgsql security definer set search_path = '' as
$$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = 'P0001', message = 'auth_required';
  end if;

  new.user_id := uid;
  new.status := 'pending';
  new.created_at := now();
  new.decided_at := null;
  new.decided_by := null;

  -- Per visitor: 5 drawings an hour.
  if (select count(*) from public.drawings d
      where d.user_id = uid and d.created_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;

  -- Whole site: 30 drawings a minute.
  if (select count(*) from public.drawings d
      where d.created_at > now() - interval '1 minute') >= 30 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;

  -- Whole site: at most 200 drawings waiting for a decision.
  if (select count(*) from public.drawings d where d.status = 'pending') >= 200 then
    raise exception using errcode = 'P0001', message = 'queue_full';
  end if;

  -- One spot in the queue per visitor: the new drawing replaces the old one.
  update public.drawings d
     set status = 'withdrawn', decided_at = now(), decided_by = uid
   where d.user_id = uid and d.status = 'pending';

  return new;
end
$$;
revoke all on function public.drawings_before_insert() from public;

create trigger drawings_before_insert
  before insert on public.drawings
  for each row execute function public.drawings_before_insert();

-- ---------------------------------------------------------------------------
-- Update trigger: immutable content, moderator-only transitions
-- ---------------------------------------------------------------------------
create function public.drawings_before_update() returns trigger
language plpgsql security definer set search_path = '' as
$$
declare
  uid uuid := auth.uid();
begin
  if new.png is distinct from old.png
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = 'P0001', message = 'immutable';
  end if;

  -- The insert trigger withdraws the visitor's own previous pending drawing.
  if old.status = 'pending' and new.status = 'withdrawn' and uid is not null and old.user_id = uid then
    new.decided_at := now();
    new.decided_by := uid;
    return new;
  end if;

  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if not ((old.status = 'pending' and new.status in ('approved', 'rejected'))
          or (old.status = 'approved' and new.status = 'removed')) then
    raise exception using errcode = 'P0001', message = 'bad_transition';
  end if;

  new.decided_at := now();
  new.decided_by := uid;
  return new;
end
$$;
revoke all on function public.drawings_before_update() from public;

create trigger drawings_before_update
  before update on public.drawings
  for each row execute function public.drawings_before_update();
