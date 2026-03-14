alter table tasks
  add column if not exists credits_counter int,
  add column if not exists creative_notes text,
  add column if not exists client_feedback text,
  add column if not exists delivered_at timestamptz,
  add column if not exists client_reviewed_at timestamptz,
  add column if not exists submitted_by_client boolean default false;

alter table tasks
  drop constraint if exists tasks_status_check;

alter table tasks
  add constraint tasks_status_check
  check (
    status in (
      'pending',
      'counter_proposed',
      'approved',
      'in_progress',
      'delivered',
      'revision_requested',
      'completed',
      'rejected',
      'blocked'
    )
  );

create policy "Public can view valid project links"
  on public_links for select
  to anon
  using (expires_at is null or expires_at > now());

create policy "Public can view clients with valid project links"
  on clients for select
  to anon
  using (
    id in (
      select p.client_id
      from projects p
      join public_links pl on pl.project_id = p.id
      where expires_at is null or expires_at > now()
    )
  );

create policy "Public can create tasks for monthly projects"
  on tasks for insert
  to anon
  with check (
    project_id in (
      select p.id
      from projects p
      join clients c on c.id = p.client_id
      join public_links pl on pl.project_id = p.id
      where c.plan_type = 'monthly'
        and (pl.expires_at is null or pl.expires_at > now())
    )
  );

create policy "Public can update tasks for valid project links"
  on tasks for update
  to anon
  using (
    project_id in (
      select project_id
      from public_links
      where expires_at is null or expires_at > now()
    )
  )
  with check (
    project_id in (
      select project_id
      from public_links
      where expires_at is null or expires_at > now()
    )
  );
