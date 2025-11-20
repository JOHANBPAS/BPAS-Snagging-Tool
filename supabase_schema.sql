-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Helper to drop policies if they exist (since IF EXISTS is not standard in all postgres versions for CREATE POLICY, we drop first)
-- Also cleaning up legacy/duplicate policies identified in logs

-- PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- Drop legacy/duplicate policies
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Insert own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;

create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check ((select auth.uid()) = id);
create policy "Users can update own profile." on public.profiles for update using ((select auth.uid()) = id);

-- CHECKLIST TEMPLATES
create table if not exists public.checklist_templates (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.checklist_templates enable row level security;

drop policy if exists "Templates are viewable by everyone." on public.checklist_templates;
drop policy if exists "Authenticated users can create templates." on public.checklist_templates;
drop policy if exists "Templates delete own" on public.checklist_templates;
drop policy if exists "Templates manage own" on public.checklist_templates;
drop policy if exists "Templates insert own" on public.checklist_templates;
drop policy if exists "Templates readable" on public.checklist_templates;
drop policy if exists "Templates update own" on public.checklist_templates;

create policy "Templates are viewable by everyone." on public.checklist_templates for select using (true);
create policy "Authenticated users can create templates." on public.checklist_templates for insert with check ((select auth.role()) = 'authenticated');

-- CHECKLIST TEMPLATE FIELDS
create table if not exists public.checklist_template_fields (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references public.checklist_templates(id) on delete cascade not null,
  label text not null,
  type text not null,
  options text[],
  required boolean default false
);
alter table public.checklist_template_fields enable row level security;

drop policy if exists "Template fields are viewable by everyone." on public.checklist_template_fields;
drop policy if exists "Template fields delete own" on public.checklist_template_fields;
drop policy if exists "Template fields manage own" on public.checklist_template_fields;
drop policy if exists "Template fields insert own" on public.checklist_template_fields;
drop policy if exists "Template fields readable" on public.checklist_template_fields;
drop policy if exists "Template fields update own" on public.checklist_template_fields;

create policy "Template fields are viewable by everyone." on public.checklist_template_fields for select using (true);

-- PROJECTS
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  client_name text,
  address text,
  start_date date,
  end_date date,
  status text default 'active',
  plan_image_url text,
  created_by uuid references public.profiles(id),
  checklist_template_id uuid references public.checklist_templates(id),
  created_at timestamptz default now()
);
alter table public.projects enable row level security;

drop policy if exists "Projects are viewable by everyone." on public.projects;
drop policy if exists "Authenticated users can create projects." on public.projects;
drop policy if exists "Users can update their own projects." on public.projects;
drop policy if exists "Project owners manage" on public.projects;
drop policy if exists "Projects delete own" on public.projects;
drop policy if exists "Projects insert own" on public.projects;
drop policy if exists "Projects readable" on public.projects;
drop policy if exists "Projects claim unowned" on public.projects;

create policy "Projects are viewable by everyone." on public.projects for select using (true);
create policy "Authenticated users can create projects." on public.projects for insert with check ((select auth.role()) = 'authenticated');
create policy "Users can update their own projects." on public.projects for update using ((select auth.uid()) = created_by);

-- PROJECT PLANS
create table if not exists public.project_plans (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  url text not null,
  "order" integer default 0,
  created_at timestamptz default now()
);
alter table public.project_plans enable row level security;

drop policy if exists "Plans are viewable by everyone." on public.project_plans;
drop policy if exists "Authenticated users can manage plans." on public.project_plans;
drop policy if exists "Authenticated users can insert plans." on public.project_plans;
drop policy if exists "Authenticated users can update plans." on public.project_plans;
drop policy if exists "Authenticated users can delete plans." on public.project_plans;

create policy "Plans are viewable by everyone." on public.project_plans for select using (true);
-- Split 'manage' into specific actions to avoid overlapping with SELECT
create policy "Authenticated users can insert plans." on public.project_plans for insert with check ((select auth.role()) = 'authenticated');
create policy "Authenticated users can update plans." on public.project_plans for update using ((select auth.role()) = 'authenticated');
create policy "Authenticated users can delete plans." on public.project_plans for delete using ((select auth.role()) = 'authenticated');

