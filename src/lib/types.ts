export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: 'admin' | 'architect' | 'contractor' | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: 'admin' | 'architect' | 'contractor' | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          name: string;
          client_name: string | null;
          address: string | null;
          start_date: string | null;
          end_date: string | null;
          status: 'active' | 'completed' | 'archived' | null;
          plan_image_url: string | null;
          created_by: string | null;
          checklist_template_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          client_name?: string | null;
          address?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: 'active' | 'completed' | 'archived' | null;
          plan_image_url?: string | null;
          created_by?: string | null;
          checklist_template_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      snags: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          location: string | null;
          priority: 'low' | 'medium' | 'high' | 'critical' | null;
          status: 'open' | 'in_progress' | 'completed' | 'verified' | null;
          category: string | null;
          due_date: string | null;
          assigned_to: string | null;
          plan_x: number | null;
          plan_y: number | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          location?: string | null;
          priority?: 'low' | 'medium' | 'high' | 'critical' | null;
          status?: 'open' | 'in_progress' | 'completed' | 'verified' | null;
          category?: string | null;
          due_date?: string | null;
          assigned_to?: string | null;
          plan_x?: number | null;
          plan_y?: number | null;
          created_by?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['snags']['Insert']>;
      };
      snag_photos: {
        Row: {
          id: string;
          snag_id: string;
          photo_url: string;
          caption: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          snag_id: string;
          photo_url: string;
          caption?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['snag_photos']['Insert']>;
      };
      snag_comments: {
        Row: {
          id: string;
          snag_id: string;
          author_id: string;
          comment: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          snag_id: string;
          author_id: string;
          comment: string;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['snag_comments']['Insert']>;
      };
      checklist_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['checklist_templates']['Insert']>;
      };
      checklist_template_fields: {
        Row: {
          id: string;
          template_id: string;
          label: string;
          type: 'text' | 'number' | 'select' | 'checkbox';
          options: Json | null;
          required: boolean | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          label: string;
          type: 'text' | 'number' | 'select' | 'checkbox';
          options?: Json | null;
          required?: boolean | null;
        };
        Update: Partial<Database['public']['Tables']['checklist_template_fields']['Insert']>;
      };
      project_reports: {
        Row: {
          id: string;
          project_id: string;
          file_name: string;
          file_url: string;
          generated_at: string | null;
          generated_by: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          file_name: string;
          file_url: string;
          generated_at?: string | null;
          generated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['project_reports']['Insert']>;
      };
    };
  };
}
