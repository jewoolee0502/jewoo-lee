-- Makes Jay a Visitor Wall moderator (plan section 9, step 5).
-- 1. Dashboard > Authentication > Users > Add user: your email, confirmed.
-- 2. Replace REPLACE_WITH_JAY_EMAIL below with that email, then run this file in the SQL Editor.
-- 3. Check: select * from public.admins;
-- Do not commit the edited email.
insert into public.admins (user_id) select id from auth.users where email = 'REPLACE_WITH_JAY_EMAIL' on conflict do nothing;
