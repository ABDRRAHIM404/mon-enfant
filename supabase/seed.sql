-- Synthetic facility only. Never seed production identities or real patient data.
insert into public.facilities(id, name) values
  ('30000000-0000-4000-8000-000000000001', 'Centre de santé fictif — développement')
on conflict (id) do nothing;
-- Multi-professional/child fixtures live in tests/database.test.ts and run in an isolated DB.
-- Create app test users via Supabase Auth, then initialize their unverified profile in /account.
