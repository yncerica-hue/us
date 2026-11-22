-- Run once in Supabase Dashboard > SQL Editor, as the project database owner.
-- Tables are private to the API: authenticated users use only the RPCs below.
begin;
create table if not exists public.couple_spaces (
 id uuid primary key default gen_random_uuid(),
 invite_code text not null unique default replace(gen_random_uuid()::text,'-',''),
 state jsonb not null default '{"members":{},"tx":[],"inc":[],"logs":{},"wishes":[]}'::jsonb,
 version integer not null default 1
);
create table if not exists public.couple_members (
 user_id uuid primary key references auth.users(id),
 space_id uuid not null references public.couple_spaces(id)
);
alter table public.couple_spaces enable row level security;
alter table public.couple_members enable row level security;
revoke all on public.couple_spaces, public.couple_members from public, anon, authenticated;

create or replace function public.get_space() returns jsonb
language sql stable security definer set search_path = '' as $$
 select to_jsonb(s) from public.couple_spaces s
 join public.couple_members m on m.space_id=s.id where m.user_id=auth.uid();
$$;
create or replace function public.create_space(nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sid uuid; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if nickname is null or length(btrim(nickname)) not between 1 and 30 then raise exception 'INVALID_NICKNAME'; end if;
 insert into public.couple_spaces(state) values (jsonb_build_object('members',jsonb_build_object(uid::text,btrim(nickname)),'tx','[]'::jsonb,'inc','[]'::jsonb,'logs','{}'::jsonb,'wishes','[]'::jsonb)) returning id into sid;
 insert into public.couple_members(user_id,space_id) values(uid,sid);
 return public.get_space();
end;
$$;
create or replace function public.join_space(invite text,nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.couple_spaces; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if nickname is null or length(btrim(nickname)) not between 1 and 30 then raise exception 'INVALID_NICKNAME'; end if;
 select * into s from public.couple_spaces where invite_code=invite for update;
 if not found then raise exception 'ROOM_UNAVAILABLE'; end if;
 if (select count(*) from public.couple_members where space_id=s.id)>=2 then raise exception 'ROOM_UNAVAILABLE'; end if;
 insert into public.couple_members(user_id,space_id) values(uid,s.id);
 update public.couple_spaces set state=jsonb_set(state,array['members',uid::text],to_jsonb(btrim(nickname)),true),version=version+1 where id=s.id;
 return public.get_space();
end;
$$;
create or replace function public.save_space(space_id uuid,expected_version integer,new_state jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.couple_members m where m.user_id=auth.uid() and m.space_id=save_space.space_id) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(new_state) is distinct from 'object'
 or jsonb_typeof(new_state->'tx') is distinct from 'array'
 or jsonb_typeof(new_state->'inc') is distinct from 'array'
 or jsonb_typeof(new_state->'logs') is distinct from 'object'
 or jsonb_typeof(new_state->'wishes') is distinct from 'array'
 or jsonb_typeof(new_state->'cfg') is distinct from 'object'
 or octet_length(new_state::text)>2000000 then raise exception 'INVALID_STATE'; end if;
 update public.couple_spaces s set state=jsonb_set(new_state,'{members}',s.state->'members'),version=s.version+1
 where s.id=save_space.space_id and s.version=expected_version returning to_jsonb(s) into result;
 if result is null then raise exception 'VERSION_CONFLICT'; end if;
 return result;
end;
$$;
revoke all on function public.get_space(), public.create_space(text), public.join_space(text,text), public.save_space(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.get_space(), public.create_space(text), public.join_space(text,text), public.save_space(uuid,integer,jsonb) to authenticated;
commit;
