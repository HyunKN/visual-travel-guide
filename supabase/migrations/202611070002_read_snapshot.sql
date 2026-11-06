begin;
create function public.vtg_snapshot() returns timestamptz
language sql stable security definer set search_path='' as $$select statement_timestamp()$$;
revoke all on function public.vtg_snapshot() from public;
grant execute on function public.vtg_snapshot() to anon,authenticated;
commit;
