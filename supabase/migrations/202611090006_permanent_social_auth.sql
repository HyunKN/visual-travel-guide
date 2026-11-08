-- Keep ownership, request replay, version and rate-limit rules behind a permanent-user gate.
begin;

create function vtg.require_permanent_user() returns void
language plpgsql stable security definer set search_path='' as $$
begin
  -- Supabase anonymous Auth also uses the authenticated role. Missing/malformed claims fail closed.
  if auth.uid() is null or (auth.jwt()->'is_anonymous') is distinct from 'false'::jsonb then
    raise exception 'permanent_login_required' using errcode='42501';
  end if;
end $$;
revoke all on function vtg.require_permanent_user() from public,anon,authenticated;

alter function public.vtg_snapshot() set schema vtg;
alter function vtg.vtg_snapshot() rename to snapshot_base;
alter function public.vtg_markers(text,timestamptz,timestamptz,uuid) set schema vtg;
alter function vtg.vtg_markers(text,timestamptz,timestamptz,uuid) rename to markers_base;
alter function public.vtg_read(text,uuid) set schema vtg;
alter function vtg.vtg_read(text,uuid) rename to read_base;
alter function public.vtg_request_status(uuid) set schema vtg;
alter function vtg.vtg_request_status(uuid) rename to request_status_base;
alter function public.vtg_owner_state(text,uuid) set schema vtg;
alter function vtg.vtg_owner_state(text,uuid) rename to owner_state_base;
alter function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean) set schema vtg;
alter function vtg.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean) rename to write_with_feedback;
alter function public.vtg_report(uuid,text) set schema vtg;
alter function vtg.vtg_report(uuid,text) rename to report_with_feedback;

-- SET SCHEMA preserves ACLs; revoke inherited grants before exposing guarded replacements.
revoke all on function vtg.snapshot_base(),vtg.markers_base(text,timestamptz,timestamptz,uuid),
  vtg.read_base(text,uuid),vtg.request_status_base(uuid),vtg.owner_state_base(text,uuid),
  vtg.write_with_feedback(uuid,uuid,integer,text,double precision,double precision,text,boolean),
  vtg.report_with_feedback(uuid,text) from public,anon,authenticated;

create function public.vtg_snapshot() returns timestamptz
language plpgsql stable security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  return vtg.snapshot_base();
end $$;

create function public.vtg_markers(p_scene text,p_snapshot timestamptz,p_before timestamptz default null,p_id uuid default null)
returns table(id uuid,u double precision,v double precision,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  return query select * from vtg.markers_base(p_scene,p_snapshot,p_before,p_id);
end $$;

create function public.vtg_read(p_scene text,p_id uuid)
returns table(id uuid,u double precision,v double precision,created_at timestamptz,body text,version integer)
language plpgsql stable security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  return query select * from vtg.read_base(p_scene,p_id);
end $$;

create function public.vtg_request_status(p_request uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  return vtg.request_status_base(p_request);
end $$;

create function public.vtg_owner_state(p_scene text,p_id uuid)
returns table(id uuid,scene_id text,u double precision,v double precision,body text,version integer,visible boolean,hidden boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  return query select * from vtg.owner_state_base(p_scene,p_id);
end $$;

create function public.vtg_write(p_request uuid,p_id uuid,p_expected integer,p_scene text,p_u double precision,p_v double precision,p_body text,p_withdraw boolean)
returns integer language plpgsql security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  return vtg.write_with_feedback(p_request,p_id,p_expected,p_scene,p_u,p_v,p_body,p_withdraw);
end $$;

create function public.vtg_report(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  perform vtg.report_with_feedback(p_id,p_reason);
end $$;

revoke all on function public.vtg_snapshot(),public.vtg_markers(text,timestamptz,timestamptz,uuid),
  public.vtg_read(text,uuid),public.vtg_request_status(uuid),public.vtg_owner_state(text,uuid),
  public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean),public.vtg_report(uuid,text)
  from public,anon,authenticated;
grant execute on function public.vtg_snapshot(),public.vtg_markers(text,timestamptz,timestamptz,uuid),
  public.vtg_read(text,uuid),public.vtg_request_status(uuid),public.vtg_owner_state(text,uuid),
  public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean),public.vtg_report(uuid,text)
  to authenticated;

-- This excerpt is the only unauthenticated memo API; short messages may be returned in full.
create or replace function public.vtg_home_preview(p_scenes text[])
returns table(id uuid,scene_id text,u double precision,v double precision,created_at timestamptz,body text)
language sql stable security definer set search_path='' as $$
  select m.id,m.scene_id,m.u,m.v,m.created_at,left(m.body,64)
  from vtg.messages m where m.visible and not m.hidden and m.scene_id=any(p_scenes)
    and cardinality(p_scenes) between 1 and 3
  order by m.created_at desc,m.id desc limit 1
$$;
revoke all on function public.vtg_home_preview(text[]) from public,anon,authenticated;
grant execute on function public.vtg_home_preview(text[]) to anon,authenticated;

-- Preserve the private schema and direct-table boundary as defense in depth.
revoke all on schema vtg from public,anon,authenticated;
revoke all on all tables in schema vtg from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
