-- Additional Setup for BPAS Snagging Tool

-- 1. Project Reports Table
create table if not exists public.project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  generated_at timestamptz default now(),
  generated_by uuid references public.profiles(id)
);

-- Enable RLS for project_reports
alter table public.project_reports enable row level security;

-- Policies for project_reports
drop policy if exists "Reports readable" on public.project_reports;
create policy "Reports readable" on public.project_reports
  for select using (exists (select 1 from public.projects p where p.id = project_reports.project_id));

drop policy if exists "Reports insert" on public.project_reports;
create policy "Reports insert" on public.project_reports
  for insert with check (exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid()));

-- 2. Storage Policies
-- Note: Buckets 'plans', 'snag-photos', and 'reports' must be created in the Supabase dashboard first.

-- Plans Bucket
-- Allow public read access to plans (needed for caching/sharing)
drop policy if exists "Public Plans Access" on storage.objects;
create policy "Public Plans Access"
  on storage.objects for select
  using ( bucket_id = 'plans' );

-- Allow authenticated users to upload plans
drop policy if exists "Authenticated Users Upload Plans" on storage.objects;
create policy "Authenticated Users Upload Plans"
  on storage.objects for insert
  with check ( bucket_id = 'plans' and auth.role() = 'authenticated' );

-- Snag Photos Bucket
-- Allow public read access to snag photos
drop policy if exists "Public Snag Photos Access" on storage.objects;
create policy "Public Snag Photos Access"
  on storage.objects for select
  using ( bucket_id = 'snag-photos' );

-- Allow authenticated users to upload snag photos
drop policy if exists "Authenticated Users Upload Snag Photos" on storage.objects;
create policy "Authenticated Users Upload Snag Photos"
  on storage.objects for insert
  with check ( bucket_id = 'snag-photos' and auth.role() = 'authenticated' );

-- Reports Bucket
-- Allow public read access to reports
drop policy if exists "Public Reports Access" on storage.objects;
create policy "Public Reports Access"
  on storage.objects for select
  using ( bucket_id = 'reports' );

-- Allow authenticated users to upload reports
drop policy if exists "Authenticated Users Upload Reports" on storage.objects;
create policy "Authenticated Users Upload Reports"
  on storage.objects for insert
  with check ( bucket_id = 'reports' and auth.role() = 'authenticated' );