-- SNAGS
create table if not exists public.snags (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  location text,
  priority text default 'medium',
  status text default 'open',
  category text,
  due_date date,
  assigned_to uuid references public.profiles(id),
  plan_x float,
  plan_y float,
  plan_page integer,
  plan_id uuid references public.project_plans(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.snags enable row level security;

drop policy if exists "Snags are viewable by everyone." on public.snags;
drop policy if exists "Authenticated users can manage snags." on public.snags;
drop policy if exists "Snags delete own" on public.snags;
drop policy if exists "Snags owned manage" on public.snags;
drop policy if exists "Snags insert own" on public.snags;
drop policy if exists "Snags readable" on public.snags;
drop policy if exists "Snags update own" on public.snags;
drop policy if exists "Authenticated users can insert snags." on public.snags;
drop policy if exists "Authenticated users can update snags." on public.snags;
drop policy if exists "Authenticated users can delete snags." on public.snags;

create policy "Snags are viewable by everyone." on public.snags for select using (true);
-- Split 'manage' into specific actions to avoid overlapping with SELECT
create policy "Authenticated users can insert snags." on public.snags for insert with check ((select auth.role()) = 'authenticated');
create policy "Authenticated users can update snags." on public.snags for update using ((select auth.role()) = 'authenticated');
create policy "Authenticated users can delete snags." on public.snags for delete using ((select auth.role()) = 'authenticated');

-- SNAG PHOTOS
create table if not exists public.snag_photos (
  id uuid default uuid_generate_v4() primary key,
  snag_id uuid references public.snags(id) on delete cascade not null,
  photo_url text not null,
  caption text,
  created_at timestamptz default now()
);
alter table public.snag_photos enable row level security;

drop policy if exists "Snag photos are viewable by everyone." on public.snag_photos;
drop policy if exists "Authenticated users can manage photos." on public.snag_photos;
drop policy if exists "Photos insert" on public.snag_photos;
drop policy if exists "Photos readable" on public.snag_photos;
drop policy if exists "Authenticated users can insert photos." on public.snag_photos;
drop policy if exists "Authenticated users can update photos." on public.snag_photos;
drop policy if exists "Authenticated users can delete photos." on public.snag_photos;

create policy "Snag photos are viewable by everyone." on public.snag_photos for select using (true);
-- Split 'manage' into specific actions to avoid overlapping with SELECT
create policy "Authenticated users can insert photos." on public.snag_photos for insert with check ((select auth.role()) = 'authenticated');
create policy "Authenticated users can update photos." on public.snag_photos for update using ((select auth.role()) = 'authenticated');
create policy "Authenticated users can delete photos." on public.snag_photos for delete using ((select auth.role()) = 'authenticated');

-- SNAG COMMENTS
create table if not exists public.snag_comments (
  id uuid default uuid_generate_v4() primary key,
  snag_id uuid references public.snags(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  comment text not null,
  created_at timestamptz default now()
);
alter table public.snag_comments enable row level security;

drop policy if exists "Comments are viewable by everyone." on public.snag_comments;
drop policy if exists "Authenticated users can add comments." on public.snag_comments;
drop policy if exists "Comments insert" on public.snag_comments;
drop policy if exists "Comments readable" on public.snag_comments;

create policy "Comments are viewable by everyone." on public.snag_comments for select using (true);
create policy "Authenticated users can add comments." on public.snag_comments for insert with check ((select auth.role()) = 'authenticated');

-- PROJECT REPORTS
create table if not exists public.project_reports (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  file_name text not null,
  file_url text not null,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz default now()
);
alter table public.project_reports enable row level security;

drop policy if exists "Reports are viewable by everyone." on public.project_reports;
drop policy if exists "Authenticated users can create reports." on public.project_reports;
drop policy if exists "Reports insert" on public.project_reports;
drop policy if exists "Reports readable" on public.project_reports;

create policy "Reports are viewable by everyone." on public.project_reports for select using (true);
create policy "Authenticated users can create reports." on public.project_reports for insert with check ((select auth.role()) = 'authenticated');

-- STORAGE BUCKETS (Optional - requires storage extension enabled)
-- insert into storage.buckets (id, name) values ('project-plans', 'project-plans') on conflict do nothing;
-- insert into storage.buckets (id, name) values ('snag-photos', 'snag-photos') on conflict do nothing;
-- insert into storage.buckets (id, name) values ('project-reports', 'project-reports') on conflict do nothing;
