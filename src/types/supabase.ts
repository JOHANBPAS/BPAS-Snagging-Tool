export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    role: string | null
                    created_at: string
                    avatar_url: string | null
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    role?: string | null
                    created_at?: string
                    avatar_url?: string | null
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    role?: string | null
                    created_at?: string
                    avatar_url?: string | null
                }
                Relationships: []
            }
            projects: {
                Row: {
                    id: string
                    name: string
                    client_name: string | null
                    address: string | null
                    start_date: string | null
                    end_date: string | null
                    status: string
                    plan_image_url: string | null
                    created_by: string | null
                    checklist_template_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    client_name?: string | null
                    address?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    status?: string
                    plan_image_url?: string | null
                    created_by?: string | null
                    checklist_template_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    client_name?: string | null
                    address?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    status?: string
                    plan_image_url?: string | null
                    created_by?: string | null
                    checklist_template_id?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "projects_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            project_plans: {
                Row: {
                    id: string
                    project_id: string
                    name: string
                    url: string
                    created_at: string
                    order: number
                }
                Insert: {
                    id?: string
                    project_id: string
                    name: string
                    url: string
                    created_at?: string
                    order?: number
                }
                Update: {
                    id?: string
                    project_id?: string
                    name?: string
                    url?: string
                    created_at?: string
                    order?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "project_plans_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            snags: {
                Row: {
                    id: string
                    project_id: string
                    title: string
                    description: string | null
                    location: string | null
                    priority: string
                    status: string
                    category: string | null
                    due_date: string | null
                    assigned_to: string | null
                    plan_x: number | null
                    plan_y: number | null
                    plan_page: number | null
                    plan_id: string | null
                    created_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    title: string
                    description?: string | null
                    location?: string | null
                    priority?: string
                    status?: string
                    category?: string | null
                    due_date?: string | null
                    assigned_to?: string | null
                    plan_x?: number | null
                    plan_y?: number | null
                    plan_page?: number | null
                    plan_id?: string | null
                    created_by?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    title?: string
                    description?: string | null
                    location?: string | null
                    priority?: string
                    status?: string
                    category?: string | null
                    due_date?: string | null
                    assigned_to?: string | null
                    plan_x?: number | null
                    plan_y?: number | null
                    plan_page?: number | null
                    plan_id?: string | null
                    created_by?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "snags_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "snags_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "snags_assigned_to_fkey"
                        columns: ["assigned_to"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "snags_plan_id_fkey"
                        columns: ["plan_id"]
                        isOneToOne: false
                        referencedRelation: "project_plans"
                        referencedColumns: ["id"]
                    }
                ]
            }
            snag_photos: {
                Row: {
                    id: string
                    snag_id: string
                    photo_url: string
                    caption: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    snag_id: string
                    photo_url: string
                    caption?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    snag_id?: string
                    photo_url?: string
                    caption?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "snag_photos_snag_id_fkey"
                        columns: ["snag_id"]
                        isOneToOne: false
                        referencedRelation: "snags"
                        referencedColumns: ["id"]
                    }
                ]
            }
            snag_comments: {
                Row: {
                    id: string
                    snag_id: string
                    author_id: string
                    comment: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    snag_id: string
                    author_id: string
                    comment: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    snag_id?: string
                    author_id?: string
                    comment?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "snag_comments_snag_id_fkey"
                        columns: ["snag_id"]
                        isOneToOne: false
                        referencedRelation: "snags"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "snag_comments_author_id_fkey"
                        columns: ["author_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            checklist_templates: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    created_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    created_by?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    created_by?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "checklist_templates_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            checklist_template_fields: {
                Row: {
                    id: string
                    template_id: string
                    label: string
                    type: string
                    options: string[] | null
                    required: boolean
                }
                Insert: {
                    id?: string
                    template_id: string
                    label: string
                    type: string
                    options?: string[] | null
                    required?: boolean
                }
                Update: {
                    id?: string
                    template_id?: string
                    label?: string
                    type?: string
                    options?: string[] | null
                    required?: boolean
                }
                Relationships: [
                    {
                        foreignKeyName: "checklist_template_fields_template_id_fkey"
                        columns: ["template_id"]
                        isOneToOne: false
                        referencedRelation: "checklist_templates"
                        referencedColumns: ["id"]
                    }
                ]
            }
            project_reports: {
                Row: {
                    id: string
                    project_id: string
                    file_name: string
                    file_url: string
                    generated_at: string
                    generated_by: string | null
                }
                Insert: {
                    id?: string
                    project_id: string
                    file_name: string
                    file_url: string
                    generated_at?: string
                    generated_by?: string | null
                }
                Update: {
                    id?: string
                    project_id?: string
                    file_name?: string
                    file_url?: string
                    generated_at?: string
                    generated_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "project_reports_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "project_reports_generated_by_fkey"
                        columns: ["generated_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
