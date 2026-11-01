-- ============================================================
-- inner — схема базы данных для Supabase
-- Запусти целиком в Supabase → SQL Editor → New query → Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Профили ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  plus boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), new.raw_user_meta_data->>'username')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(u text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- Круг (дружба) ----------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null default auth.uid() references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create unique index if not exists friend_pair on public.friend_requests (least(from_id, to_id), greatest(from_id, to_id));

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted' and ((from_id = a and to_id = b) or (from_id = b and to_id = a))
  );
$$;

create or replace function public.can_see_user(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select u = auth.uid() or public.is_friend(auth.uid(), u);
$$;

create or replace function public.friend_count(u uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.friend_requests
  where status = 'accepted' and (from_id = u or to_id = u);
$$;

create or replace function public.circle_limit(u uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when coalesce((select plus from public.profiles where id = u), false) then 500 else 150 end;
$$;

create or replace function public.check_circle_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    if public.friend_count(new.from_id) >= public.circle_limit(new.from_id)
       or public.friend_count(new.to_id) >= public.circle_limit(new.to_id) then
      raise exception 'circle_full';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists circle_limit_check on public.friend_requests;
create trigger circle_limit_check before update on public.friend_requests
  for each row execute function public.check_circle_limit();

-- ---------- Посты ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  image_path text,
  repost_of uuid references public.posts on delete cascade,
  allow_reposts boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists posts_author_created on public.posts (author_id, created_at desc);

create table if not exists public.likes (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post on public.comments (post_id, created_at);

-- ---------- Истории (живут 24 часа) ----------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  image_path text not null,
  caption text not null default '' check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_author on public.stories (author_id, created_at);

-- ---------- Чаты ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  shared_post_id uuid references public.posts on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_conv on public.messages (conversation_id, created_at);

create or replace function public.is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = conv and auth.uid() in (user_a, user_b));
$$;

create or replace function public.get_or_create_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(auth.uid(), other);
  b uuid := greatest(auth.uid(), other);
  cid uuid;
begin
  if auth.uid() is null or other = auth.uid() or not public.is_friend(auth.uid(), other) then
    raise exception 'not_in_circle';
  end if;
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.conversations (user_a, user_b) values (a, b) returning id into cid;
  end if;
  return cid;
end $$;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_touch on public.messages;
create trigger messages_touch after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------- Звонки ----------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null default auth.uid() references public.profiles on delete cascade,
  callee_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('voice', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'ended', 'missed', 'cancelled')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index if not exists calls_caller on public.calls (caller_id, created_at desc);
create index if not exists calls_callee on public.calls (callee_id, created_at desc);

-- ============================================================
-- Политики доступа (RLS)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;

-- Профили видят все вошедшие (нужно для поиска людей), меняет только владелец
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_path) on public.profiles to authenticated;

-- Запросы в круг
drop policy if exists "fr read" on public.friend_requests;
create policy "fr read" on public.friend_requests for select to authenticated using (auth.uid() in (from_id, to_id));
drop policy if exists "fr insert" on public.friend_requests;
create policy "fr insert" on public.friend_requests for insert to authenticated with check (from_id = auth.uid() and status = 'pending');
drop policy if exists "fr answer" on public.friend_requests;
create policy "fr answer" on public.friend_requests for update to authenticated using (to_id = auth.uid()) with check (to_id = auth.uid());
drop policy if exists "fr delete" on public.friend_requests;
create policy "fr delete" on public.friend_requests for delete to authenticated using (auth.uid() in (from_id, to_id));
revoke update on public.friend_requests from authenticated;
grant update (status) on public.friend_requests to authenticated;

-- Посты: видит только автор и его круг
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (public.can_see_user(author_id));
drop policy if exists "posts insert" on public.posts;
create policy "posts insert" on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "likes read" on public.likes;
create policy "likes read" on public.likes for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "likes insert" on public.likes;
create policy "likes insert" on public.likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "likes delete" on public.likes;
create policy "likes delete" on public.likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "comments delete" on public.comments;
create policy "comments delete" on public.comments for delete to authenticated using (author_id = auth.uid());

-- Истории
drop policy if exists "stories read" on public.stories;
create policy "stories read" on public.stories for select to authenticated using (public.can_see_user(author_id) and expires_at > now());
drop policy if exists "stories insert" on public.stories;
create policy "stories insert" on public.stories for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "stories delete" on public.stories;
create policy "stories delete" on public.stories for delete to authenticated using (author_id = auth.uid());

-- Чаты (создаются только функцией get_or_create_conversation)
drop policy if exists "conv read" on public.conversations;
create policy "conv read" on public.conversations for select to authenticated using (auth.uid() in (user_a, user_b));

drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select to authenticated using (public.is_participant(conversation_id));
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_participant(conversation_id));
drop policy if exists "msg mark read" on public.messages;
create policy "msg mark read" on public.messages for update to authenticated using (public.is_participant(conversation_id) and sender_id <> auth.uid());
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- Звонки
drop policy if exists "calls read" on public.calls;
create policy "calls read" on public.calls for select to authenticated using (auth.uid() in (caller_id, callee_id));
drop policy if exists "calls insert" on public.calls;
create policy "calls insert" on public.calls for insert to authenticated with check (caller_id = auth.uid() and public.is_friend(caller_id, callee_id) and status = 'ringing');
drop policy if exists "calls update" on public.calls;
create policy "calls update" on public.calls for update to authenticated using (auth.uid() in (caller_id, callee_id));
revoke update on public.calls from authenticated;
grant update (status, answered_at, ended_at) on public.calls to authenticated;

-- ============================================================
-- Realtime: живые сообщения, звонки и запросы в круг
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.calls; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.friend_requests; exception when duplicate_object then null; end;
end $$;

-- ============================================================
-- Хранилище фото
-- Пути вида <user_id>/<случайное имя>.jpg — грузить можно только в свою папку.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media upload own" on storage.objects;
create policy "media upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
