create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2))
    in ('berriesandmango.com', 'rendeboo.com');
$$;

create policy "Super admins can view all creatives"
  on creatives for select
  to authenticated
  using (public.is_super_admin());

create policy "Super admins can update all creatives"
  on creatives for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Super admins can manage all clients"
  on clients for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Super admins can manage all projects"
  on projects for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Super admins can manage all tasks"
  on tasks for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Super admins can manage all credits history"
  on credits_history for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Super admins can manage all public links"
  on public_links for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
