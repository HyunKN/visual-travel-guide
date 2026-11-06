-- Management read only: never grants direct table access or accepts an owner ID.
begin;
create or replace function public.vtg_owner_state(p_scene text,p_id uuid)
returns table(id uuid,scene_id text,u double precision,v double precision,body text,version integer,visible boolean,hidden boolean)
language sql stable security definer set search_path='' as $$
  select m.id,m.scene_id,m.u,m.v,m.body,m.version,m.visible,m.hidden
  from vtg.messages m
  where m.id=p_id and m.scene_id=p_scene and m.owner_id=auth.uid()
$$;
revoke all on function public.vtg_owner_state(text,uuid) from public,anon;
grant execute on function public.vtg_owner_state(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
