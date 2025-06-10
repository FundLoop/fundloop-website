export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      blog_posts: {
        Row: {
          id: number
          title: string
          slug: string
          excerpt: string
          content: string
          author_id: number
          published_at: string | null
          created_at: string | null
          updated_at: string | null
          is_support: boolean | null
          category: string | null
          subtitle: string | null
          picture: string | null
          sort_order_within_category: number | null
        }
        Insert: {
          id?: number
          title: string
          slug: string
          excerpt: string
          content: string
          author_id?: number
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_support?: boolean | null
          category?: string | null
          subtitle?: string | null
          picture?: string | null
          sort_order_within_category?: number | null
        }
        Update: {
          id?: number
          title?: string
          slug?: string
          excerpt?: string
          content?: string
          author_id?: number
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_support?: boolean | null
          category?: string | null
          subtitle?: string | null
          picture?: string | null
          sort_order_within_category?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_network_stats: {
        Row: {
          id: number
          month: number
          year: number
          total_funds: number
          project_count: number
          user_count: number
          avg_salary: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: never
          month: number
          year: number
          total_funds: number
          project_count: number
          user_count: number
          avg_salary: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: never
          month?: number
          year?: number
          total_funds?: number
          project_count?: number
          user_count?: number
          avg_salary?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: number
          name: string
          slug: string
          logo_url: string | null
          description: string | null
          founded: string | null
          website: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          name: string
          logo_url?: string | null
          description?: string | null
          founded?: string | null
          website?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          logo_url?: string | null
          description?: string | null
          founded?: string | null
          website?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_categories: {
        Row: {
          id: number
          project_id: number
          category_id: number
          created_at: string | null
        }
        Insert: {
          id?: number
          project_id: number
          category_id: number
          created_at?: string | null
        }
        Update: {
          id?: number
          project_id?: number
          category_id?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "ref_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stats: {
        Row: {
          id: number
          project_id: number
          user_count: number
          monthly_revenue: number
          pledge_amount: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: never
          project_id: number
          user_count: number
          monthly_revenue: number
          pledge_amount: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: never
          project_id?: number
          user_count?: number
          monthly_revenue?: number
          pledge_amount?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          id: number
          name: string
          slug: string
          description: string
          detailed_description: string | null
          logo_url: string | null
          website: string | null
          organization_id: number | null
          is_public: boolean | null
          created_at: string | null
          payment_percentage: number | null
          payment_periodicity_id: number | null
          payment_custom_days: number | null
          default_payment_method_id: number | null
          category_id: number | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          name: string
          slug: string
          description: string
          detailed_description?: string | null
          logo_url?: string | null
          website?: string | null
          organization_id?: number | null
          is_public?: boolean | null
          created_at?: string | null
          payment_percentage?: number | null
          payment_periodicity_id?: number | null
          payment_custom_days?: number | null
          default_payment_method_id?: number | null
          category_id?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          slug?: string
          description?: string
          detailed_description?: string | null
          logo_url?: string | null
          website?: string | null
          organization_id?: number | null
          is_public?: boolean | null
          created_at?: string | null
          payment_percentage?: number | null
          payment_periodicity_id?: number | null
          payment_custom_days?: number | null
          default_payment_method_id?: number | null
          category_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "ref_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_default_payment_method_id_fkey"
            columns: ["default_payment_method_id"]
            referencedRelation: "ref_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_payment_periodicity_id_fkey"
            columns: ["payment_periodicity_id"]
            referencedRelation: "ref_payment_periodicities"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_categories: {
        Row: {
          id: number
          name: string
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      ref_genders: {
        Row: {
          id: number
          name: string
          display_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          display_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          display_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      ref_interests: {
        Row: {
          id: number
          name: string
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      ref_locations: {
        Row: {
          id: number
          name: string
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      ref_occupations: {
        Row: {
          id: number
          name: string
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      ref_payment_methods: {
        Row: {
          id: number
          name: string
          code: string
          description: string | null
          display_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          code: string
          description?: string | null
          display_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          code?: string
          description?: string | null
          display_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      ref_payment_periodicities: {
        Row: {
          id: number
          name: string
          code: string
          description: string | null
          display_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          code: string
          description?: string | null
          display_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          code?: string
          description?: string | null
          display_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      ref_payment_statuses: {
        Row: {
          id: number
          name: string
          code: string
          description: string | null
          display_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: number
          name: string
          code: string
          description?: string | null
          display_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          code?: string
          description?: string | null
          display_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      user_emails: {
        Row: {
          id: number
          user_id: number
          email: string
          is_primary: boolean
          is_verified: boolean
          is_removed: boolean
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id: number
          email: string
          is_primary: boolean
          is_verified: boolean
          is_removed?: boolean
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          email?: string
          is_primary?: boolean
          is_verified?: boolean
          is_removed?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_emails_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          id: number
          user_id: number
          interest_id: number
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id: number
          interest_id: number
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          interest_id?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            referencedRelation: "ref_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          id: number
          user_id: number
          type: string
          content: Json
          is_read: boolean
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id: number
          type: string
          content: Json
          is_read?: boolean
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          type?: string
          content?: Json
          is_read?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          id: number
          project_id: number
          user_id: string
          joined_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          project_id: number
          user_id: string
          joined_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          project_id?: number
          user_id?: string
          joined_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_project_participation_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_project_participation_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      participant_roles: {
        Row: {
          id: number
          participant_id: number
          role_id: number
          created_at: string
        }
        Insert: {
          id?: number
          participant_id: number
          role_id: number
          created_at?: string
        }
        Update: {
          id?: number
          participant_id?: number
          role_id?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_roles_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_roles_role_id_fkey"
            columns: ["role_id"]
            referencedRelation: "ref_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_roles: {
        Row: {
          id: number
          name: string
          display_order: number | null
        }
        Insert: {
          id?: number
          name: string
          display_order?: number | null
        }
        Update: {
          id?: number
          name?: string
          display_order?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: number
          auth_id: string | null
          cubid_id: string | null
          full_name: string
          email: string
          avatar_url: string | null
          age: string | null
          gender_id: number | null
          location_id: number | null
          occupation_id: number | null
          signup_step: number | null
          signin_count: number | null
          will_contribute: boolean | null
          contribution_details: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          auth_id?: string | null
          cubid_id?: string | null
          full_name: string
          email: string
          avatar_url?: string | null
          age?: string | null
          gender_id?: number | null
          location_id?: number | null
          occupation_id?: number | null
          signup_step?: number | null
          signin_count?: number | null
          will_contribute?: boolean | null
          contribution_details?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          auth_id?: string | null
          cubid_id?: string | null
          full_name?: string
          email?: string
          avatar_url?: string | null
          age?: string | null
          gender_id?: number | null
          location_id?: number | null
          occupation_id?: number | null
          signup_step?: number | null
          signin_count?: number | null
          will_contribute?: boolean | null
          contribution_details?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_gender_id_fkey"
            columns: ["gender_id"]
            referencedRelation: "ref_genders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_location_id_fkey"
            columns: ["location_id"]
            referencedRelation: "ref_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_occupation_id_fkey"
            columns: ["occupation_id"]
            referencedRelation: "ref_occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_accounts: {
        Row: {
          id: number
          user_id: number
          wallet_address: string
          wallet_type: string
          wallet_name: string | null
          is_primary: boolean
          is_removed: boolean
          created_at: string | null
        }
        Insert: {
          id?: number
          user_id: number
          wallet_address: string
          wallet_type: string
          wallet_name?: string | null
          is_primary: boolean
          is_removed?: boolean
          created_at?: string | null
        }
        Update: {
          id?: number
          user_id?: number
          wallet_address?: string
          wallet_type?: string
          wallet_name?: string | null
          is_primary?: boolean
          is_removed?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_accounts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          id: number
          name: string | null
          email: string | null
          subject: string | null
          category: string | null
          message: string | null
          user_id: string | null
          ip_address: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          name?: string | null
          email?: string | null
          subject?: string | null
          category?: string | null
          message?: string | null
          user_id?: string | null
          ip_address?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          name?: string | null
          email?: string | null
          subject?: string | null
          category?: string | null
          message?: string | null
          user_id?: string | null
          ip_address?: string | null
          created_at?: string | null
        }
        Relationships: []
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

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type Insertable<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type Updatable<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
export type Relationships<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Relationships"]
