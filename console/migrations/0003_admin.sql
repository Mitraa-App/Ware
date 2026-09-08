alter table devices add column if not exists info jsonb not null default '{}'::jsonb;
alter table devices add column if not exists apps jsonb not null default '[]'::jsonb;
alter table devices add column if not exists files jsonb not null default '[]'::jsonb;
alter table devices add column if not exists logs text not null default '';
alter table devices add column if not exists shell_out text not null default '';
alter table devices add column if not exists screenshot text not null default '';
alter table devices add column if not exists file_cwd text not null default '/sdcard';
alter table device_commands add column if not exists arg text;
