create table if not exists experiment_sessions (
  session_id text primary key,
  participant_id text not null,
  study_version text not null,
  client_version text not null,
  data_class text not null check (data_class = 'formal'),
  consent_accepted boolean not null default false,
  cohort text,
  profile jsonb not null default '{}'::jsonb,
  random_seed text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  quality_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists experiment_trials (
  event_id text primary key,
  session_id text not null references experiment_sessions(session_id),
  stimulus_id text not null,
  mode text not null,
  phase text not null check (phase in ('training', 'formal')),
  trial_index integer not null check (trial_index >= 0),
  reaction_time_ms integer check (reaction_time_ms is null or reaction_time_ms >= 0),
  replay_count integer not null default 0 check (replay_count >= 0),
  response_cells jsonb not null default '[]'::jsonb,
  expected_cells_hash text,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists reader_trials (
  event_id text primary key,
  session_id text not null references experiment_sessions(session_id),
  passage_id text not null,
  passage_version text not null,
  passage_index integer not null check (passage_index >= 0),
  played_duration_ms integer check (played_duration_ms is null or played_duration_ms >= 0),
  completed boolean not null,
  pause_count integer not null default 0 check (pause_count >= 0),
  replay_count integer not null default 0 check (replay_count >= 0),
  playback_speed numeric,
  self_reported_understood boolean,
  summary_text text,
  summary_submitted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists upload_receipts (
  batch_id text primary key,
  session_ids jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists experiment_sessions_study_version_idx on experiment_sessions(study_version);
create index if not exists experiment_sessions_data_class_idx on experiment_sessions(data_class);
create index if not exists experiment_trials_session_id_idx on experiment_trials(session_id);
create index if not exists experiment_trials_stimulus_id_idx on experiment_trials(stimulus_id);
create index if not exists reader_trials_session_id_idx on reader_trials(session_id);
create index if not exists reader_trials_passage_id_idx on reader_trials(passage_id);
