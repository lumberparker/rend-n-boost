create or replace function public.settle_public_task_approval(task_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_record tasks%rowtype;
  project_record projects%rowtype;
  client_record clients%rowtype;
  charge_amount int;
begin
  select t.*
    into task_record
  from tasks t
  where t.id = task_uuid
    and t.project_id in (
      select project_id
      from public_links
      where expires_at is null or expires_at > now()
    );

  if not found then
    raise exception 'Task is not accessible from a valid public link';
  end if;

  if exists (
    select 1
    from credits_history
    where type = 'task_usage'
      and reference = task_record.id::text
  ) then
    return;
  end if;

  select *
    into project_record
  from projects
  where id = task_record.project_id;

  select *
    into client_record
  from clients
  where id = project_record.client_id;

  charge_amount := coalesce(task_record.credits_approved, task_record.credits_counter, task_record.credits_estimated);

  insert into credits_history (
    client_id,
    project_id,
    type,
    description,
    amount,
    reference
  )
  values (
    client_record.id,
    project_record.id,
    'task_usage',
    'Tarea aprobada por ambas partes: ' || task_record.title,
    -charge_amount,
    task_record.id::text
  );

  update clients
    set credits_available = coalesce(credits_available, 0) - charge_amount
  where id = client_record.id;
end;
$$;

grant execute on function public.settle_public_task_approval(uuid) to anon, authenticated;
