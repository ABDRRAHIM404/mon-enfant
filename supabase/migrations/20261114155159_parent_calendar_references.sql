begin;

-- Current Auth bans cut off old JWTs even if an Auth session row remains.
create or replace function private.has_live_session() returns boolean
language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and coalesce(auth.jwt()->>'session_id','') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then exists (select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now()))
    else false end;
$$;

create function private.parent_child_header(p_child_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 return (select jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status) from public.children c where c.id=p_child_id);
end;$$;
revoke all on function private.parent_child_header(uuid) from public,anon,authenticated;

create function private.parent_vaccine_items(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total bigint;child jsonb;
begin
 child:=private.parent_child_header(p_child_id);
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid item page' using errcode='22023';end if;
 select count(*) into total from public.child_vaccine_items where child_id=p_child_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('version_status',v.status,'review_verified',v.review_verified,'version_label',v.label,'age',r.age,'source_age',r.source_age,'vaccine_code',r.vaccine_code,'eligibility',r.eligibility,'automatic_scheduling',r.automatic_scheduling,'state',c.state,'revision',c.revision,
  'documented_entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'root_id',e.root_id,'professional_id',e.professional_id,'occurred_on',e.occurred_on)) from public.vaccination_entry_links l join public.clinical_entries e on e.id=l.entry_id where l.item_id=i.id and e.entry_state='active' and not exists(select 1 from public.clinical_entries newer where newer.root_id=e.root_id and newer.revision>e.revision)),'[]'::jsonb)) order by i.created_at,i.id),'[]'::jsonb) into items
 from (select * from public.child_vaccine_items where child_id=p_child_id order by created_at,id limit 20 offset (p_page-1)*20) i
 join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules r on r.version_id=i.version_id and r.dose_code=i.dose_code
 join lateral (select * from public.vaccine_item_changes where item_id=i.id order by revision desc limit 1) c on true;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'guardian_vaccine_references_read','accessed');
 return jsonb_build_object('child',child,'items',items,'total',total,'page',p_page);
end;$$;

create function private.parent_appointment_calendar(p_child_id uuid,p_from date,p_to date,p_page integer default 1,p_state text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;child jsonb;
begin
 child:=private.parent_child_header(p_child_id);
 if p_from is null or p_to is null or p_to<p_from or p_to>p_from+41 or p_page is null or p_page not between 1 and 10000 or p_state is null or p_state not in ('all','scheduled','missed','dose_documented','reference_review','cancelled','completed') then raise exception 'Invalid calendar range or filters' using errcode='22023';end if;
 with rows as materialized(select data from private.appointment_rows(p_child_id,false) r(data) where (data->>'starts_on')::date between p_from and p_to and (p_state='all' or data->>'effective_state'=p_state)),
 days as(select data->>'starts_on' calendar_day,count(*) n from rows group by data->>'starts_on'),
 page as(select data from rows order by (data->>'starts_at')::timestamptz,data->>'id' limit 50 offset (p_page-1)*50)
 select jsonb_build_object('child',child,'items',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz,data->>'id') from page),'[]'::jsonb),'total',(select count(*) from rows),'days',coalesce((select jsonb_agg(jsonb_build_object('day',calendar_day,'count',n) order by calendar_day) from days),'[]'::jsonb),'from',p_from,'to',p_to,'page',p_page,'generated_at',now(),'timezone','Africa/Casablanca') into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'guardian_calendar_read','accessed');
 return result;
end;$$;

create or replace function private.parent_access_history(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;since_at timestamptz;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid access history page' using errcode='22023';end if;
 select created_at into since_at from private.guardian_links where child_id=p_child_id and guardian_id=actor and revoked_at is null and expires_at>now();
 with visible as materialized(
  select a.id,a.occurred_at,a.entity_type,a.action,case when a.actor_id=actor then 'self' when p.role='doctor' and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read','guardian_notifications_read','guardian_calendar_read','guardian_vaccine_references_read']) then 'professional' else 'guardian' end actor_type,
   case when p.role='doctor' and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read','guardian_notifications_read','guardian_calendar_read','guardian_vaccine_references_read']) then p.professional_id else null end professional_id
  from public.audit_events a left join public.professional_profiles p on p.user_id=a.actor_id
  where a.entity_id=p_child_id and a.occurred_at>=since_at and a.entity_type=any(array['child_profile_read','clinical_timeline_read','clinical_history_read','clinical_export','vaccine_items_read','vaccine_item_history_read','vaccine_items_export','vaccination_duplicate_check','patient_appointments_read','appointment_history_read','appointments_export','appointment_calendar_read','appointment_worklist_read','vaccine_followup_read','patient_visit_overview_read','appointment_item_options_read','guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_management_read','parent_correction_requested','parent_correction_responded','parent_requests_read','doctor_parent_requests_read','guardian_access_history_read','child_lookup_read','guardian_notifications_read','guardian_calendar_read','guardian_vaccine_references_read'])
 ),items as(select * from visible order by occurred_at desc,id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.occurred_at desc,i.id) from items i),'[]'::jsonb),'total',(select count(*) from visible),'page',p_page,'since',since_at) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_access_history_read','accessed');
 return result;
end;$$;

create function public.parent_vaccine_items(p_child_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.parent_vaccine_items(p_child_id,p_page);$$;
create function public.parent_appointment_calendar(p_child_id uuid,p_from date,p_to date,p_page integer default 1,p_state text default 'all') returns jsonb language sql security invoker set search_path='' as $$select private.parent_appointment_calendar(p_child_id,p_from,p_to,p_page,p_state);$$;
revoke all on function private.parent_vaccine_items(uuid,integer),public.parent_vaccine_items(uuid,integer),private.parent_appointment_calendar(uuid,date,date,integer,text),public.parent_appointment_calendar(uuid,date,date,integer,text) from public,anon,authenticated;
grant execute on function private.parent_vaccine_items(uuid,integer),public.parent_vaccine_items(uuid,integer),private.parent_appointment_calendar(uuid,date,date,integer,text),public.parent_appointment_calendar(uuid,date,date,integer,text) to authenticated;

commit;
