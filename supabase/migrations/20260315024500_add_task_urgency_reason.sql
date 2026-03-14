alter table tasks
  add column if not exists urgency_reason text;

create policy "Public can view creatives for valid project links"
  on creatives for select
  to anon
  using (
    id in (
      select c.creative_id
      from clients c
      join projects p on p.client_id = c.id
      join public_links pl on pl.project_id = p.id
      where pl.expires_at is null or pl.expires_at > now()
    )
  );
