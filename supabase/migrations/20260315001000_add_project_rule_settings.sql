alter table projects
  add column if not exists sla_days int,
  add column if not exists max_credits_per_day int,
  add column if not exists work_days jsonb,
  add column if not exists urgency_multiplier decimal;
