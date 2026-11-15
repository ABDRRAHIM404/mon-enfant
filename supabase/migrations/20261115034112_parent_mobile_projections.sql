begin;

-- Canonical appointment time comes from the hosted database tzdata, not an older phone's timezone database.
create function private.mobile_local_time(p_time timestamptz) returns text language sql stable set search_path='' as $$
 with value as(select extract(epoch from ((p_time at time zone 'Africa/Casablanca')-(p_time at time zone 'UTC')))::integer offset_seconds)
 select to_char(p_time at time zone 'Africa/Casablanca','DD/MM/YYYY HH24:MI')||' · Casablanca (UTC'||case when offset_seconds>=0 then '+' else '-' end||
 to_char(abs(offset_seconds)/3600,'FM00')||':'||to_char((abs(offset_seconds)%3600)/60,'FM00')||case when abs(offset_seconds)%60<>0 then ':'||to_char(abs(offset_seconds)%60,'FM00') else '' end||')' from value;
$$;
create function private.mobile_appointment(p_data jsonb) returns jsonb language sql stable set search_path='' as $$
 select case when p_data is null or p_data='null'::jsonb then null else p_data||jsonb_build_object(
 'starts_display',private.mobile_local_time((p_data->>'starts_at')::timestamptz),
 'ends_display',private.mobile_local_time((p_data->>'ends_at')::timestamptz),
 'starts_offset_seconds',extract(epoch from (((p_data->>'starts_at')::timestamptz at time zone 'Africa/Casablanca')-((p_data->>'starts_at')::timestamptz at time zone 'UTC')))::integer
 ) end;
$$;
revoke all on function private.mobile_local_time(timestamptz),private.mobile_appointment(jsonb) from public,anon,authenticated;

-- No independent access model: original parent guards and read audits always execute before formatting.
create function private.parent_mobile_view(p_kind text,p_child_id uuid default null,p_page integer default 1,p_from date default null,p_to date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;start_day date;items jsonb;
begin
 perform private.assert_parent_account();
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid mobile page' using errcode='22023';end if;
 if p_kind='home' then
  result:=private.parent_home_summary();
  result:=jsonb_set(result,'{next_appointment}',coalesce(private.mobile_appointment(result->'next_appointment'),'null'::jsonb));
 elsif p_kind='booklet' then
  result:=private.parent_child_booklet(p_child_id,p_page);
  select coalesce(jsonb_agg(private.mobile_appointment(value) order by ord),'[]'::jsonb) into items from jsonb_array_elements(result->'appointments') with ordinality as x(value,ord);
  result:=jsonb_set(result,'{appointments}',items);
 elsif p_kind='calendar' then
  start_day:=coalesce(p_from,(now() at time zone 'Africa/Casablanca')::date);
  result:=private.parent_appointment_calendar(p_child_id,start_day,coalesce(p_to,start_day+29),p_page,'all');
  select coalesce(jsonb_agg(private.mobile_appointment(value) order by ord),'[]'::jsonb) into items from jsonb_array_elements(result->'items') with ordinality as x(value,ord);
  result:=jsonb_set(result,'{items}',items);
 elsif p_kind='vaccine_references' then result:=private.parent_vaccine_items(p_child_id,p_page);
 elsif p_kind='vaccination_history' then result:=private.parent_vaccination_history(p_child_id,p_page);
 else raise exception 'Unknown mobile view' using errcode='22023';end if;
 return result||jsonb_build_object('server_now',now(),'server_day',(now() at time zone 'Africa/Casablanca')::date,'timezone','Africa/Casablanca');
end;$$;
create function public.parent_mobile_view(p_kind text,p_child_id uuid default null,p_page integer default 1,p_from date default null,p_to date default null) returns jsonb
language sql security invoker set search_path='' as $$select private.parent_mobile_view(p_kind,p_child_id,p_page,p_from,p_to);$$;
revoke all on function private.parent_mobile_view(text,uuid,integer,date,date),public.parent_mobile_view(text,uuid,integer,date,date) from public,anon,authenticated;
grant execute on function private.parent_mobile_view(text,uuid,integer,date,date),public.parent_mobile_view(text,uuid,integer,date,date) to authenticated;
commit;
