export type UserRole = 'admin' | 'standard' | 'architect' | 'contractor';

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole;
  created_at?: string;
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  client_name?: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  status?: 'active' | 'completed' | 'archived';
  plan_image_url?: string | null;
  created_by?: string;
  creator?: { full_name: string } | null;
  checklist_template_id?: string | null;
  created_at?: string;
  inspection_type?: string | null;
  inspection_description?: string | null;
  inspection_scope?: string | null;
  project_number?: string | null;
}

export type SnagPriority = 'low' | 'medium' | 'high' | 'critical';
export type SnagStatus = 'open' | 'in_progress' | 'completed' | 'verified';

export interface ProjectPlan {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  order: number;
}

export interface Snag {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  location: string | null;
  priority: SnagPriority;
  status: SnagStatus;
  category: string | null;
  due_date: string | null;
  assigned_to: string | null;
  plan_x: number | null;
  plan_y: number | null;
  plan_page: number | null;
  plan_id: string | null;
  created_by: string | null;
  created_at: string;
  friendly_id?: number; // Global index for display (1, 2, 3...)
}

export interface SnagPhoto {
  id: string;
  snag_id: string;
  photo_url: string;
  caption?: string;
  created_at?: string;
}

export interface SnagComment {
  id: string;
  snag_id: string;
  author_id: string;
  comment: string;
  created_at?: string;
  author?: Profile;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at?: string;
}

export interface ChecklistField {
  id: string;
  template_id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  options?: string[];
  required?: boolean;
}

export interface DashboardStats {
  totalProjects: number;
  totalOpenSnags: number;
  dueThisWeek: number;
  statusBreakdown: Record<SnagStatus, number>;
  contractorBreakdown: Record<string, number>;
}
