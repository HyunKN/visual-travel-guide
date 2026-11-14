-- New writes are limited to 100 Unicode code points. Existing text is not rewritten.
-- Version matches the hosted MCP migration record; CLI was unavailable locally.
begin;
create or replace function public.vtg_write(p_request uuid,p_id uuid,p_expected integer,p_scene text,p_u double precision,p_v double precision,p_body text,p_withdraw boolean)
returns integer language plpgsql security definer set search_path='' as $$
begin
  perform vtg.require_permanent_user();
  -- A previously committed request must remain idempotently recoverable even
  -- when its original body predates the new limit. The base checks its hash.
  if p_withdraw is not true and char_length(p_body)>100 and not exists(
    select 1 from vtg.requests where owner_id=auth.uid() and request_id=p_request
  ) then
    raise exception 'invalid_body';
  end if;
  return vtg.write_with_feedback(p_request,p_id,p_expected,p_scene,p_u,p_v,p_body,p_withdraw);
end $$;
revoke all on function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean) from public,anon,authenticated;
grant execute on function public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
