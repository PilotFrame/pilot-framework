create extension if not exists "uuid-ossp";

create table if not exists personas (
  id uuid primary key,
  slug text not null unique,
  spec jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personas_updated_at_idx on personas(updated_at desc);
create index if not exists personas_slug_idx on personas(slug);

create table if not exists workflows (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflows_updated_at_idx on workflows(updated_at desc);
create index if not exists workflows_slug_idx on workflows(slug);

