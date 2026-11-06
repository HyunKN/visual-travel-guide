-- For a dedicated Sprint test project. No client gets access to the base tables.
begin;
create schema vtg;
revoke all on schema vtg from public, anon, authenticated;
create table vtg.scenes(id text primary key);
insert into vtg.scenes values ('geunjeongjeon-front-v1'),('gyotaejeon-front-v1'),('gwanghwamun-front-v1');
create table vtg.messages(
  id uuid primary key, owner_id uuid not null, scene_id text not null references vtg.scenes,
  u double precision not null check(u between 0 and 1), v double precision not null check(v between 0 and 1),
  body text not null check(octet_length(body)<=16384), version integer not null check(version>0),
  visible boolean not null, hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index messages_scene_order on vtg.messages(scene_id,created_at desc,id desc) where visible and not hidden;
create table vtg.requests(owner_id uuid not null,request_id uuid not null,payload_hash bytea not null,result integer not null,
  created_at timestamptz not null default now(),primary key(owner_id,request_id));
create table vtg.reports(owner_id uuid not null,message_id uuid not null references vtg.messages,reason text not null,
  created_at timestamptz not null default now(), primary key(owner_id,message_id));
alter table vtg.scenes enable row level security;
alter table vtg.messages enable row level security;
alter table vtg.requests enable row level security;
alter table vtg.reports enable row level security;
revoke all on all tables in schema vtg from public, anon, authenticated;

create function public.vtg_markers(p_scene text,p_snapshot timestamptz,p_before timestamptz default null,p_id uuid default null)
returns table(id uuid,u double precision,v double precision,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select m.id,m.u,m.v,m.created_at from vtg.messages m where m.scene_id=p_scene and m.visible and not m.hidden
    and m.created_at<=least(p_snapshot,statement_timestamp()) and
    ((p_before is null and p_id is null) or (m.created_at,m.id)<(p_before,p_id))
    order by m.created_at desc,m.id desc limit 61
$$;
create function public.vtg_read(p_scene text,p_id uuid)
returns table(id uuid,u double precision,v double precision,created_at timestamptz,body text,version integer)
language sql stable security definer set search_path='' as $$
  select m.id,m.u,m.v,m.created_at,m.body,m.version from vtg.messages m
    where m.scene_id=p_scene and m.id=p_id and m.visible and not m.hidden
$$;
create function public.vtg_request_status(p_request uuid) returns integer language sql stable security definer set search_path='' as $$
  select r.result from vtg.requests r where r.owner_id=auth.uid() and r.request_id=p_request
$$;
-- expected 0 = first publication; later revisions require the last confirmed server version.
create function public.vtg_write(p_request uuid,p_id uuid,p_expected integer,p_scene text,p_u double precision,p_v double precision,p_body text,p_withdraw boolean)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); fingerprint bytea; prior vtg.requests; old vtg.messages; result_version integer;
begin
  if actor is null or p_request is null or p_id is null or p_expected is null or p_expected<0 or p_withdraw is null then raise exception 'invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  fingerprint:=sha256(convert_to(jsonb_build_array(p_id,p_expected,p_scene,p_u,p_v,p_body,p_withdraw)::text,'UTF8'));
  select * into prior from vtg.requests where owner_id=actor and request_id=p_request;
  if found then
    if prior.payload_hash<>fingerprint then raise exception 'request_conflict'; end if;
    return prior.result;
  end if;
  -- Withdrawal stays available when publishing is rate limited.
  if not p_withdraw and ((select count(*) from vtg.requests where owner_id=actor and created_at>now()-interval '1 minute')>=5
    or (select count(*) from vtg.requests where owner_id=actor and created_at>now()-interval '1 day')>=50) then raise exception 'rate_limited'; end if;
  select * into old from vtg.messages where id=p_id for update;
  if found then
    if old.owner_id<>actor or old.version<>p_expected or old.scene_id is distinct from p_scene then raise exception 'unavailable_or_conflict'; end if;
    if old.hidden and not p_withdraw then raise exception 'unavailable_or_conflict'; end if;
  elsif p_expected<>0 or p_withdraw then raise exception 'unavailable_or_conflict';
  end if;
  result_version:=p_expected+1;
  if p_withdraw then
    if not old.visible then raise exception 'already_withdrawn'; end if;
    update vtg.messages set visible=false,body='',updated_at=now(),version=result_version where id=p_id;
  else
    -- ECMAScript String.trim whitespace (do not trim the persisted text).
    if p_body is null or btrim(p_body,U&'\0009\000a\000b\000c\000d\0020\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff')='' or octet_length(p_body)>16384 then raise exception 'invalid_body'; end if;
    if p_expected=0 then
      insert into vtg.messages(id,owner_id,scene_id,u,v,body,version,visible) values(p_id,actor,p_scene,p_u,p_v,p_body,1,true);
    else
      update vtg.messages set u=p_u,v=p_v,body=p_body,visible=true,version=result_version,updated_at=now() where id=p_id;
    end if;
  end if;
  insert into vtg.requests(owner_id,request_id,payload_hash,result) values(actor,p_request,fingerprint,result_version);
  return result_version;
end $$;
create function public.vtg_report(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or p_reason is null or p_reason not in ('spam','abuse','personal_info','other') then raise exception 'invalid_report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if not exists(select from vtg.messages where id=p_id and visible and not hidden and owner_id<>actor) then raise exception 'unavailable'; end if;
  if exists(select from vtg.reports where owner_id=actor and message_id=p_id) then return; end if;
  if (select count(*) from vtg.reports where owner_id=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'rate_limited'; end if;
  insert into vtg.reports(owner_id,message_id,reason) values(actor,p_id,p_reason);
end $$;
revoke all on function public.vtg_markers(text,timestamptz,timestamptz,uuid),public.vtg_read(text,uuid),public.vtg_request_status(uuid),
  public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean),public.vtg_report(uuid,text) from public,anon,authenticated;
grant execute on function public.vtg_markers(text,timestamptz,timestamptz,uuid),public.vtg_read(text,uuid) to anon,authenticated;
grant execute on function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean),public.vtg_request_status(uuid),public.vtg_report(uuid,text) to authenticated;
commit;
