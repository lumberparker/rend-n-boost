alter table clients
  add column if not exists whatsapp_number text;

alter table clients
  alter column email drop not null;

create index if not exists idx_clients_whatsapp_number on clients(whatsapp_number);
