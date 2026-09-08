create table if not exists pairing_codes (
  code text primary key,
  created_at timestamptz not null default now()
);

create table if not exists devices (
  id text primary key,
  pairing_code text not null,
  name text not null,
  model text not null,
  android text not null,
  battery int not null default 0,
  last_seen timestamptz not null default now(),
  processes jsonb not null default '[]'::jsonb
);

create index if not exists devices_code_idx on devices (pairing_code);

create table if not exists device_commands (
  id serial primary key,
  device_id text not null,
  pairing_code text not null,
  action text not null,
  pid int,
  created_at timestamptz not null default now()
);

create index if not exists device_commands_device_idx on device_commands (device_id);
