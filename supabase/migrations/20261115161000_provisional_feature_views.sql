-- Dedicated provisional feature reads. Existing writes, quarantine and session guards are unchanged.
begin;
create function private.provisional_section(p_kind text,p_child_id uuid default null,p_page integer default 1,p_query text default '',p_child_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; child private.provisional_children; children jsonb; entries jsonb; children_total integer; total integer;
begin
 profile:=private.assert_provisional_author();
 if p_kind is null or p_kind not in ('all','consultation','prescription','risk','vaccination','appointment','growth') or p_page is null or p_page not between 1 and 10000 or p_child_page is null or p_child_page not between 1 and 10000 or p_query is null or length(p_query)>100 then
  raise exception 'Invalid feature query' using errcode='22023';
 end if;
 select count(*) into children_total from private.provisional_children c where c.owner_id=profile.user_id and (p_query='' or position(lower(p_query) in lower(concat_ws(' ',c.identity->>'given_name',c.identity->>'family_name',c.identity->>'local_reference',c.id::text)))>0);
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into children from (
  select c.* from private.provisional_children c where c.owner_id=profile.user_id and (p_query='' or position(lower(p_query) in lower(concat_ws(' ',c.identity->>'given_name',c.identity->>'family_name',c.identity->>'local_reference',c.id::text)))>0)
  order by c.created_at desc,c.id limit 30 offset (p_child_page-1)*30
 )c;
 if p_child_id is not null then
  select * into child from private.provisional_children where id=p_child_id and owner_id=profile.user_id;
  if not found then raise exception 'Record unavailable' using errcode='42501';end if;
 elsif jsonb_array_length(children)>0 then
  select * into child from private.provisional_children where id=(children->0->>'id')::uuid and owner_id=profile.user_id;
 end if;
 if child.id is not null then
  with latest as (select distinct on(e.root_id) e.* from private.provisional_entries e where e.owner_id=profile.user_id and e.child_id=child.id order by e.root_id,e.revision desc)
  select count(*) into total from latest where p_kind='all' or kind=p_kind;
  with latest as (select distinct on(e.root_id) e.* from private.provisional_entries e where e.owner_id=profile.user_id and e.child_id=child.id order by e.root_id,e.revision desc)
  select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into entries from (select * from latest where p_kind='all' or kind=p_kind order by recorded_at desc,id limit 30 offset (p_page-1)*30)e;
 else total:=0;entries:='[]'::jsonb;end if;
 insert into private.provisional_audit(actor_id,child_id,action) values(profile.user_id,child.id,'section_read');
 return jsonb_build_object('children',children,'children_total',children_total,'selected_child',case when child.id is null then null else to_jsonb(child) end,'entries',entries,'total',total,'page',p_page,'child_page',p_child_page,'kind',p_kind);
end;$$;
create function public.provisional_section(p_kind text,p_child_id uuid default null,p_page integer default 1,p_query text default '',p_child_page integer default 1)
returns jsonb language sql security invoker set search_path='' as $$select private.provisional_section(p_kind,p_child_id,p_page,p_query,p_child_page);$$;
revoke all on function private.provisional_section(text,uuid,integer,text,integer),public.provisional_section(text,uuid,integer,text,integer) from public,anon,authenticated;
grant execute on function private.provisional_section(text,uuid,integer,text,integer),public.provisional_section(text,uuid,integer,text,integer) to authenticated;
comment on function public.provisional_section(text,uuid,integer,text,integer) is 'Current-session author-only provisional children and correctly paginated latest feature revisions; no promotion or shared clinical access.';
commit;
