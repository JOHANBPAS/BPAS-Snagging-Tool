-- BPAS Snagging App schema
-- Profiles (auth users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('admin','architect','contractor')) default 'architect',
  created_at timestamptz default now()
);

-- Checklist templates
create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.checklist_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.checklist_templates(id) on delete cascade,
  label text not null,
  type text check (type in ('text','number','select','checkbox')) not null,
  options jsonb,
  required boolean default false
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  address text,
  start_date date,
  end_date date,
  status text check (status in ('active','completed','archived')) default 'active',
  plan_image_url text,
  project_number text,
  inspection_type text,
  inspection_scope text,
  inspection_description text,
  created_by uuid references public.profiles(id),
  checklist_template_id uuid references public.checklist_templates(id),
  created_at timestamptz default now()
);

-- Snags
create table if not exists public.snags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  location text,
  priority text check (priority in ('low','medium','high','critical')) default 'medium',
  status text check (status in ('open','in_progress','completed','verified')) default 'open',
  category text,
  due_date date,
  assigned_to uuid references public.profiles(id),
  plan_x double precision,
  plan_y double precision,
  plan_page integer default 1,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Photos
create table if not exists public.snag_photos (
  id uuid primary key default gen_random_uuid(),
  snag_id uuid references public.snags(id) on delete cascade,
  photo_url text not null,
  caption text,
  created_at timestamptz default now()
);

-- Comments
create table if not exists public.snag_comments (
  id uuid primary key default gen_random_uuid(),
  snag_id uuid references public.snags(id) on delete cascade,
  author_id uuid references public.profiles(id),
  comment text not null,
  created_at timestamptz default now()
);

-- Security and policies
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.snags enable row level security;
alter table public.snag_photos enable row level security;
alter table public.snag_comments enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_fields enable row level security;

-- Basic policy: authenticated users can see their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Projects: allow owner to manage, others read
create policy "Project owners manage" on public.projects
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Projects claim unowned" on public.projects
  for update using (created_by is null) with check (created_by = auth.uid());
create policy "Projects readable" on public.projects
  for select using (true);

-- Snags: users can view snags for projects they can see; owners manage
create policy "Snags readable" on public.snags
  for select using (exists (select 1 from public.projects p where p.id = snags.project_id));
create policy "Snags owned manage" on public.snags
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- Comments/photos follow project visibility
create policy "Comments readable" on public.snag_comments
  for select using (exists (select 1 from public.snags s where s.id = snag_comments.snag_id));
create policy "Comments insert" on public.snag_comments
  for insert with check (author_id = auth.uid());

create policy "Photos readable" on public.snag_photos
  for select using (exists (select 1 from public.snags s where s.id = snag_photos.snag_id));
create policy "Photos insert" on public.snag_photos
  for insert with check (true);

-- Checklist templates: admin created by owner
create policy "Templates readable" on public.checklist_templates
  for select using (true);
create policy "Templates manage own" on public.checklist_templates
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "Template fields readable" on public.checklist_template_fields
  for select using (true);
create policy "Template fields manage own" on public.checklist_template_fields
  for all using (exists (select 1 from public.checklist_templates t where t.id = template_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.checklist_templates t where t.id = template_id and t.created_by = auth.uid()));
