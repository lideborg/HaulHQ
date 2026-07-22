-- 0013: records the friends.onboarded_at column (applied out-of-band; recorded here for reproducibility).
alter table public.friends add column if not exists onboarded_at timestamptz;
