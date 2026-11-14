begin;

-- A parent profile is a self-service account label, never proof of guardianship.
create table private.guardian_profiles (
 user_id uuid primary key references auth.users(id),
 display_name text not null check(length(trim(display_name)) between 2 and 150),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table private.guardian_profiles enable row level security;
revoke all on private.guardian_profiles from public,anon,authenticated;

create function private.assert_parent_account() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_live_session() or not exists(
  select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
   and u.email is not null and (u.banned_until is null or u.banned_until<=now())
 ) then raise exception 'Confirmed active account required' using errcode='42501';end if;
 return auth.uid();
end;$$;
revoke all on function private.assert_parent_account() from public,anon,authenticated;

create function private.parent_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=private.assert_parent_account();
 return jsonb_build_object('profile',(select jsonb_build_object('display_name',p.display_name,'created_at',p.created_at) from private.guardian_profiles p where p.user_id=actor));
end;$$;
create function private.save_parent_profile(p_display_name text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; existed boolean;
begin
 actor:=private.assert_parent_account();
 if p_display_name is null or length(trim(p_display_name)) not between 2 and 150 then raise exception 'Parent display name required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':guardian_profile',0));
 select exists(select 1 from private.guardian_profiles where user_id=actor) into existed;
 insert into private.guardian_profiles(user_id,display_name) values(actor,trim(p_display_name))
 on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
 insert into public.audit_events(actor_id,entity_id,entity_type,action)
 values(actor,actor,'guardian_profile',case when existed then 'updated' else 'created' end);
end;$$;
create function public.parent_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select private.parent_workspace();$$;
create function public.save_parent_profile(p_display_name text) returns void language sql security invoker set search_path='' as $$select private.save_parent_profile(p_display_name);$$;
revoke all on function private.parent_workspace(),public.parent_workspace(),private.save_parent_profile(text),public.save_parent_profile(text) from public,anon,authenticated;
grant execute on function private.parent_workspace(),public.parent_workspace(),private.save_parent_profile(text),public.save_parent_profile(text) to authenticated;

commit;
