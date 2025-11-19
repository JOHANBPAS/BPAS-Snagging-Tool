-- Optimization Script for BPAS Snagging Tool
-- Run this in the Supabase SQL Editor to fix performance warnings.

-- 1. Optimize Profiles Policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "Insert own profile" on public.profiles;
create policy "Insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update using ((select auth.uid()) = id);

-- 2. Optimize Projects Policies
-- Consolidate "Project owners manage" and "Projects update own" if they exist
drop policy if exists "Project owners manage" on public.projects;
drop policy if exists "Projects update own" on public.projects; -- Drop potential duplicate
create policy "Project owners manage" on public.projects
  for all using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists "Projects claim unowned" on public.projects;
create policy "Projects claim unowned" on public.projects
  for update using (created_by is null) with check (created_by = (select auth.uid()));

-- 3. Optimize Project Reports Policies
-- Fix "auth_rls_initplan" and "multiple_permissive_policies"
drop policy if exists "Reports readable" on public.project_reports;
drop policy if exists "Reports manage own" on public.project_reports; -- Drop duplicate/inefficient policy
drop policy if exists "Reports insert" on public.project_reports;

-- Re-create optimized policies
create policy "Reports readable" on public.project_reports
  for select using (exists (select 1 from public.projects p where p.id = project_reports.project_id));

-- Consolidated insert/manage policy
create policy "Reports insert" on public.project_reports
  for insert with check (
    exists (
      select 1 from public.projects p 
      where p.id = project_id 
      and p.created_by = (select auth.uid())
    )
  );

create policy "Reports delete own" on public.project_reports
  for delete using (generated_by = (select auth.uid()));

-- 4. Optimize Snags Policies (Proactive)
drop policy if exists "Snags owned manage" on public.snags;
create policy "Snags owned manage" on public.snags
  for all using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- 5. Optimize Checklist Templates Policies (Proactive)
drop policy if exists "Templates manage own" on public.checklist_templates;
create policy "Templates manage own" on public.checklist_templates
  for all using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists "Template fields manage own" on public.checklist_template_fields;
create policy "Template fields manage own" on public.checklist_template_fields
  for all using (
    exists (
      select 1 from public.checklist_templates t 
      where t.id = template_id 
      and t.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.checklist_templates t 
      where t.id = template_id 
      and t.created_by = (select auth.uid())
    )
  );
