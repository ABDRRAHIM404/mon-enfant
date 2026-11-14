begin;

-- A dedicated Auth identity may dispatch mail, without a professional profile,
-- clinical capability, child grant or general admin privilege. Operator-managed.
create table private.notification_workers (
 user_id uuid primary key references auth.users(id), enabled boolean not null default false
);
create table private.approval_notifications (
 id uuid primary key references public.verification_decisions(id),
 request_id uuid not null unique references public.verification_requests(id),
 recipient_id uuid not null references auth.users(id),
 state text not null default 'pending' check(state in ('pending','sending','retry','accepted','failed','needs_review','cancelled')),
 template_version integer not null default 1 check(template_version=1),
 recipient_email text, from_email text, site_origin text,
 attempts integer not null default 0 check(attempts between 0 and 5),
 first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz, provider_message_id uuid,
 created_at timestamptz not null default now(), accepted_at timestamptz,
 check((state='sending')=(lease_id is not null and lease_until is not null)),
 check((state='accepted')=(provider_message_id is not null and accepted_at is not null))
);
create index approval_notifications_pending_idx on private.approval_notifications(next_attempt_at,created_at)
 where state in ('pending','retry','sending');
create table private.notification_events (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references private.approval_notifications(id),
 attempt integer not null, event text not null check(event in ('queued','claimed','retry','accepted','failed','needs_review','cancelled')),
 created_at timestamptz not null default now()
);
create index notification_events_hour_idx on private.notification_events(created_at) where event='claimed';
alter table private.notification_workers enable row level security;
alter table private.approval_notifications enable row level security;
alter table private.notification_events enable row level security;
revoke all on private.notification_workers,private.approval_notifications,private.notification_events from public,anon,authenticated;
create trigger notification_events_immutable before update or delete on private.notification_events
 for each row execute function private.prevent_mutation();

create function private.queue_approval_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 if new.decision<>'approved' then return new; end if;
 select professional_id into strict recipient from public.verification_requests where id=new.request_id;
 insert into private.approval_notifications(id,request_id,recipient_id) values(new.id,new.request_id,recipient);
 insert into private.notification_events(notification_id,attempt,event) values(new.id,0,'queued');
 return new;
end;$$;
revoke all on function private.queue_approval_notification() from public,anon,authenticated;
create trigger verification_approval_notification after insert on public.verification_decisions
 for each row execute function private.queue_approval_notification();

create function private.can_dispatch_notifications() returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_live_session() and exists(
  select 1 from private.notification_workers w join auth.users u on u.id=w.user_id
  where w.user_id=auth.uid() and w.enabled and (u.banned_until is null or u.banned_until<=now())
 );
$$;
revoke all on function private.can_dispatch_notifications() from public,anon,authenticated;

