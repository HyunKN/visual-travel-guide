begin;
create function public.vtg_home_preview(p_scenes text[])
returns table(id uuid,scene_id text,u double precision,v double precision,created_at timestamptz,body text)
language sql stable security definer set search_path='' as $$
  select m.id,m.scene_id,m.u,m.v,m.created_at,m.body
  from vtg.messages m where m.visible and not m.hidden and m.scene_id=any(p_scenes)
    and cardinality(p_scenes) between 1 and 3
  order by m.created_at desc,m.id desc limit 1
$$;
revoke all on function public.vtg_home_preview(text[]) from public;
grant execute on function public.vtg_home_preview(text[]) to anon,authenticated;
commit;
