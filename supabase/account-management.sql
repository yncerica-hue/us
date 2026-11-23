-- Run in Supabase Dashboard > SQL Editor to enable nickname changes.
-- Safe to rerun; existing accounts and shared records are preserved.
begin;
create or replace function public.update_nickname(nickname text, expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid; result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if nickname is null or length(btrim(nickname)) not between 1 and 30 then raise exception 'INVALID_NICKNAME'; end if;
 select m.space_id into sid from public.couple_members m where m.user_id=uid;
 if sid is null then raise exception 'FORBIDDEN'; end if;
 update public.couple_spaces s
 set state=jsonb_set(s.state,array['members',uid::text],to_jsonb(btrim(nickname)),true),version=s.version+1
 where s.id=sid and s.version=expected_version returning to_jsonb(s) into result;
 if result is null then raise exception 'VERSION_CONFLICT'; end if;
 return result;
end;
$$;
revoke all on function public.update_nickname(text,integer) from public, anon, authenticated;
grant execute on function public.update_nickname(text,integer) to authenticated;
commit;
