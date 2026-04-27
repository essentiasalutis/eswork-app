-- ES Work — Schema Supabase
-- Eseguire questo SQL nell'editor SQL di Supabase (Dashboard → SQL Editor → New Query)

create table if not exists clients (
  id            text primary key,
  name          text not null,
  sector        integer not null default 1,
  employees     integer not null default 50,
  contact_name  text,
  contact_email text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists assessments (
  id          text primary key,
  client_id   text not null references clients(id) on delete cascade,
  type        text not null,
  status      text not null default 'active',
  include_pss boolean not null default true,
  share_code  text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists responses (
  id            text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  answers       jsonb not null,
  submitted_at  timestamptz not null default now()
);

-- Disabilita Row Level Security (accesso solo via service key dal server)
alter table clients    disable row level security;
alter table assessments disable row level security;
alter table responses   disable row level security;
