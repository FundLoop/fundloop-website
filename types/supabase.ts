export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: number | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: number | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: number | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: number
          category: string | null
          content: string
          created_at: string | null
          excerpt: string
          id: number
          is_support: boolean | null
          picture: string | null
          published_at: string | null
          slug: string
          sort_order_within_category: number | null
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: number
          category?: string | null
          content: string
          created_at?: string | null
          excerpt: string
          id?: number
          is_support?: boolean | null
          picture?: string | null
          published_at?: string | null
          slug: string
          sort_order_within_category?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: number
          category?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string
          id?: number
          is_support?: boolean | null
          picture?: string | null
          published_at?: string | null
          slug?: string
          sort_order_within_category?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_logs: {
        Row: {
          id: string
          note: string | null
          status: string | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          note?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          note?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      debug_log: {
        Row: {
          created_at: string | null
          id: number
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: string | null
        }
        Relationships: []
      }
      invitation_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          max_uses: number | null
          usage_count: number
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          max_uses?: number | null
          usage_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          max_uses?: number | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_invitation_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_network_stats: {
        Row: {
          avg_salary: number
          created_at: string | null
          id: number
          month: number
          project_count: number
          total_funds: number
          updated_at: string | null
          user_count: number
          year: number
        }
        Insert: {
          avg_salary: number
          created_at?: string | null
          id?: never
          month: number
          project_count: number
          total_funds: number
          updated_at?: string | null
          user_count: number
          year: number
        }
        Update: {
          avg_salary?: number
          created_at?: string | null
          id?: never
          month?: number
          project_count?: number
          total_funds?: number
          updated_at?: string | null
          user_count?: number
          year?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: number
          subscribed_at: string | null
        }
        Insert: {
          email: string
          id?: number
          subscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: number
          subscribed_at?: string | null
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: number
          invited_by: string | null
          organization_id: number | null
          role_id: number | null
          status_id: number | null
          token: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: number
          invited_by?: string | null
          organization_id?: number | null
          role_id?: number | null
          status_id?: number | null
          token?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: number
          invited_by?: string | null
          organization_id?: number | null
          role_id?: number | null
          status_id?: number | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ref_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "ref_invitation_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          deleted_at: string | null
          id: number
          joined_at: string | null
          organization_id: number
          role_assigned_by: string | null
          role_id: number
          status:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          id?: number
          joined_at?: string | null
          organization_id: number
          role_assigned_by?: string | null
          role_id?: number
          status?:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Update: {
          deleted_at?: string | null
          id?: number
          joined_at?: string | null
          organization_id?: number
          role_assigned_by?: string | null
          role_id?: number
          status?:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_role_assigned_by_fkey"
            columns: ["role_assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ref_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          founded: string | null
          id: number
          logo_url: string | null
          name: string
          status: Database["public"]["Enums"]["organizations_status"] | null
          updated_at: string | null
          updated_by: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          founded?: string | null
          id?: number
          logo_url?: string | null
          name: string
          status?: Database["public"]["Enums"]["organizations_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          founded?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          status?: Database["public"]["Enums"]["organizations_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      participant_roles: {
        Row: {
          created_at: string
          id: number
          participant_id: number
          role_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          participant_id: number
          role_id: number
        }
        Update: {
          created_at?: string
          id?: number
          participant_id?: number
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "participant_roles_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ref_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          id: number
          is_admin: boolean | null
          is_favorite: boolean | null
          joined_at: string | null
          project_id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: number
          is_admin?: boolean | null
          is_favorite?: boolean | null
          joined_at?: string | null
          project_id: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          id?: number
          is_admin?: boolean | null
          is_favorite?: boolean | null
          joined_at?: string | null
          project_id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_project_participation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_project_participation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      onchain_payment_submissions: {
        Row: {
          amount_decimal: number
          amount_raw: string
          asset_is_native: boolean
          asset_token_address: string | null
          block_number: number | null
          chain_asset_id: number
          chain_id: number
          chain_network_key: string
          confirmation_count: number
          confirmed_at: string | null
          failure_code: string | null
          failure_reason: string | null
          id: number
          intake_abi_version: string
          intake_contract_id: number
          intake_contract_address: string
          intake_treasury_address: string
          last_checked_at: string | null
          matched_log_index: number | null
          metadata: Json | null
          payment_id: number | null
          payment_method_id: number
          period_id: number
          project_id: number
          reconciled_at: string | null
          receipt: Json | null
          status: string
          submitted_at: string
          tx_hash: string
          wallet_address: string
        }
        Insert: {
          amount_decimal: number
          amount_raw: string
          asset_is_native: boolean
          asset_token_address?: string | null
          block_number?: number | null
          chain_asset_id: number
          chain_id: number
          chain_network_key: string
          confirmation_count?: number
          confirmed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: number
          intake_abi_version: string
          intake_contract_id: number
          intake_contract_address: string
          intake_treasury_address: string
          last_checked_at?: string | null
          matched_log_index?: number | null
          metadata?: Json | null
          payment_id?: number | null
          payment_method_id: number
          period_id: number
          project_id: number
          reconciled_at?: string | null
          receipt?: Json | null
          status?: string
          submitted_at?: string
          tx_hash: string
          wallet_address: string
        }
        Update: {
          amount_decimal?: number
          amount_raw?: string
          asset_is_native?: boolean
          asset_token_address?: string | null
          block_number?: number | null
          chain_asset_id?: number
          chain_id?: number
          chain_network_key?: string
          confirmation_count?: number
          confirmed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: number
          intake_abi_version?: string
          intake_contract_id?: number
          intake_contract_address?: string
          intake_treasury_address?: string
          last_checked_at?: string | null
          matched_log_index?: number | null
          metadata?: Json | null
          payment_id?: number | null
          payment_method_id?: number
          period_id?: number
          project_id?: number
          reconciled_at?: string | null
          receipt?: Json | null
          status?: string
          submitted_at?: string
          tx_hash?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "onchain_payment_submissions_chain_asset_id_fkey"
            columns: ["chain_asset_id"]
            isOneToOne: false
            referencedRelation: "ref_chain_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onchain_payment_submissions_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onchain_payment_submissions_intake_contract_id_fkey"
            columns: ["intake_contract_id"]
            isOneToOne: false
            referencedRelation: "chain_intake_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onchain_payment_submissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onchain_payment_submissions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onchain_payment_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          chain_asset_id: number | null
          chain_id: number | null
          collection_mode: Database["public"]["Enums"]["payment_collection_mode"]
          created_at: string | null
          details: Json | null
          id: number
          intake_contract_id: number | null
          is_default: boolean | null
          is_enabled: boolean
          label: string | null
          method_id: number | null
          project_id: number | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chain_asset_id?: number | null
          chain_id?: number | null
          collection_mode?: Database["public"]["Enums"]["payment_collection_mode"]
          created_at?: string | null
          details?: Json | null
          id?: number
          intake_contract_id?: number | null
          is_default?: boolean | null
          is_enabled?: boolean
          label?: string | null
          method_id?: number | null
          project_id?: number | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chain_asset_id?: number | null
          chain_id?: number | null
          collection_mode?: Database["public"]["Enums"]["payment_collection_mode"]
          created_at?: string | null
          details?: Json | null
          id?: number
          intake_contract_id?: number | null
          is_default?: boolean | null
          is_enabled?: boolean
          label?: string | null
          method_id?: number | null
          project_id?: number | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_chain_asset_id_fkey"
            columns: ["chain_asset_id"]
            isOneToOne: false
            referencedRelation: "ref_chain_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_intake_contract_id_fkey"
            columns: ["intake_contract_id"]
            isOneToOne: false
            referencedRelation: "chain_intake_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "ref_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          id: number
          notes: string | null
          paid_at: string | null
          payment_amount: number
          payment_method_id: number | null
          payment_percentage: number
          period_end: string
          period_start: string
          project_id: number | null
          revenue: number
          status: Database["public"]["Enums"]["payments_status"] | null
          status_id: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          notes?: string | null
          paid_at?: string | null
          payment_amount: number
          payment_method_id?: number | null
          payment_percentage: number
          period_end: string
          period_start: string
          project_id?: number | null
          revenue: number
          status?: Database["public"]["Enums"]["payments_status"] | null
          status_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          notes?: string | null
          paid_at?: string | null
          payment_amount?: number
          payment_method_id?: number | null
          payment_percentage?: number
          period_end?: string
          period_start?: string
          project_id?: number | null
          revenue?: number
          status?: Database["public"]["Enums"]["payments_status"] | null
          status_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "ref_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "ref_payment_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_flow_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          attempt_id: string
          chain_asset_id: number | null
          chain_id: number | null
          created_at: string
          environment: string
          error_code: string | null
          error_message: string | null
          flow: string
          id: number
          intake_contract_id: number | null
          metadata: Json
          outcome: string
          payment_id: number | null
          payment_method_id: number | null
          project_id: number | null
          severity: string
          stage: string
          submission_id: number | null
          tx_hash: string | null
          wallet_address: string | null
        }
        Insert: {
          actor_role?: string
          actor_user_id?: string | null
          attempt_id: string
          chain_asset_id?: number | null
          chain_id?: number | null
          created_at?: string
          environment: string
          error_code?: string | null
          error_message?: string | null
          flow: string
          id?: number
          intake_contract_id?: number | null
          metadata?: Json
          outcome: string
          payment_id?: number | null
          payment_method_id?: number | null
          project_id?: number | null
          severity?: string
          stage: string
          submission_id?: number | null
          tx_hash?: string | null
          wallet_address?: string | null
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          attempt_id?: string
          chain_asset_id?: number | null
          chain_id?: number | null
          created_at?: string
          environment?: string
          error_code?: string | null
          error_message?: string | null
          flow?: string
          id?: number
          intake_contract_id?: number | null
          metadata?: Json
          outcome?: string
          payment_id?: number | null
          payment_method_id?: number | null
          project_id?: number | null
          severity?: string
          stage?: string
          submission_id?: number | null
          tx_hash?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_flow_events_chain_asset_id_fkey"
            columns: ["chain_asset_id"]
            isOneToOne: false
            referencedRelation: "ref_chain_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_flow_events_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_flow_events_intake_contract_id_fkey"
            columns: ["intake_contract_id"]
            isOneToOne: false
            referencedRelation: "chain_intake_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_flow_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_flow_events_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_flow_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_flow_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "onchain_payment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_categories: {
        Row: {
          category_id: number
          project_id: number
        }
        Insert: {
          category_id: number
          project_id: number
        }
        Update: {
          category_id?: number
          project_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ref_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stats_monthly: {
        Row: {
          actual_percentage: number | null
          contributed_amount: number
          created_at: string | null
          id: number
          month: number | null
          monthly_revenue: number
          pledged_percentage: number | null
          project_id: number
          unique_user_count: number | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          actual_percentage?: number | null
          contributed_amount: number
          created_at?: string | null
          id?: number
          month?: number | null
          monthly_revenue: number
          pledged_percentage?: number | null
          project_id: number
          unique_user_count?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          actual_percentage?: number | null
          contributed_amount?: number
          created_at?: string | null
          id?: number
          month?: number | null
          monthly_revenue?: number
          pledged_percentage?: number | null
          project_id?: number
          unique_user_count?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stats_monthly_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stats_yearly: {
        Row: {
          actual_percentage: number | null
          contributed_amount: number
          created_at: string | null
          id: number
          pledged_percentage: number | null
          project_id: number
          unique_user_count: number | null
          updated_at: string | null
          updated_by: number | null
          year: number | null
          yearly_revenue: number
        }
        Insert: {
          actual_percentage?: number | null
          contributed_amount: number
          created_at?: string | null
          id?: number
          pledged_percentage?: number | null
          project_id: number
          unique_user_count?: number | null
          updated_at?: string | null
          updated_by?: number | null
          year?: number | null
          yearly_revenue: number
        }
        Update: {
          actual_percentage?: number | null
          contributed_amount?: number
          created_at?: string | null
          id?: number
          pledged_percentage?: number | null
          project_id?: number
          unique_user_count?: number | null
          updated_at?: string | null
          updated_by?: number | null
          year?: number | null
          yearly_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_stats_yearly_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_users: {
        Row: {
          created_at: string
          id: number
          is_favourite: boolean | null
          project_id: number
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_favourite?: boolean | null
          project_id: number
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          is_favourite?: boolean | null
          project_id?: number
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_onboarding_drafts: {
        Row: {
          completed_at: string | null
          current_screen: string
          id: number
          payload: Json
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_screen: string
          id?: number
          payload?: Json
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_screen?: string
          id?: number
          payload?: Json
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_onboarding_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      projects: {
        Row: {
          billing_email: string | null
          billing_frequency: string | null
          category_id: number | null
          created_at: string | null
          cumulative_donated: number | null
          cumulative_revenue: number | null
          default_payment_method_id: number | null
          deleted_at: string | null
          description: string
          detailed_description: string | null
          email: string | null
          id: number
          is_public: boolean | null
          logo_url: string | null
          name: string
          organization_id: number | null
          payment_custom_days: number | null
          payment_percentage: number | null
          payment_periodicity_id: number | null
          percent_revenue_donated: number | null
          slug: string | null
          status: Database["public"]["Enums"]["projects_status"] | null
          updated_at: string | null
          updated_by: string | null
          website: string | null
        }
        Insert: {
          billing_email?: string | null
          billing_frequency?: string | null
          category_id?: number | null
          created_at?: string | null
          cumulative_donated?: number | null
          cumulative_revenue?: number | null
          default_payment_method_id?: number | null
          deleted_at?: string | null
          description: string
          detailed_description?: string | null
          email?: string | null
          id?: number
          is_public?: boolean | null
          logo_url?: string | null
          name: string
          organization_id?: number | null
          payment_custom_days?: number | null
          payment_percentage?: number | null
          payment_periodicity_id?: number | null
          percent_revenue_donated?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["projects_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          billing_email?: string | null
          billing_frequency?: string | null
          category_id?: number | null
          created_at?: string | null
          cumulative_donated?: number | null
          cumulative_revenue?: number | null
          default_payment_method_id?: number | null
          deleted_at?: string | null
          description?: string
          detailed_description?: string | null
          email?: string | null
          id?: number
          is_public?: boolean | null
          logo_url?: string | null
          name?: string
          organization_id?: number | null
          payment_custom_days?: number | null
          payment_percentage?: number | null
          payment_periodicity_id?: number | null
          percent_revenue_donated?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["projects_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_default_payment_method_id_fkey"
            columns: ["default_payment_method_id"]
            isOneToOne: false
            referencedRelation: "ref_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_payment_periodicity_id_fkey"
            columns: ["payment_periodicity_id"]
            isOneToOne: false
            referencedRelation: "ref_payment_periodicities"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
          parent_category: string | null
          updated_at: string | null
          updated_by: number | null
          usage_count: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          parent_category?: string | null
          updated_at?: string | null
          updated_by?: number | null
          usage_count?: number
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          parent_category?: string | null
          updated_at?: string | null
          updated_by?: number | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ref_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_intake_contracts: {
        Row: {
          abi_version: string
          chain_id: number
          collection_mode: Database["public"]["Enums"]["payment_collection_mode"]
          contract_address: string
          created_at: string
          id: number
          is_active: boolean
          treasury_address: string
          updated_at: string
        }
        Insert: {
          abi_version?: string
          chain_id: number
          collection_mode?: Database["public"]["Enums"]["payment_collection_mode"]
          contract_address: string
          created_at?: string
          id?: number
          is_active?: boolean
          treasury_address: string
          updated_at?: string
        }
        Update: {
          abi_version?: string
          chain_id?: number
          collection_mode?: Database["public"]["Enums"]["payment_collection_mode"]
          contract_address?: string
          created_at?: string
          id?: number
          is_active?: boolean
          treasury_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_intake_contracts_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_chain_assets: {
        Row: {
          asset_key: string
          chain_id: number
          created_at: string
          decimals: number
          id: number
          is_active: boolean
          is_native: boolean
          is_stablecoin: boolean
          name: string
          sort_order: number
          symbol: string
          token_address: string | null
        }
        Insert: {
          asset_key: string
          chain_id: number
          created_at?: string
          decimals: number
          id?: number
          is_active?: boolean
          is_native?: boolean
          is_stablecoin?: boolean
          name: string
          sort_order?: number
          symbol: string
          token_address?: string | null
        }
        Update: {
          asset_key?: string
          chain_id?: number
          created_at?: string
          decimals?: number
          id?: number
          is_active?: boolean
          is_native?: boolean
          is_stablecoin?: boolean
          name?: string
          sort_order?: number
          symbol?: string
          token_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_chain_assets_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_chains: {
        Row: {
          chain_id: string | null
          created_at: string
          description: string | null
          display_name: string
          ecosystem: string
          evm_chain_id: number
          id: number
          is_active: boolean
          layer_type: string
          native_asset_symbol: string
          network_key: string
        }
        Insert: {
          chain_id?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          ecosystem: string
          evm_chain_id: number
          id?: number
          is_active?: boolean
          layer_type: string
          native_asset_symbol: string
          network_key: string
        }
        Update: {
          chain_id?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          ecosystem?: string
          evm_chain_id?: number
          id?: number
          is_active?: boolean
          layer_type?: string
          native_asset_symbol?: string
          network_key?: string
        }
        Relationships: []
      }
      ref_genders: {
        Row: {
          display_order: number
          id: number
          name: string
        }
        Insert: {
          display_order?: number
          id?: number
          name: string
        }
        Update: {
          display_order?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_interests: {
        Row: {
          category: string | null
          created_at: string | null
          id: number
          name: string
          usage_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: number
          name: string
          usage_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: number
          name?: string
          usage_count?: number
        }
        Relationships: []
      }
      ref_invitation_statuses: {
        Row: {
          code: string
          description: string | null
          display_order: number
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number
          id?: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_locations: {
        Row: {
          country: string | null
          created_at: string | null
          id: number
          name: string
          region: string | null
          usage_count: number
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: number
          name: string
          region?: string | null
          usage_count?: number
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: number
          name?: string
          region?: string | null
          usage_count?: number
        }
        Relationships: []
      }
      ref_notification_types: {
        Row: {
          code: string
          description: string | null
          display_order: number
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number
          id?: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_occupations: {
        Row: {
          category: string | null
          created_at: string | null
          id: number
          name: string
          usage_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: number
          name: string
          usage_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: number
          name?: string
          usage_count?: number
        }
        Relationships: []
      }
      ref_payment_methods: {
        Row: {
          code: string
          description: string | null
          display_order: number
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number
          id?: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_payment_periodicities: {
        Row: {
          code: string
          description: string | null
          display_order: number
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number
          id?: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_payment_statuses: {
        Row: {
          code: string
          description: string | null
          display_order: number
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number
          id?: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_roles: {
        Row: {
          display_order: number | null
          id: number
          name: string
        }
        Insert: {
          display_order?: number | null
          id?: number
          name: string
        }
        Update: {
          display_order?: number | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      ref_skills: {
        Row: {
          category: string | null
          created_at: string | null
          id: number
          name: string
          usage_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: number
          name: string
          usage_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: number
          name?: string
          usage_count?: number
        }
        Relationships: []
      }
      ref_social_platforms: {
        Row: {
          code: string
          description: string | null
          display_order: number
          id: number
          is_selectable: boolean
          name: string
          usage_count: number
        }
        Insert: {
          code: string
          description?: string | null
          display_order?: number
          id?: number
          is_selectable?: boolean
          name: string
          usage_count?: number
        }
        Update: {
          code?: string
          description?: string | null
          display_order?: number
          id?: number
          is_selectable?: boolean
          name?: string
          usage_count?: number
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          category: string
          email: string
          id: number
          ip_address: string | null
          message: string
          name: string
          subject: string
          user_id: string | null
        }
        Insert: {
          category: string
          email: string
          id?: number
          ip_address?: string | null
          message: string
          name: string
          subject: string
          user_id?: string | null
        }
        Update: {
          category?: string
          email?: string
          id?: number
          ip_address?: string | null
          message?: string
          name?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_roles: {
        Row: {
          created_at: string | null
          description: string
          id: number
          location: string | null
          required_skills: string[] | null
          tags: string[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: number
          location?: string | null
          required_skills?: string[] | null
          tags?: string[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: number
          location?: string | null
          required_skills?: string[] | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      user_onboarding_drafts: {
        Row: {
          completed_at: string | null
          current_screen: string
          id: number
          payload: Json
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_screen: string
          id?: number
          payload?: Json
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_screen?: string
          id?: number
          payload?: Json
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cubid_identity_snapshots: {
        Row: {
          available_stamp_types: string[]
          cubid_score: number | null
          cubid_user_id: string
          last_sync_error_code: string | null
          last_sync_error_message: string | null
          last_synced_at: string | null
          primary_email: string | null
          primary_name: string | null
          primary_phone: string | null
          raw_identity: Json
          raw_stamps: Json
          user_id: string
          verified_stamp_types: string[]
        }
        Insert: {
          available_stamp_types?: string[]
          cubid_score?: number | null
          cubid_user_id: string
          last_sync_error_code?: string | null
          last_sync_error_message?: string | null
          last_synced_at?: string | null
          primary_email?: string | null
          primary_name?: string | null
          primary_phone?: string | null
          raw_identity?: Json
          raw_stamps?: Json
          user_id: string
          verified_stamp_types?: string[]
        }
        Update: {
          available_stamp_types?: string[]
          cubid_score?: number | null
          cubid_user_id?: string
          last_sync_error_code?: string | null
          last_sync_error_message?: string | null
          last_synced_at?: string | null
          primary_email?: string | null
          primary_name?: string | null
          primary_phone?: string | null
          raw_identity?: Json
          raw_stamps?: Json
          user_id?: string
          verified_stamp_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cubid_identity_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string | null
          interest_id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          interest_id: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          interest_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "ref_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          content: Json
          created_at: string | null
          id: number
          is_read: boolean | null
          read_at: string | null
          type_id: number | null
          user_id: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          read_at?: string | null
          type_id?: number | null
          user_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          read_at?: string | null
          type_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "ref_notification_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_skills: {
        Row: {
          skill_id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          skill_id: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          skill_id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contribution_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "ref_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      user_social_platforms: {
        Row: {
          created_at: string | null
          handle: string
          id: number
          is_primary: boolean
          is_verified: boolean
          profile_url: string | null
          social_platform_id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          handle: string
          id?: number
          is_primary?: boolean
          is_verified?: boolean
          profile_url?: string | null
          social_platform_id: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          handle?: string
          id?: number
          is_primary?: boolean
          is_verified?: boolean
          profile_url?: string | null
          social_platform_id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_social_platforms_platform"
            columns: ["social_platform_id"]
            isOneToOne: false
            referencedRelation: "ref_social_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_social_platforms_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          age: string | null
          avatar_url: string | null
          bio: string | null
          birth_year: number | null
          birthdate: string | null
          contribution_details: string | null
          created_at: string | null
          cubid_id: string | null
          cubid_identity_status: Database["public"]["Enums"]["cubid_identity_status"]
          cubid_score: number | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gender_id: number | null
          id: number
          invited_by_code: string | null
          is_birthday_public: boolean
          is_birthyear_public: boolean
          is_gender_public: boolean
          is_location_public: boolean
          is_name_public: boolean
          is_occupation_public: boolean
          is_pfp_public: boolean
          is_public: boolean | null
          lifetime_sweat_equity: number | null
          location_id: number | null
          occupation_id: number | null
          primary_email_identity: string | null
          profile_headline: string | null
          status: Database["public"]["Enums"]["users_status"] | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
          will_contribute: boolean | null
        }
        Insert: {
          age?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_year?: number | null
          birthdate?: string | null
          contribution_details?: string | null
          created_at?: string | null
          cubid_id?: string | null
          cubid_identity_status?: Database["public"]["Enums"]["cubid_identity_status"]
          cubid_score?: number | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender_id?: number | null
          id?: number
          invited_by_code?: string | null
          is_birthday_public?: boolean
          is_birthyear_public?: boolean
          is_gender_public?: boolean
          is_location_public?: boolean
          is_name_public?: boolean
          is_occupation_public?: boolean
          is_pfp_public?: boolean
          is_public?: boolean | null
          lifetime_sweat_equity?: number | null
          location_id?: number | null
          occupation_id?: number | null
          primary_email_identity?: string | null
          profile_headline?: string | null
          status?: Database["public"]["Enums"]["users_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          will_contribute?: boolean | null
        }
        Update: {
          age?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_year?: number | null
          birthdate?: string | null
          contribution_details?: string | null
          created_at?: string | null
          cubid_id?: string | null
          cubid_identity_status?: Database["public"]["Enums"]["cubid_identity_status"]
          cubid_score?: number | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gender_id?: number | null
          id?: number
          invited_by_code?: string | null
          is_birthday_public?: boolean
          is_birthyear_public?: boolean
          is_gender_public?: boolean
          is_location_public?: boolean
          is_name_public?: boolean
          is_occupation_public?: boolean
          is_pfp_public?: boolean
          is_public?: boolean | null
          lifetime_sweat_equity?: number | null
          location_id?: number | null
          occupation_id?: number | null
          primary_email_identity?: string | null
          profile_headline?: string | null
          status?: Database["public"]["Enums"]["users_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          will_contribute?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invited_by_code"
            columns: ["invited_by_code"]
            isOneToOne: false
            referencedRelation: "invitation_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "users_gender_id_fkey"
            columns: ["gender_id"]
            isOneToOne: false
            referencedRelation: "ref_genders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "ref_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ref_occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_accounts: {
        Row: {
          chain_id: number | null
          created_at: string | null
          deleted_at: string | null
          id: number
          is_for_project: boolean | null
          is_primary: boolean | null
          is_removed: boolean | null
          is_verified: boolean | null
          project_id: number | null
          status: Database["public"]["Enums"]["wallet_accounts_status"] | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          wallet_address: string
          wallet_name: string | null
          wallet_type: string
        }
        Insert: {
          chain_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_for_project?: boolean | null
          is_primary?: boolean | null
          is_removed?: boolean | null
          is_verified?: boolean | null
          project_id?: number | null
          status?: Database["public"]["Enums"]["wallet_accounts_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          wallet_address: string
          wallet_name?: string | null
          wallet_type?: string
        }
        Update: {
          chain_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          is_for_project?: boolean | null
          is_primary?: boolean | null
          is_removed?: boolean | null
          is_verified?: boolean | null
          project_id?: number | null
          status?: Database["public"]["Enums"]["wallet_accounts_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          wallet_address?: string
          wallet_name?: string | null
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_accounts_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_accounts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_connections: {
        Row: {
          account_id: number
          chain_id: number | null
          connected_at: string | null
          deleted_at: string | null
          gas_balance: number | null
          id: number
          status:
            | Database["public"]["Enums"]["wallet_connections_status"]
            | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          account_id: number
          chain_id?: number | null
          connected_at?: string | null
          deleted_at?: string | null
          gas_balance?: number | null
          id?: number
          status?:
            | Database["public"]["Enums"]["wallet_connections_status"]
            | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: number
          chain_id?: number | null
          connected_at?: string | null
          deleted_at?: string | null
          gas_balance?: number | null
          id?: number
          status?:
            | Database["public"]["Enums"]["wallet_connections_status"]
            | null
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_connections_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ref_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_connections_wallet_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_dataset_issues: {
        Row: {
          code: string
          created_at: string
          dataset_id: number
          field_name: string | null
          id: number
          message: string
          metadata: Json | null
          row_number: number | null
          severity: Database["public"]["Enums"]["zkas_issue_severity"]
        }
        Insert: {
          code: string
          created_at?: string
          dataset_id: number
          field_name?: string | null
          id?: number
          message: string
          metadata?: Json | null
          row_number?: number | null
          severity: Database["public"]["Enums"]["zkas_issue_severity"]
        }
        Update: {
          code?: string
          created_at?: string
          dataset_id?: number
          field_name?: string | null
          id?: number
          message?: string
          metadata?: Json | null
          row_number?: number | null
          severity?: Database["public"]["Enums"]["zkas_issue_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "zkas_dataset_issues_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "zkas_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_datasets: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          file_hash: string
          file_name: string
          format: string
          id: number
          month: string
          note: string | null
          object_path: string
          project_id: number
          replaced_by_dataset_id: number | null
          row_count: number
          schema_version: string
          status: Database["public"]["Enums"]["zkas_dataset_status"]
          updated_at: string
          uploaded_by_user_id: string | null
          validation_summary: Json | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          file_hash: string
          file_name: string
          format: string
          id?: number
          month: string
          note?: string | null
          object_path: string
          project_id: number
          replaced_by_dataset_id?: number | null
          row_count?: number
          schema_version?: string
          status?: Database["public"]["Enums"]["zkas_dataset_status"]
          updated_at?: string
          uploaded_by_user_id?: string | null
          validation_summary?: Json | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          file_hash?: string
          file_name?: string
          format?: string
          id?: number
          month?: string
          note?: string | null
          object_path?: string
          project_id?: number
          replaced_by_dataset_id?: number | null
          row_count?: number
          schema_version?: string
          status?: Database["public"]["Enums"]["zkas_dataset_status"]
          updated_at?: string
          uploaded_by_user_id?: string | null
          validation_summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "zkas_datasets_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "zkas_datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_datasets_replaced_by_dataset_id_fkey"
            columns: ["replaced_by_dataset_id"]
            isOneToOne: false
            referencedRelation: "zkas_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_datasets_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      zkas_identity_artifacts: {
        Row: {
          artifact_hash: string
          created_at: string
          file_name: string
          id: number
          month: string
          note: string | null
          object_path: string
          provider: string
          schema_version: string
          status: string
          updated_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          artifact_hash: string
          created_at?: string
          file_name: string
          id?: number
          month: string
          note?: string | null
          object_path: string
          provider?: string
          schema_version?: string
          status?: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          artifact_hash?: string
          created_at?: string
          file_name?: string
          id?: number
          month?: string
          note?: string | null
          object_path?: string
          provider?: string
          schema_version?: string
          status?: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zkas_identity_artifacts_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      zkas_published_user_results: {
        Row: {
          aggregate_score: number
          allocation_usd: number
          created_at: string
          id: number
          notification_id: number | null
          published_at: string
          run_id: number
          user_id: string
          zkas_user_id: string
        }
        Insert: {
          aggregate_score: number
          allocation_usd: number
          created_at?: string
          id?: number
          notification_id?: number | null
          published_at?: string
          run_id: number
          user_id: string
          zkas_user_id: string
        }
        Update: {
          aggregate_score?: number
          allocation_usd?: number
          created_at?: string
          id?: number
          notification_id?: number | null
          published_at?: string
          run_id?: number
          user_id?: string
          zkas_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zkas_published_user_results_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_published_user_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_published_user_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      zkas_run_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          id: number
          logs: string | null
          mode: Database["public"]["Enums"]["zkas_execution_mode"]
          run_id: number
          started_at: string | null
          status: string
          worker_job_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: number
          logs?: string | null
          mode?: Database["public"]["Enums"]["zkas_execution_mode"]
          run_id: number
          started_at?: string | null
          status?: string
          worker_job_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: number
          logs?: string | null
          mode?: Database["public"]["Enums"]["zkas_execution_mode"]
          run_id?: number
          started_at?: string | null
          status?: string
          worker_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_attempts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_run_datasets: {
        Row: {
          created_at: string
          dataset_id: number
          file_hash: string
          id: number
          object_path: string
          project_id: number
          row_count: number
          run_id: number
        }
        Insert: {
          created_at?: string
          dataset_id: number
          file_hash: string
          id?: number
          object_path: string
          project_id: number
          row_count?: number
          run_id: number
        }
        Update: {
          created_at?: string
          dataset_id?: number
          file_hash?: string
          id?: number
          object_path?: string
          project_id?: number
          row_count?: number
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_datasets_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "zkas_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_datasets_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_run_payments: {
        Row: {
          amount_usd: number
          created_at: string
          id: number
          payment_id: number
          period_end: string
          project_id: number
          run_id: number
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: number
          payment_id: number
          period_end: string
          project_id: number
          run_id: number
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: number
          payment_id?: number
          period_end?: string
          project_id?: number
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_payments_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_run_project_cubid_buckets: {
        Row: {
          bucket_key: string
          bucket_label: string
          created_at: string
          id: number
          project_id: number
          run_id: number
          user_count: number
        }
        Insert: {
          bucket_key: string
          bucket_label: string
          created_at?: string
          id?: number
          project_id: number
          run_id: number
          user_count?: number
        }
        Update: {
          bucket_key?: string
          bucket_label?: string
          created_at?: string
          id?: number
          project_id?: number
          run_id?: number
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_project_cubid_buckets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_project_cubid_buckets_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_run_project_summaries: {
        Row: {
          active_user_count: number
          attributed_payout_usd: number
          avg_attributed_payout_per_published_user_usd: number
          avg_contribution_per_active_user_usd: number
          contributed_amount_usd: number
          created_at: string
          dataset_id: number
          id: number
          project_id: number
          published_user_count: number
          run_id: number
        }
        Insert: {
          active_user_count?: number
          attributed_payout_usd?: number
          avg_attributed_payout_per_published_user_usd?: number
          avg_contribution_per_active_user_usd?: number
          contributed_amount_usd?: number
          created_at?: string
          dataset_id: number
          id?: number
          project_id: number
          published_user_count?: number
          run_id: number
        }
        Update: {
          active_user_count?: number
          attributed_payout_usd?: number
          avg_attributed_payout_per_published_user_usd?: number
          avg_contribution_per_active_user_usd?: number
          contributed_amount_usd?: number
          created_at?: string
          dataset_id?: number
          id?: number
          project_id?: number
          published_user_count?: number
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_project_summaries_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "zkas_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_project_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_run_project_summaries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_run_results: {
        Row: {
          aggregate_score: number
          allocation_usd: number
          app_count: number
          created_at: string
          eligibility: boolean
          id: number
          output_row_hash: string
          project_count: number
          run_id: number
          zkas_user_id: string
        }
        Insert: {
          aggregate_score: number
          allocation_usd: number
          app_count?: number
          created_at?: string
          eligibility: boolean
          id?: number
          output_row_hash: string
          project_count?: number
          run_id: number
          zkas_user_id: string
        }
        Update: {
          aggregate_score?: number
          allocation_usd?: number
          app_count?: number
          created_at?: string
          eligibility?: boolean
          id?: number
          output_row_hash?: string
          project_count?: number
          run_id?: number
          zkas_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      zkas_runs: {
        Row: {
          attestation_artifact_hash: string | null
          attestation_artifact_path: string | null
          created_at: string
          created_by_user_id: string | null
          engine_config_version: string
          engine_git_ref: string
          engine_image_ref: string
          finalized_at: string | null
          id: number
          identity_artifact_id: number | null
          locked_at: string | null
          locked_manifest: Json | null
          locked_manifest_hash: string | null
          month: string
          note: string | null
          publication_note: string | null
          published_at: string | null
          published_by_user_id: string | null
          result_artifact_hash: string | null
          result_artifact_path: string | null
          schema_version: string
          status: Database["public"]["Enums"]["zkas_run_status"]
          total_allocated_usd: number | null
          total_score: number | null
          updated_at: string
          usd_pool: number
          user_count: number | null
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["zkas_verification_status"]
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          attestation_artifact_hash?: string | null
          attestation_artifact_path?: string | null
          created_at?: string
          created_by_user_id?: string | null
          engine_config_version?: string
          engine_git_ref?: string
          engine_image_ref?: string
          finalized_at?: string | null
          id?: number
          identity_artifact_id?: number | null
          locked_at?: string | null
          locked_manifest?: Json | null
          locked_manifest_hash?: string | null
          month: string
          note?: string | null
          publication_note?: string | null
          published_at?: string | null
          published_by_user_id?: string | null
          result_artifact_hash?: string | null
          result_artifact_path?: string | null
          schema_version?: string
          status?: Database["public"]["Enums"]["zkas_run_status"]
          total_allocated_usd?: number | null
          total_score?: number | null
          updated_at?: string
          usd_pool?: number
          user_count?: number | null
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["zkas_verification_status"]
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          attestation_artifact_hash?: string | null
          attestation_artifact_path?: string | null
          created_at?: string
          created_by_user_id?: string | null
          engine_config_version?: string
          engine_git_ref?: string
          engine_image_ref?: string
          finalized_at?: string | null
          id?: number
          identity_artifact_id?: number | null
          locked_at?: string | null
          locked_manifest?: Json | null
          locked_manifest_hash?: string | null
          month?: string
          note?: string | null
          publication_note?: string | null
          published_at?: string | null
          published_by_user_id?: string | null
          result_artifact_hash?: string | null
          result_artifact_path?: string | null
          schema_version?: string
          status?: Database["public"]["Enums"]["zkas_run_status"]
          total_allocated_usd?: number | null
          total_score?: number | null
          updated_at?: string
          usd_pool?: number
          user_count?: number | null
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["zkas_verification_status"]
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zkas_runs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "zkas_runs_identity_artifact_id_fkey"
            columns: ["identity_artifact_id"]
            isOneToOne: false
            referencedRelation: "zkas_identity_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zkas_runs_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "zkas_runs_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      project_category_count: {
        Row: {
          category_id: number | null
          category_name: string | null
          project_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ref_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stats_rolling12: {
        Row: {
          actual_percentage: number | null
          average_pledged_percentage: number | null
          period: string | null
          project_id: number | null
          total_contributed_amount: number | null
          total_monthly_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stats_monthly_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_identities: {
        Row: {
          created_at: string | null
          email: string | null
          identity_data: Json | null
          provider: string | null
          provider_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          identity_data?: Json | null
          provider?: string | null
          provider_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: never
          identity_data?: Json | null
          provider?: string | null
          provider_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      finalize_onchain_payment_reconciliation: {
        Args: {
          p_confirmation_count: number
          p_failure_code: string | null
          p_failure_reason: string | null
          p_last_checked_at: string
          p_matched_log_index: number | null
          p_payment_confirmed_at: string | null
          p_payment_id: number | null
          p_payment_note: string | null
          p_payment_status_id: number | null
          p_payment_updated_at: string
          p_submission_confirmed_at: string | null
          p_submission_id: number
          p_submission_reconciled_at: string | null
          p_submission_status: string
        }
        Returns: undefined
      }
      get_active_org_members: {
        Args: { org_id: number }
        Returns: {
          avatar_url: string
          full_name: string
          is_public: boolean
          role_id: number
          user_id: string
        }[]
      }
      publish_project_onboarding_draft_atomic: {
        Args: {
          p_billing_email: string | null
          p_billing_frequency: string | null
          p_category_ids: number[]
          p_contact_email: string | null
          p_default_payment_method_id: number | null
          p_description: string
          p_detailed_description: string | null
          p_logo_url: string | null
          p_name: string
          p_payment_percentage: number
          p_payment_periodicity_id: number | null
          p_slug: string
          p_website: string | null
        }
        Returns: {
          project_id: number
          project_slug: string
        }[]
      }
      soft_delete_organization_members: {
        Args: { p_id: number }
        Returns: undefined
      }
      soft_delete_organizations: { Args: { p_id: number }; Returns: undefined }
      soft_delete_payments: { Args: { p_id: number }; Returns: undefined }
      soft_delete_projects: { Args: { p_id: number }; Returns: undefined }
      soft_delete_users: { Args: { p_id: string }; Returns: undefined }
      soft_delete_wallet_accounts: {
        Args: { p_id: number }
        Returns: undefined
      }
      soft_delete_wallet_connections: {
        Args: { p_id: number }
        Returns: undefined
      }
    }
    Enums: {
      cubid_identity_status: "unlinked" | "linked" | "verified"
      organization_members_status: "active" | "inactive" | "deleted"
      payment_collection_mode: "contract" | "deposit_address"
      organizations_status: "active" | "inactive" | "deleted"
      payments_status: "active" | "inactive" | "deleted"
      projects_status: "active" | "inactive" | "deleted"
      users_status: "active" | "inactive" | "deleted"
      wallet_accounts_status: "active" | "inactive" | "deleted"
      wallet_connections_status: "active" | "inactive" | "deleted"
      zkas_dataset_status:
        | "uploaded"
        | "validated"
        | "failed"
        | "approved"
        | "included"
        | "replaced"
        | "archived"
      zkas_execution_mode: "local" | "nitro"
      zkas_issue_severity: "error" | "warning"
      zkas_run_status:
        | "draft"
        | "locked"
        | "running"
        | "completed"
        | "failed"
        | "finalized"
      zkas_verification_status: "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cubid_identity_status: ["unlinked", "linked", "verified"],
      organization_members_status: ["active", "inactive", "deleted"],
      payment_collection_mode: ["contract", "deposit_address"],
      organizations_status: ["active", "inactive", "deleted"],
      payments_status: ["active", "inactive", "deleted"],
      projects_status: ["active", "inactive", "deleted"],
      users_status: ["active", "inactive", "deleted"],
      wallet_accounts_status: ["active", "inactive", "deleted"],
      wallet_connections_status: ["active", "inactive", "deleted"],
    },
  },
} as const