create function private.claim_approval_notifications(p_from_email text,p_site_origin text,p_limit integer default 3,p_request_id uuid default null,p_allowed_recipient text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item record; claimed private.approval_notifications; capacity integer; result jsonb:='[]'::jsonb;
begin
 if not private.can_dispatch_notifications() then raise exception 'Notification worker required' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 3 or p_from_email is null or length(p_from_email)>254
  or p_from_email !~ '^[^[:space:]<>]+@[^[:space:]<>]+\.[^[:space:]<>]+$'
  or p_site_origin is null or p_site_origin !~ '^https://[a-z0-9.-]+(:[0-9]+)?$'
  or (p_allowed_recipient is not null and (length(p_allowed_recipient)>254 or p_allowed_recipient~'[[:space:]<>]'))
 then raise exception 'Invalid notification configuration' using errcode='22023';end if;
 -- Serialize only the bounded global claim budget, not clinical operations.
 perform pg_advisory_xact_lock(hashtextextended('approval_notification_claim_budget',0));
 with expired as(
  update private.approval_notifications set state='needs_review',lease_id=null,lease_until=null
  where state in ('pending','retry','sending') and (lease_until is null or lease_until<=now())
   and (attempts>=5 or first_attempt_at<=now()-interval '20 hours') returning id,attempts
 ) insert into private.notification_events(notification_id,attempt,event) select id,attempts,'needs_review' from expired;
 with invalid as(
  update private.approval_notifications n set state='cancelled',lease_id=null,lease_until=null
  where n.state in ('pending','retry','sending') and (n.lease_until is null or n.lease_until<=now())
   and (not exists(select 1 from public.professional_profiles p where p.user_id=n.recipient_id and p.role='doctor' and p.verification_status='approved' and p.professional_id is not null)
    or exists(select 1 from auth.users u where u.id=n.recipient_id and (u.banned_until>now() or (n.recipient_email is not null and lower(u.email) is distinct from lower(n.recipient_email)))))
  returning n.id,n.attempts
 ) insert into private.notification_events(notification_id,attempt,event) select id,attempts,'cancelled' from invalid;
 select least(p_limit,greatest(0,10-count(*)::integer)) into capacity from private.notification_events where event='claimed' and created_at>now()-interval '1 hour';
 if capacity=0 then return result;end if;
 for item in
  select n.id,u.email from private.approval_notifications n join auth.users u on u.id=n.recipient_id
  where n.state in ('pending','retry','sending') and n.next_attempt_at<=now() and (n.lease_until is null or n.lease_until<=now())
   and u.email_confirmed_at is not null and u.email is not null and u.email<>'' and (u.banned_until is null or u.banned_until<=now())
   and (p_request_id is null or n.request_id=p_request_id)
   and (p_allowed_recipient is null or lower(u.email)=lower(p_allowed_recipient))
  order by n.created_at,n.id limit capacity for update of n skip locked
 loop
  update private.approval_notifications set state='sending',attempts=attempts+1,
   first_attempt_at=coalesce(first_attempt_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',
   recipient_email=coalesce(recipient_email,item.email),from_email=coalesce(from_email,p_from_email),site_origin=coalesce(site_origin,p_site_origin)
  where id=item.id returning * into claimed;
  insert into private.notification_events(notification_id,attempt,event) values(claimed.id,claimed.attempts,'claimed');
  result:=result||jsonb_build_array(jsonb_build_object('id',claimed.id,'lease_id',claimed.lease_id,'recipient_email',claimed.recipient_email,'from_email',claimed.from_email,'site_origin',claimed.site_origin,'template_version',claimed.template_version));
 end loop;
 return result;
end;$$;

create function private.finish_approval_notification(p_id uuid,p_lease_id uuid,p_result text,p_provider_message_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare item private.approval_notifications; outcome text;
begin
 if not private.can_dispatch_notifications() then raise exception 'Notification worker required' using errcode='42501';end if;
 if p_result is null or p_result not in ('accepted','retry','failed','needs_review') or ((p_result='accepted')<>(p_provider_message_id is not null))
 then raise exception 'Invalid notification outcome' using errcode='22023';end if;
 select * into item from private.approval_notifications where id=p_id for update;
 if not found or item.state<>'sending' or item.lease_id is distinct from p_lease_id
 then raise exception 'Notification lease changed' using errcode='PT409';end if;
 outcome:=case when p_result='retry' and (item.attempts>=5 or item.first_attempt_at<=now()-interval '20 hours') then 'needs_review' else p_result end;
 update private.approval_notifications set state=outcome,lease_id=null,lease_until=null,
  next_attempt_at=case when outcome='retry' then now()+make_interval(mins=>least(120,item.attempts*5)) else next_attempt_at end,
  provider_message_id=case when outcome='accepted' then p_provider_message_id else null end,
  accepted_at=case when outcome='accepted' then now() else null end where id=item.id;
 insert into private.notification_events(notification_id,attempt,event) values(item.id,item.attempts,outcome);
end;$$;

create function private.approval_notification_status(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_review_professionals() then raise exception 'Reviewer permission required' using errcode='42501';end if;
 return (select jsonb_build_object('state',state,'attempts',attempts,'accepted_at',accepted_at) from private.approval_notifications where request_id=p_request_id);
end;$$;

create function public.claim_approval_notifications(p_from_email text,p_site_origin text,p_limit integer default 3,p_request_id uuid default null,p_allowed_recipient text default null) returns jsonb
language sql security invoker set search_path='' as $$select private.claim_approval_notifications(p_from_email,p_site_origin,p_limit,p_request_id,p_allowed_recipient);$$;
create function public.finish_approval_notification(p_id uuid,p_lease_id uuid,p_result text,p_provider_message_id uuid default null) returns void
language sql security invoker set search_path='' as $$select private.finish_approval_notification(p_id,p_lease_id,p_result,p_provider_message_id);$$;
create function public.approval_notification_status(p_request_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.approval_notification_status(p_request_id);$$;
revoke all on function private.claim_approval_notifications(text,text,integer,uuid,text),public.claim_approval_notifications(text,text,integer,uuid,text),
 private.finish_approval_notification(uuid,uuid,text,uuid),public.finish_approval_notification(uuid,uuid,text,uuid),
 private.approval_notification_status(uuid),public.approval_notification_status(uuid) from public,anon,authenticated;
grant execute on function private.claim_approval_notifications(text,text,integer,uuid,text),public.claim_approval_notifications(text,text,integer,uuid,text),
 private.finish_approval_notification(uuid,uuid,text,uuid),public.finish_approval_notification(uuid,uuid,text,uuid),
 private.approval_notification_status(uuid),public.approval_notification_status(uuid) to authenticated;

commit;
