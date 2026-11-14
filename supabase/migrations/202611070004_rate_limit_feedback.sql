-- Keep the original write/ownership/idempotency rules and add structured retry feedback.
begin;
alter function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean) set schema vtg;
alter function vtg.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean) rename to write_base;
alter function public.vtg_report(uuid,text) set schema vtg;
alter function vtg.vtg_report(uuid,text) rename to report_base;
revoke all on function vtg.write_base(uuid,uuid,integer,text,double precision,double precision,text,boolean),vtg.report_base(uuid,text) from public,anon,authenticated;

create index requests_owner_time on vtg.requests(owner_id,created_at desc);
create index reports_owner_time on vtg.reports(owner_id,created_at desc);
create function vtg.rate_retry_at(p_actor uuid,p_reporting boolean) returns timestamptz
language sql stable set search_path='' as $$
  select case when p_reporting then
    (select created_at+interval '1 hour' from vtg.reports where owner_id=p_actor and created_at>now()-interval '1 hour'
      order by created_at desc offset 9 limit 1)
  else greatest(
    (select created_at+interval '1 minute' from vtg.requests where owner_id=p_actor and created_at>now()-interval '1 minute'
      order by created_at desc offset 4 limit 1),
    (select created_at+interval '1 day' from vtg.requests where owner_id=p_actor and created_at>now()-interval '1 day'
      order by created_at desc offset 49 limit 1)) end
$$;
revoke all on function vtg.rate_retry_at(uuid,boolean) from public,anon,authenticated;

create function public.vtg_write(p_request uuid,p_id uuid,p_expected integer,p_scene text,p_u double precision,p_v double precision,p_body text,p_withdraw boolean)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); retry_at timestamptz;
begin
  -- Hold the owner's lock outside the exception subtransaction, including feedback calculation.
  if actor is not null then perform pg_advisory_xact_lock(hashtextextended(actor::text,0)); end if;
  begin
    return vtg.write_base(p_request,p_id,p_expected,p_scene,p_u,p_v,p_body,p_withdraw);
  exception when raise_exception then
    if sqlerrm<>'rate_limited' then raise; end if;
    retry_at:=vtg.rate_retry_at(actor,false);
    raise exception 'rate_limited' using detail=jsonb_build_object('retryAt',
      to_char((date_trunc('second',retry_at)+interval '1 second') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text;
  end;
end $$;
create function public.vtg_report(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); retry_at timestamptz;
begin
  if actor is not null then perform pg_advisory_xact_lock(hashtextextended(actor::text,0)); end if;
  begin
    perform vtg.report_base(p_id,p_reason);
  exception when raise_exception then
    if sqlerrm<>'rate_limited' then raise; end if;
    retry_at:=vtg.rate_retry_at(actor,true);
    raise exception 'rate_limited' using detail=jsonb_build_object('retryAt',
      to_char((date_trunc('second',retry_at)+interval '1 second') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text;
  end;
end $$;
revoke all on function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean),public.vtg_report(uuid,text) from public,anon,authenticated;
grant execute on function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean),public.vtg_report(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
