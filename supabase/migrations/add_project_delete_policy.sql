-- Migration: Add RLS delete policy for archived projects
-- Date: 2025-11-25
-- Description: Allows project owners and admins to delete archived projects

-- Add delete policy for projects
create policy "Project owners and admins can delete archived" on public.projects
  for delete using (
    status = 'archived' AND (
      created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- This policy ensures:
-- 1. Only archived projects can be deleted (status = 'archived')
-- 2. Only the project creator can delete their own projects (created_by = auth.uid())
-- 3. OR admin users can delete any archived project (role = 'admin')

-- Test the policy:
-- 1. Try to delete an active project -> should fail
-- 2. Try to delete another user's archived project as non-admin -> should fail
-- 3. Archive a project you own and delete it -> should succeed
-- 4. As admin, delete any archived project -> should succeed
