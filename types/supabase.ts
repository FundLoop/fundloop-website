export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          close_evidence_hash: string | null
          closed_at: string | null
          created_at: string
          ends_at: string
          id: number
          period_key: string
          production_enabled: boolean
          starts_at: string
          status: string
          timezone_name: string
        }
        Insert: {
          close_evidence_hash?: string | null
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: never
          period_key: string
          production_enabled?: boolean
          starts_at: string
          status?: string
          timezone_name?: string
        }
        Update: {
          close_evidence_hash?: string | null
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: never
          period_key?: string
          production_enabled?: boolean
          starts_at?: string
          status?: string
          timezone_name?: string
        }
        Relationships: []
      }
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
      base_intake_v2_assets: {
        Row: {
          address_evidence: Json
          deployment_id: number
          financial_asset_id: number | null
          id: number
          is_enabled: boolean
          provider_evidence_status: string
          symbol: string
          token_address: string
        }
        Insert: {
          address_evidence?: Json
          deployment_id: number
          financial_asset_id?: number | null
          id?: never
          is_enabled?: boolean
          provider_evidence_status?: string
          symbol: string
          token_address: string
        }
        Update: {
          address_evidence?: Json
          deployment_id?: number
          financial_asset_id?: number | null
          id?: never
          is_enabled?: boolean
          provider_evidence_status?: string
          symbol?: string
          token_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_intake_v2_assets_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_assets_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      base_intake_v2_deployments: {
        Row: {
          chain_id: number
          contract_address: string
          contract_version: string
          created_at: string
          deployment_environment: string
          epoch_treasury_address: string
          id: number
          is_active: boolean
          is_paused: boolean
          minimum_confirmation_depth: number
          platform_treasury_address: string
          production_value_flow_enabled: boolean
        }
        Insert: {
          chain_id: number
          contract_address: string
          contract_version?: string
          created_at?: string
          deployment_environment: string
          epoch_treasury_address: string
          id?: never
          is_active?: boolean
          is_paused?: boolean
          minimum_confirmation_depth?: number
          platform_treasury_address: string
          production_value_flow_enabled?: boolean
        }
        Update: {
          chain_id?: number
          contract_address?: string
          contract_version?: string
          created_at?: string
          deployment_environment?: string
          epoch_treasury_address?: string
          id?: never
          is_active?: boolean
          is_paused?: boolean
          minimum_confirmation_depth?: number
          platform_treasury_address?: string
          production_value_flow_enabled?: boolean
        }
        Relationships: []
      }
      base_intake_v2_receipts: {
        Row: {
          accounting_period_id: number
          block_hash: string
          block_number: number
          created_at: string
          deployment_id: number
          epoch_treasury_address: string
          evidence_hash: string
          fee_version_id: number
          gross_native_amount: number
          id: number
          log_index: number
          net_epoch_native_amount: number
          observed_at: string
          platform_fee_native_amount: number
          platform_treasury_address: string
          production_enabled: boolean
          project_fee_bps: number
          project_fee_version: number | null
          project_id: number
          provider_event_id: string
          receipt_reference: string | null
          sender_address: string
          token_address: string
          token_symbol: string
          tx_hash: string
        }
        Insert: {
          accounting_period_id: number
          block_hash: string
          block_number: number
          created_at?: string
          deployment_id: number
          epoch_treasury_address: string
          evidence_hash: string
          fee_version_id: number
          gross_native_amount: number
          id?: never
          log_index: number
          net_epoch_native_amount: number
          observed_at: string
          platform_fee_native_amount: number
          platform_treasury_address: string
          production_enabled?: boolean
          project_fee_bps: number
          project_fee_version?: number | null
          project_id: number
          provider_event_id: string
          receipt_reference?: string | null
          sender_address: string
          token_address: string
          token_symbol: string
          tx_hash: string
        }
        Update: {
          accounting_period_id?: number
          block_hash?: string
          block_number?: number
          created_at?: string
          deployment_id?: number
          epoch_treasury_address?: string
          evidence_hash?: string
          fee_version_id?: number
          gross_native_amount?: number
          id?: never
          log_index?: number
          net_epoch_native_amount?: number
          observed_at?: string
          platform_fee_native_amount?: number
          platform_treasury_address?: string
          production_enabled?: boolean
          project_fee_bps?: number
          project_fee_version?: number | null
          project_id?: number
          provider_event_id?: string
          receipt_reference?: string | null
          sender_address?: string
          token_address?: string
          token_symbol?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_intake_v2_receipts_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_receipts_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_receipts_fee_version_id_fkey"
            columns: ["fee_version_id"]
            isOneToOne: false
            referencedRelation: "base_project_fee_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      base_intake_v2_reconciliation_events: {
        Row: {
          confirmation_count: number
          created_at: string
          current_block_number: number
          epoch_observed_native_amount: number
          evidence_hash: string
          id: number
          observation_source: string
          observed_at: string
          observed_block_hash: string
          observed_log_index: number | null
          observed_receipt_block_number: number | null
          observed_receipt_reference: string | null
          observed_tx_hash: string
          platform_observed_native_amount: number
          receipt_event_matched: boolean
          receipt_id: number
          replacement_tx_hash: string | null
          status: string
        }
        Insert: {
          confirmation_count: number
          created_at?: string
          current_block_number: number
          epoch_observed_native_amount: number
          evidence_hash: string
          id?: never
          observation_source?: string
          observed_at: string
          observed_block_hash: string
          observed_log_index?: number | null
          observed_receipt_block_number?: number | null
          observed_receipt_reference?: string | null
          observed_tx_hash: string
          platform_observed_native_amount: number
          receipt_event_matched?: boolean
          receipt_id: number
          replacement_tx_hash?: string | null
          status: string
        }
        Update: {
          confirmation_count?: number
          created_at?: string
          current_block_number?: number
          epoch_observed_native_amount?: number
          evidence_hash?: string
          id?: never
          observation_source?: string
          observed_at?: string
          observed_block_hash?: string
          observed_log_index?: number | null
          observed_receipt_block_number?: number | null
          observed_receipt_reference?: string | null
          observed_tx_hash?: string
          platform_observed_native_amount?: number
          receipt_event_matched?: boolean
          receipt_id?: number
          replacement_tx_hash?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_intake_v2_reconciliation_events_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_receipt_observability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_reconciliation_events_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      base_paymaster_budgets: {
        Row: {
          deployment_id: number
          evidence_hash: string
          is_paused: boolean
          max_per_request_native: number
          remaining_native: number
          updated_at: string
          version: number
        }
        Insert: {
          deployment_id: number
          evidence_hash: string
          is_paused?: boolean
          max_per_request_native: number
          remaining_native: number
          updated_at?: string
          version?: number
        }
        Update: {
          deployment_id?: number
          evidence_hash?: string
          is_paused?: boolean
          max_per_request_native?: number
          remaining_native?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_paymaster_budgets_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: true
            referencedRelation: "base_safe_payout_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      base_payout_execution_commands: {
        Row: {
          authorized_at: string
          authorized_by_user_id: string
          chain_authorization_block_number: number | null
          chain_authorization_evidence_hash: string | null
          chain_authorized_at: string | null
          deployment_id: number
          epoch_key: string
          expires_at: string
          fee_recipient_address: string
          financial_asset_id: number
          gas_budget_native: number
          id: number
          module_nonce: number
          monthly_cycle_id: number
          native_atomic_amount: number
          payout_execution_attempt_id: number
          payout_intent_id: number
          production_enabled: boolean
          project_id: number
          recipient_address: string
          request_hash: string
          status: string
          token_address: string
          user_fee_native_amount: number
          withdrawal_request_id: string
        }
        Insert: {
          authorized_at?: string
          authorized_by_user_id: string
          chain_authorization_block_number?: number | null
          chain_authorization_evidence_hash?: string | null
          chain_authorized_at?: string | null
          deployment_id: number
          epoch_key: string
          expires_at: string
          fee_recipient_address: string
          financial_asset_id: number
          gas_budget_native: number
          id?: never
          module_nonce: number
          monthly_cycle_id: number
          native_atomic_amount: number
          payout_execution_attempt_id: number
          payout_intent_id: number
          production_enabled?: boolean
          project_id: number
          recipient_address: string
          request_hash: string
          status?: string
          token_address: string
          user_fee_native_amount?: number
          withdrawal_request_id: string
        }
        Update: {
          authorized_at?: string
          authorized_by_user_id?: string
          chain_authorization_block_number?: number | null
          chain_authorization_evidence_hash?: string | null
          chain_authorized_at?: string | null
          deployment_id?: number
          epoch_key?: string
          expires_at?: string
          fee_recipient_address?: string
          financial_asset_id?: number
          gas_budget_native?: number
          id?: never
          module_nonce?: number
          monthly_cycle_id?: number
          native_atomic_amount?: number
          payout_execution_attempt_id?: number
          payout_intent_id?: number
          production_enabled?: boolean
          project_id?: number
          recipient_address?: string
          request_hash?: string
          status?: string
          token_address?: string
          user_fee_native_amount?: number
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_payout_execution_commands_authorized_by_user_id_fkey"
            columns: ["authorized_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "base_safe_payout_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_payout_execution_attempt_id_fkey"
            columns: ["payout_execution_attempt_id"]
            isOneToOne: true
            referencedRelation: "payout_execution_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_payout_intent_id_fkey"
            columns: ["payout_intent_id"]
            isOneToOne: true
            referencedRelation: "payout_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_commands_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: true
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      base_payout_execution_observations: {
        Row: {
          block_hash: string
          block_number: number
          command_id: number
          confirmation_count: number
          created_at: string
          current_block_number: number
          evidence_hash: string
          id: number
          l1_batch_finalized: boolean
          ledger_transaction_id: number | null
          observation_source: string
          observed_at: string
          observed_fee_recipient_address: string
          observed_gas_budget_native: number
          observed_native_atomic_amount: number
          observed_recipient_address: string
          observed_request_hash: string
          observed_token_address: string
          observed_user_fee_native_amount: number
          receipt_success: boolean
          replacement_tx_hash: string | null
          status: string
          tx_hash: string
        }
        Insert: {
          block_hash: string
          block_number: number
          command_id: number
          confirmation_count: number
          created_at?: string
          current_block_number: number
          evidence_hash: string
          id?: never
          l1_batch_finalized?: boolean
          ledger_transaction_id?: number | null
          observation_source: string
          observed_at: string
          observed_fee_recipient_address: string
          observed_gas_budget_native: number
          observed_native_atomic_amount: number
          observed_recipient_address: string
          observed_request_hash: string
          observed_token_address: string
          observed_user_fee_native_amount: number
          receipt_success: boolean
          replacement_tx_hash?: string | null
          status: string
          tx_hash: string
        }
        Update: {
          block_hash?: string
          block_number?: number
          command_id?: number
          confirmation_count?: number
          created_at?: string
          current_block_number?: number
          evidence_hash?: string
          id?: never
          l1_batch_finalized?: boolean
          ledger_transaction_id?: number | null
          observation_source?: string
          observed_at?: string
          observed_fee_recipient_address?: string
          observed_gas_budget_native?: number
          observed_native_atomic_amount?: number
          observed_recipient_address?: string
          observed_request_hash?: string
          observed_token_address?: string
          observed_user_fee_native_amount?: number
          receipt_success?: boolean
          replacement_tx_hash?: string | null
          status?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_payout_execution_observations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "base_payout_execution_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_observations_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_execution_observations_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
        ]
      }
      base_payout_fee_inventory_reservations: {
        Row: {
          command_id: number
          inventory_lot_id: number
          native_atomic_amount: number
          status: string
        }
        Insert: {
          command_id: number
          inventory_lot_id: number
          native_atomic_amount: number
          status?: string
        }
        Update: {
          command_id?: number
          inventory_lot_id?: number
          native_atomic_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_payout_fee_inventory_reservations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "base_payout_execution_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_fee_inventory_reservations_inventory_lot_id_fkey"
            columns: ["inventory_lot_id"]
            isOneToOne: false
            referencedRelation: "payout_inventory_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      base_payout_reconciliation_links: {
        Row: {
          command_id: number
          created_at: string
          ledger_transaction_id: number
          observation_id: number
        }
        Insert: {
          command_id: number
          created_at?: string
          ledger_transaction_id: number
          observation_id: number
        }
        Update: {
          command_id?: number
          created_at?: string
          ledger_transaction_id?: number
          observation_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_payout_reconciliation_links_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: true
            referencedRelation: "base_payout_execution_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_reconciliation_links_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_payout_reconciliation_links_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "base_payout_reconciliation_links_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: true
            referencedRelation: "base_payout_execution_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      base_payout_runtime_controls: {
        Row: {
          authorization_enabled: boolean
          deployment_environment: string
          observation_enabled: boolean
          production_value_flow_enabled: boolean
        }
        Insert: {
          authorization_enabled?: boolean
          deployment_environment: string
          observation_enabled?: boolean
          production_value_flow_enabled?: boolean
        }
        Update: {
          authorization_enabled?: boolean
          deployment_environment?: string
          observation_enabled?: boolean
          production_value_flow_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "base_payout_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      base_project_fee_versions: {
        Row: {
          created_at: string
          evidence_hash: string
          fee_bps: number
          id: number
          is_current: boolean
          project_id: number
          version: number
        }
        Insert: {
          created_at?: string
          evidence_hash: string
          fee_bps: number
          id?: never
          is_current?: boolean
          project_id: number
          version: number
        }
        Update: {
          created_at?: string
          evidence_hash?: string
          fee_bps?: number
          id?: never
          is_current?: boolean
          project_id?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_project_fee_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      base_safe_payout_assets: {
        Row: {
          deployment_id: number
          evidence_hash: string
          financial_asset_id: number
          is_enabled: boolean
          token_address: string
        }
        Insert: {
          deployment_id: number
          evidence_hash: string
          financial_asset_id: number
          is_enabled?: boolean
          token_address: string
        }
        Update: {
          deployment_id?: number
          evidence_hash?: string
          financial_asset_id?: number
          is_enabled?: boolean
          token_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_safe_payout_assets_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "base_safe_payout_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_safe_payout_assets_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      base_safe_payout_deployments: {
        Row: {
          chain_id: number
          created_at: string
          deployment_environment: string
          evidence_hash: string
          id: number
          is_active: boolean
          is_paused: boolean
          limited_signer_address: string
          max_per_epoch_native: number
          max_per_transaction_native: number
          max_rolling_24h_native: number
          module_address: string
          module_owner_address: string
          paymaster_controller_address: string
          paymaster_owner_address: string
          paymaster_policy_address: string
          production_enabled: boolean
          safe_address: string
          safe_role: string
        }
        Insert: {
          chain_id: number
          created_at?: string
          deployment_environment: string
          evidence_hash: string
          id?: never
          is_active?: boolean
          is_paused?: boolean
          limited_signer_address: string
          max_per_epoch_native: number
          max_per_transaction_native: number
          max_rolling_24h_native: number
          module_address: string
          module_owner_address: string
          paymaster_controller_address: string
          paymaster_owner_address: string
          paymaster_policy_address: string
          production_enabled?: boolean
          safe_address: string
          safe_role: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          deployment_environment?: string
          evidence_hash?: string
          id?: never
          is_active?: boolean
          is_paused?: boolean
          limited_signer_address?: string
          max_per_epoch_native?: number
          max_per_transaction_native?: number
          max_rolling_24h_native?: number
          module_address?: string
          module_owner_address?: string
          paymaster_controller_address?: string
          paymaster_owner_address?: string
          paymaster_policy_address?: string
          production_enabled?: boolean
          safe_address?: string
          safe_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_safe_payout_deployments_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "base_payout_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
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
      custody_reconciliation_snapshots: {
        Row: {
          asset_id: number
          custody_account_id: number
          evidence_hash: string
          id: number
          observed_at: string
          production_enabled: boolean
          provider_native_balance: number
          shadow_native_balance: number
          tolerance_native_amount: number
          variance_classification: string
          variance_native_amount: number
        }
        Insert: {
          asset_id: number
          custody_account_id: number
          evidence_hash: string
          id?: never
          observed_at: string
          production_enabled?: boolean
          provider_native_balance: number
          shadow_native_balance: number
          tolerance_native_amount: number
          variance_classification: string
          variance_native_amount: number
        }
        Update: {
          asset_id?: number
          custody_account_id?: number
          evidence_hash?: string
          id?: never
          observed_at?: string
          production_enabled?: boolean
          provider_native_balance?: number
          shadow_native_balance?: number
          tolerance_native_amount?: number
          variance_classification?: string
          variance_native_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "custody_recon_asset_fk"
            columns: ["asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
          {
            foreignKeyName: "custody_reconciliation_snapshots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_reconciliation_snapshots_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      epoch_allocation_approvals: {
        Row: {
          actor_user_id: string
          approved_at: string
          deployment_environment: string
          id: number
          manifest_hash: string
          production_enabled: boolean
          rerun_result_hash: string
          result_hash: string
          run_id: number
        }
        Insert: {
          actor_user_id: string
          approved_at?: string
          deployment_environment: string
          id?: never
          manifest_hash: string
          production_enabled?: boolean
          rerun_result_hash: string
          result_hash: string
          run_id: number
        }
        Update: {
          actor_user_id?: string
          approved_at?: string
          deployment_environment?: string
          id?: never
          manifest_hash?: string
          production_enabled?: boolean
          rerun_result_hash?: string
          result_hash?: string
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_approvals_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_allocation_approvals_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_close_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "epoch_allocation_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_operator_view"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "epoch_allocation_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_allocation_manifest_cohort: {
        Row: {
          cubid_evidence_hash: string
          id: number
          locked_cubid_score: number
          locked_max_cubid_score: number
          manifest_id: number
          project_id: number
          project_pseudonym: string
          user_id: string
        }
        Insert: {
          cubid_evidence_hash: string
          id?: never
          locked_cubid_score: number
          locked_max_cubid_score: number
          manifest_id: number
          project_id: number
          project_pseudonym: string
          user_id: string
        }
        Update: {
          cubid_evidence_hash?: string
          id?: never
          locked_cubid_score?: number
          locked_max_cubid_score?: number
          manifest_id?: number
          project_id?: number
          project_pseudonym?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_manifest_cohort_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_cohort_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_operator_view"
            referencedColumns: ["manifest_id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_cohort_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_cohort_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_allocation_manifest_sources: {
        Row: {
          canonical_minor_capacity: number
          custody_account_id: number
          evidence_hash: string
          exact_usd: number
          financial_asset_id: number
          fx_snapshot_id: number
          id: number
          manifest_id: number
          native_atomic_amount: number
          project_id: number
          rail_key: string
          source_lot_id: number
          source_lot_key: string
          source_order: number
          source_position: number
        }
        Insert: {
          canonical_minor_capacity: number
          custody_account_id: number
          evidence_hash: string
          exact_usd: number
          financial_asset_id: number
          fx_snapshot_id: number
          id?: never
          manifest_id: number
          native_atomic_amount: number
          project_id: number
          rail_key: string
          source_lot_id: number
          source_lot_key: string
          source_order: number
          source_position: number
        }
        Update: {
          canonical_minor_capacity?: number
          custody_account_id?: number
          evidence_hash?: string
          exact_usd?: number
          financial_asset_id?: number
          fx_snapshot_id?: number
          id?: never
          manifest_id?: number
          native_atomic_amount?: number
          project_id?: number
          rail_key?: string
          source_lot_id?: number
          source_lot_key?: string
          source_order?: number
          source_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_manifest_sources_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_fx_snapshot_id_fkey"
            columns: ["fx_snapshot_id"]
            isOneToOne: false
            referencedRelation: "epoch_fx_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_operator_view"
            referencedColumns: ["manifest_id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_source_lot_id_fkey"
            columns: ["source_lot_id"]
            isOneToOne: true
            referencedRelation: "epoch_funded_allocation_lock_candidates"
            referencedColumns: ["source_lot_id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifest_sources_source_lot_id_fkey"
            columns: ["source_lot_id"]
            isOneToOne: true
            referencedRelation: "epoch_valuation_source_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_source_pair"
            columns: ["financial_asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
        ]
      }
      epoch_allocation_manifests: {
        Row: {
          actor_user_id: string
          calculated_at: string | null
          deployment_environment: string
          funded_exact_usd: number
          funded_minor: number
          id: number
          locked_at: string
          manifest: Json
          manifest_hash: string
          minor_unit_scale: number
          monthly_cycle_id: number
          policy_key: string
          production_enabled: boolean
          status: string
          version: number
        }
        Insert: {
          actor_user_id: string
          calculated_at?: string | null
          deployment_environment: string
          funded_exact_usd: number
          funded_minor: number
          id?: never
          locked_at?: string
          manifest: Json
          manifest_hash: string
          minor_unit_scale?: number
          monthly_cycle_id: number
          policy_key?: string
          production_enabled?: boolean
          status?: string
          version: number
        }
        Update: {
          actor_user_id?: string
          calculated_at?: string | null
          deployment_environment?: string
          funded_exact_usd?: number
          funded_minor?: number
          id?: never
          locked_at?: string
          manifest?: Json
          manifest_hash?: string
          minor_unit_scale?: number
          monthly_cycle_id?: number
          policy_key?: string
          production_enabled?: boolean
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_manifests_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_allocation_manifests_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "epoch_allocation_manifests_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_allocation_runs: {
        Row: {
          actor_user_id: string
          artifact: Json
          created_at: string
          deployment_environment: string
          final_allocation_minor: number
          funded_minor: number
          id: number
          manifest_id: number
          overlap_pool_minor: number
          policy_key: string
          production_enabled: boolean
          result_hash: string
          retained_initial_minor: number
          returned_residue_minor: number
          score_pool_minor: number
          top_up_minor: number
        }
        Insert: {
          actor_user_id: string
          artifact: Json
          created_at?: string
          deployment_environment: string
          final_allocation_minor: number
          funded_minor: number
          id?: never
          manifest_id: number
          overlap_pool_minor: number
          policy_key: string
          production_enabled?: boolean
          result_hash: string
          retained_initial_minor: number
          returned_residue_minor: number
          score_pool_minor: number
          top_up_minor: number
        }
        Update: {
          actor_user_id?: string
          artifact?: Json
          created_at?: string
          deployment_environment?: string
          final_allocation_minor?: number
          funded_minor?: number
          id?: never
          manifest_id?: number
          overlap_pool_minor?: number
          policy_key?: string
          production_enabled?: boolean
          result_hash?: string
          retained_initial_minor?: number
          returned_residue_minor?: number
          score_pool_minor?: number
          top_up_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_runs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_allocation_runs_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "epoch_allocation_runs_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_runs_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_operator_view"
            referencedColumns: ["manifest_id"]
          },
        ]
      }
      epoch_allocation_runtime_controls: {
        Row: {
          allocation_enabled: boolean
          deployment_environment: string
          production_value_flow_enabled: boolean
          updated_at: string
        }
        Insert: {
          allocation_enabled?: boolean
          deployment_environment: string
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Update: {
          allocation_enabled?: boolean
          deployment_environment?: string
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      epoch_allocation_source_dispositions: {
        Row: {
          canonical_minor: number
          disposition_kind: string
          exact_usd: number
          id: number
          manifest_source_id: number
          run_id: number
          stable_position: number
          user_id: string | null
        }
        Insert: {
          canonical_minor: number
          disposition_kind: string
          exact_usd: number
          id?: never
          manifest_source_id: number
          run_id: number
          stable_position: number
          user_id?: string | null
        }
        Update: {
          canonical_minor?: number
          disposition_kind?: string
          exact_usd?: number
          id?: never
          manifest_source_id?: number
          run_id?: number
          stable_position?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_source_dispositions_manifest_source_id_fkey"
            columns: ["manifest_source_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_manifest_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_source_dispositions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_operator_view"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "epoch_allocation_source_dispositions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_source_dispositions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_allocation_user_awards: {
        Row: {
          aggregate_initial_exact_usd: number
          baseline_exact_usd: number
          exact_cap_usd: number
          final_minor: number
          id: number
          minor_unit_cap: number
          project_claims: Json
          retained_initial_minor: number
          run_id: number
          top_up_minor: number
          user_id: string
        }
        Insert: {
          aggregate_initial_exact_usd: number
          baseline_exact_usd: number
          exact_cap_usd: number
          final_minor: number
          id?: never
          minor_unit_cap: number
          project_claims: Json
          retained_initial_minor: number
          run_id: number
          top_up_minor: number
          user_id: string
        }
        Update: {
          aggregate_initial_exact_usd?: number
          baseline_exact_usd?: number
          exact_cap_usd?: number
          final_minor?: number
          id?: never
          minor_unit_cap?: number
          project_claims?: Json
          retained_initial_minor?: number
          run_id?: number
          top_up_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_user_awards_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_operator_view"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "epoch_allocation_user_awards_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_allocation_user_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_asset_custody_routes: {
        Row: {
          asset_code: string
          created_at: string
          custody_account_id: number
          evidence_hash: string
          financial_asset_id: number
          id: number
          production_enabled: boolean
          source_kind: string
        }
        Insert: {
          asset_code: string
          created_at?: string
          custody_account_id: number
          evidence_hash: string
          financial_asset_id: number
          id?: never
          production_enabled?: boolean
          source_kind: string
        }
        Update: {
          asset_code?: string
          created_at?: string
          custody_account_id?: number
          evidence_hash?: string
          financial_asset_id?: number
          id?: never
          production_enabled?: boolean
          source_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_asset_custody_pair"
            columns: ["financial_asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
          {
            foreignKeyName: "epoch_asset_custody_routes_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_asset_custody_routes_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_business_calendar: {
        Row: {
          calendar_date: string
          calendar_region: string
          created_at: string
          is_business_day: boolean
          production_enabled: boolean
          reason: string | null
        }
        Insert: {
          calendar_date: string
          calendar_region?: string
          created_at?: string
          is_business_day: boolean
          production_enabled?: boolean
          reason?: string | null
        }
        Update: {
          calendar_date?: string
          calendar_region?: string
          created_at?: string
          is_business_day?: boolean
          production_enabled?: boolean
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_business_calendar_calendar_region_fkey"
            columns: ["calendar_region"]
            isOneToOne: false
            referencedRelation: "epoch_business_calendars"
            referencedColumns: ["region_key"]
          },
        ]
      }
      epoch_business_calendars: {
        Row: {
          production_enabled: boolean
          region_key: string
          timezone_name: string
        }
        Insert: {
          production_enabled?: boolean
          region_key: string
          timezone_name?: string
        }
        Update: {
          production_enabled?: boolean
          region_key?: string
          timezone_name?: string
        }
        Relationships: []
      }
      epoch_close_artifacts: {
        Row: {
          artifact: Json
          artifact_hash: string
          artifact_key: string
          audience: string
          close_package_id: number
          created_at: string
          id: number
        }
        Insert: {
          artifact: Json
          artifact_hash: string
          artifact_key: string
          audience: string
          close_package_id: number
          created_at?: string
          id?: never
        }
        Update: {
          artifact?: Json
          artifact_hash?: string
          artifact_key?: string
          audience?: string
          close_package_id?: number
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "epoch_close_artifacts_close_package_id_fkey"
            columns: ["close_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_close_operator_view"
            referencedColumns: ["close_package_id"]
          },
          {
            foreignKeyName: "epoch_close_artifacts_close_package_id_fkey"
            columns: ["close_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_close_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_close_packages: {
        Row: {
          approval_id: number
          created_at: string
          final_allocation_minor: number
          funded_minor: number
          id: number
          manifest_hash: string
          monthly_cycle_id: number
          package_version: number
          production_enabled: boolean
          redistribution_pool_minor: number
          result_hash: string
          returned_residue_minor: number
          root_hash: string
          shadow_state_id: number
          stage_attempt_id: number | null
          status: string
          top_up_minor: number
          user_count: number
        }
        Insert: {
          approval_id: number
          created_at?: string
          final_allocation_minor: number
          funded_minor: number
          id?: never
          manifest_hash: string
          monthly_cycle_id: number
          package_version?: number
          production_enabled?: boolean
          redistribution_pool_minor: number
          result_hash: string
          returned_residue_minor: number
          root_hash: string
          shadow_state_id: number
          stage_attempt_id?: number | null
          status?: string
          top_up_minor: number
          user_count: number
        }
        Update: {
          approval_id?: number
          created_at?: string
          final_allocation_minor?: number
          funded_minor?: number
          id?: never
          manifest_hash?: string
          monthly_cycle_id?: number
          package_version?: number
          production_enabled?: boolean
          redistribution_pool_minor?: number
          result_hash?: string
          returned_residue_minor?: number
          root_hash?: string
          shadow_state_id?: number
          stage_attempt_id?: number | null
          status?: string
          top_up_minor?: number
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_close_packages_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_packages_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: true
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_packages_shadow_state_id_fkey"
            columns: ["shadow_state_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["shadow_state_id"]
          },
          {
            foreignKeyName: "epoch_close_packages_shadow_state_id_fkey"
            columns: ["shadow_state_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_packages_stage_attempt_id_fkey"
            columns: ["stage_attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["latest_attempt_id"]
          },
          {
            foreignKeyName: "epoch_close_packages_stage_attempt_id_fkey"
            columns: ["stage_attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_stage_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_close_project_summaries: {
        Row: {
          approval_id: number
          cohort_count: number
          created_at: string
          funded_minor: number
          id: number
          initial_claim_exact_usd: number
          monthly_cycle_id: number
          project_id: number
          score_pool_contribution_exact_usd: number
          source_count: number
          theoretical_share_exact_usd: number
        }
        Insert: {
          approval_id: number
          cohort_count: number
          created_at?: string
          funded_minor: number
          id?: never
          initial_claim_exact_usd: number
          monthly_cycle_id: number
          project_id: number
          score_pool_contribution_exact_usd: number
          source_count: number
          theoretical_share_exact_usd: number
        }
        Update: {
          approval_id?: number
          cohort_count?: number
          created_at?: string
          funded_minor?: number
          id?: never
          initial_claim_exact_usd?: number
          monthly_cycle_id?: number
          project_id?: number
          score_pool_contribution_exact_usd?: number
          source_count?: number
          theoretical_share_exact_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_close_project_summaries_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_project_summaries_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_project_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_close_root_approvals: {
        Row: {
          actor_user_id: string
          approval_id: number
          approved_at: string
          close_package_id: number
          deployment_environment: string
          id: number
          production_enabled: boolean
          root_hash: string
        }
        Insert: {
          actor_user_id: string
          approval_id: number
          approved_at?: string
          close_package_id: number
          deployment_environment: string
          id?: never
          production_enabled?: boolean
          root_hash: string
        }
        Update: {
          actor_user_id?: string
          approval_id?: number
          approved_at?: string
          close_package_id?: number
          deployment_environment?: string
          id?: never
          production_enabled?: boolean
          root_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_close_root_approvals_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_close_root_approvals_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_root_approvals_close_package_id_fkey"
            columns: ["close_package_id"]
            isOneToOne: true
            referencedRelation: "epoch_close_operator_view"
            referencedColumns: ["close_package_id"]
          },
          {
            foreignKeyName: "epoch_close_root_approvals_close_package_id_fkey"
            columns: ["close_package_id"]
            isOneToOne: true
            referencedRelation: "epoch_close_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_close_root_approvals_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_close_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      epoch_close_runtime_controls: {
        Row: {
          close_posting_enabled: boolean
          deployment_environment: string
          production_value_flow_enabled: boolean
          updated_at: string
        }
        Insert: {
          close_posting_enabled?: boolean
          deployment_environment: string
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Update: {
          close_posting_enabled?: boolean
          deployment_environment?: string
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_close_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      epoch_fee_policies: {
        Row: {
          base_fee_bps: number
          effective_from: string
          effective_until: string | null
          evidence_hash: string
          id: number
          policy_key: string
          production_enabled: boolean
          project_fee_default_bps: number
          project_fee_max_bps: number
          project_fee_min_bps: number
          rail_key: string | null
          version: number
        }
        Insert: {
          base_fee_bps?: number
          effective_from: string
          effective_until?: string | null
          evidence_hash: string
          id?: never
          policy_key: string
          production_enabled?: boolean
          project_fee_default_bps?: number
          project_fee_max_bps?: number
          project_fee_min_bps?: number
          rail_key?: string | null
          version: number
        }
        Update: {
          base_fee_bps?: number
          effective_from?: string
          effective_until?: string | null
          evidence_hash?: string
          id?: never
          policy_key?: string
          production_enabled?: boolean
          project_fee_default_bps?: number
          project_fee_max_bps?: number
          project_fee_min_bps?: number
          rail_key?: string | null
          version?: number
        }
        Relationships: []
      }
      epoch_financial_prep_runtime_controls: {
        Row: {
          deployment_environment: string
          prep_enabled: boolean
          production_value_flow_enabled: boolean
          updated_at: string
        }
        Insert: {
          deployment_environment: string
          prep_enabled?: boolean
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Update: {
          deployment_environment?: string
          prep_enabled?: boolean
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_financial_prep_runtime_contro_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      epoch_fx_observations: {
        Row: {
          actor_user_id: string | null
          created_at: string
          deployment_environment: string
          evidence_hash: string
          financial_asset_id: number
          freshness_expires_at: string
          id: number
          monthly_cycle_id: number
          observed_at: string
          production_enabled: boolean
          rate_usd_per_unit: number
          reasonability_status: string
          source_key: string
          source_rank: number
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          deployment_environment: string
          evidence_hash: string
          financial_asset_id: number
          freshness_expires_at: string
          id?: never
          monthly_cycle_id: number
          observed_at: string
          production_enabled?: boolean
          rate_usd_per_unit: number
          reasonability_status: string
          source_key: string
          source_rank: number
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          deployment_environment?: string
          evidence_hash?: string
          financial_asset_id?: number
          freshness_expires_at?: string
          id?: never
          monthly_cycle_id?: number
          observed_at?: string
          production_enabled?: boolean
          rate_usd_per_unit?: number
          reasonability_status?: string
          source_key?: string
          source_rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_fx_observations_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_fx_observations_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_financial_prep_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "epoch_fx_observations_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_fx_observations_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_fx_snapshots: {
        Row: {
          created_at: string
          deployment_environment: string
          evidence_hash: string
          financial_asset_id: number
          id: number
          method: string
          monthly_cycle_id: number
          posted_at: string | null
          preanalysis: Json
          production_enabled: boolean
          rate_usd_per_unit: number
          reviewed_by_user_id: string
          selected_observation_id: number | null
          stablecoin_peg_status: string
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          deployment_environment: string
          evidence_hash: string
          financial_asset_id: number
          id?: never
          method: string
          monthly_cycle_id: number
          posted_at?: string | null
          preanalysis: Json
          production_enabled?: boolean
          rate_usd_per_unit: number
          reviewed_by_user_id: string
          selected_observation_id?: number | null
          stablecoin_peg_status: string
          status: string
          version: number
        }
        Update: {
          created_at?: string
          deployment_environment?: string
          evidence_hash?: string
          financial_asset_id?: number
          id?: never
          method?: string
          monthly_cycle_id?: number
          posted_at?: string | null
          preanalysis?: Json
          production_enabled?: boolean
          rate_usd_per_unit?: number
          reviewed_by_user_id?: string
          selected_observation_id?: number | null
          stablecoin_peg_status?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_fx_snapshots_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_financial_prep_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "epoch_fx_snapshots_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_fx_snapshots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_fx_snapshots_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_fx_snapshots_selected_observation_id_fkey"
            columns: ["selected_observation_id"]
            isOneToOne: false
            referencedRelation: "epoch_fx_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_cohort: {
        Row: {
          cubid_decision: string
          cubid_evidence_at: string | null
          cubid_evidence_expires_at: string | null
          eligibility_status: string
          evidence_hash: string
          id: number
          locked_cubid_score: number | null
          locked_max_cubid_score: number
          notification_required: boolean
          package_id: number
          project_pseudonym: string
          source_row_id: number
          user_id: string
        }
        Insert: {
          cubid_decision: string
          cubid_evidence_at?: string | null
          cubid_evidence_expires_at?: string | null
          eligibility_status: string
          evidence_hash: string
          id?: never
          locked_cubid_score?: number | null
          locked_max_cubid_score: number
          notification_required?: boolean
          package_id: number
          project_pseudonym: string
          source_row_id: number
          user_id: string
        }
        Update: {
          cubid_decision?: string
          cubid_evidence_at?: string | null
          cubid_evidence_expires_at?: string | null
          eligibility_status?: string
          evidence_hash?: string
          id?: never
          locked_cubid_score?: number | null
          locked_max_cubid_score?: number
          notification_required?: boolean
          package_id?: number
          project_pseudonym?: string
          source_row_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_cohort_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_package_cohort_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_cohort_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_cohort_source_row_id_fkey"
            columns: ["source_row_id"]
            isOneToOne: false
            referencedRelation: "project_attribution_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_cohort_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_project_package_decision_events: {
        Row: {
          actor_user_id: string | null
          decided_at: string
          decision: string
          evidence_hash: string
          id: number
          package_id: number
          production_enabled: boolean
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          decided_at?: string
          decision: string
          evidence_hash: string
          id?: never
          package_id: number
          production_enabled?: boolean
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          decided_at?: string
          decision?: string
          evidence_hash?: string
          id?: never
          package_id?: number
          production_enabled?: boolean
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_decision_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_project_package_decision_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_package_decision_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_decision_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_email_events: {
        Row: {
          accepted_at: string | null
          attempt_id: string
          created_at: string
          created_by_user_id: string
          event_type: string
          evidence_hash: string
          id: number
          package_id: number
          production_enabled: boolean
          provider_key: string
          provider_message_id: string | null
          recipient_hash: string
        }
        Insert: {
          accepted_at?: string | null
          attempt_id: string
          created_at?: string
          created_by_user_id: string
          event_type: string
          evidence_hash: string
          id?: never
          package_id: number
          production_enabled?: boolean
          provider_key: string
          provider_message_id?: string | null
          recipient_hash: string
        }
        Update: {
          accepted_at?: string | null
          attempt_id?: string
          created_at?: string
          created_by_user_id?: string
          event_type?: string
          evidence_hash?: string
          id?: never
          package_id?: number
          production_enabled?: boolean
          provider_key?: string
          provider_message_id?: string | null
          recipient_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_email_events_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_project_package_email_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_package_email_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_email_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_funding_sources: {
        Row: {
          asset_code: string
          base_fee_deferred: boolean
          base_receipt_id: number | null
          id: number
          native_atomic_amount: number
          package_id: number
          preliminary_usd: number
          project_fee_assessed_once: boolean
          source_evidence_hash: string
          source_kind: string
          source_position: number
          stripe_acss_debit_command_id: string | null
          stripe_intent_id: number | null
          stripe_pay_by_bank_command_id: string | null
        }
        Insert: {
          asset_code: string
          base_fee_deferred?: boolean
          base_receipt_id?: number | null
          id?: never
          native_atomic_amount: number
          package_id: number
          preliminary_usd: number
          project_fee_assessed_once?: boolean
          source_evidence_hash: string
          source_kind: string
          source_position: number
          stripe_acss_debit_command_id?: string | null
          stripe_intent_id?: number | null
          stripe_pay_by_bank_command_id?: string | null
        }
        Update: {
          asset_code?: string
          base_fee_deferred?: boolean
          base_receipt_id?: number | null
          id?: never
          native_atomic_amount?: number
          package_id?: number
          preliminary_usd?: number
          project_fee_assessed_once?: boolean
          source_evidence_hash?: string
          source_kind?: string
          source_position?: number
          stripe_acss_debit_command_id?: string | null
          stripe_intent_id?: number | null
          stripe_pay_by_bank_command_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_funding_sources_base_receipt_id_fkey"
            columns: ["base_receipt_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_receipt_observability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_sources_base_receipt_id_fkey"
            columns: ["base_receipt_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_sources_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_sources_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_sources_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_sources_stripe_intent_id_fkey"
            columns: ["stripe_intent_id"]
            isOneToOne: false
            referencedRelation: "stripe_bank_transfer_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_sources_stripe_intent_id_fkey"
            columns: ["stripe_intent_id"]
            isOneToOne: false
            referencedRelation: "stripe_bank_transfer_status"
            referencedColumns: ["intent_id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_stripe_acss_debit_command_id_fkey"
            columns: ["stripe_acss_debit_command_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_stripe_acss_debit_command_id_fkey"
            columns: ["stripe_acss_debit_command_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_status"
            referencedColumns: ["command_id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_stripe_pay_by_bank_command_i_fkey"
            columns: ["stripe_pay_by_bank_command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_funding_stripe_pay_by_bank_command_i_fkey"
            columns: ["stripe_pay_by_bank_command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_status"
            referencedColumns: ["command_id"]
          },
        ]
      }
      epoch_project_package_payments: {
        Row: {
          package_id: number
          payment_id: number
          source_position: number
        }
        Insert: {
          package_id: number
          payment_id: number
          source_position: number
        }
        Update: {
          package_id?: number
          payment_id?: number
          source_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_package_payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_package_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_runtime_controls: {
        Row: {
          deployment_environment: string
          local_email_delivery_enabled: boolean
          package_preview_enabled: boolean
          production_enabled: boolean
          updated_at: string
        }
        Insert: {
          deployment_environment: string
          local_email_delivery_enabled?: boolean
          package_preview_enabled?: boolean
          production_enabled?: boolean
          updated_at?: string
        }
        Update: {
          deployment_environment?: string
          local_email_delivery_enabled?: boolean
          package_preview_enabled?: boolean
          production_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_runtime_contr_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      epoch_project_packages: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          attribution_dataset_id: number | null
          base_fee_deferred: boolean
          canonical_cycle_id: number | null
          cohort_count: number
          compliance_snapshot_id: number | null
          compliance_status: string
          created_at: string
          created_by_user_id: string
          cubid_status: string
          cutoff_at: string
          eligible_user_count: number
          frozen_at: string | null
          funding_source_count: number
          funding_status: string
          held_user_count: number
          id: number
          intended_cycle_id: number
          list_status: string
          manifest: Json
          manifest_hash: string
          opted_out_at: string | null
          opted_out_by_user_id: string | null
          payment_count: number
          preliminary_usd: number
          production_enabled: boolean
          project_fee_assessed_once: boolean
          project_id: number
          reconciliation_deadline_at: string | null
          reconciliation_email_delivered_at: string | null
          rolled_from_package_id: number | null
          rolled_to_package_id: number | null
          status: string
          supersedes_package_id: number | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          attribution_dataset_id?: number | null
          base_fee_deferred?: boolean
          canonical_cycle_id?: number | null
          cohort_count?: number
          compliance_snapshot_id?: number | null
          compliance_status: string
          created_at?: string
          created_by_user_id: string
          cubid_status: string
          cutoff_at: string
          eligible_user_count?: number
          frozen_at?: string | null
          funding_source_count?: number
          funding_status: string
          held_user_count?: number
          id?: never
          intended_cycle_id: number
          list_status: string
          manifest?: Json
          manifest_hash: string
          opted_out_at?: string | null
          opted_out_by_user_id?: string | null
          payment_count?: number
          preliminary_usd?: number
          production_enabled?: boolean
          project_fee_assessed_once?: boolean
          project_id: number
          reconciliation_deadline_at?: string | null
          reconciliation_email_delivered_at?: string | null
          rolled_from_package_id?: number | null
          rolled_to_package_id?: number | null
          status: string
          supersedes_package_id?: number | null
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          attribution_dataset_id?: number | null
          base_fee_deferred?: boolean
          canonical_cycle_id?: number | null
          cohort_count?: number
          compliance_snapshot_id?: number | null
          compliance_status?: string
          created_at?: string
          created_by_user_id?: string
          cubid_status?: string
          cutoff_at?: string
          eligible_user_count?: number
          frozen_at?: string | null
          funding_source_count?: number
          funding_status?: string
          held_user_count?: number
          id?: never
          intended_cycle_id?: number
          list_status?: string
          manifest?: Json
          manifest_hash?: string
          opted_out_at?: string | null
          opted_out_by_user_id?: string | null
          payment_count?: number
          preliminary_usd?: number
          production_enabled?: boolean
          project_fee_assessed_once?: boolean
          project_id?: number
          reconciliation_deadline_at?: string | null
          reconciliation_email_delivered_at?: string | null
          rolled_from_package_id?: number | null
          rolled_to_package_id?: number | null
          status?: string
          supersedes_package_id?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_packages_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_project_packages_attribution_dataset_id_fkey"
            columns: ["attribution_dataset_id"]
            isOneToOne: false
            referencedRelation: "project_attribution_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_canonical_cycle_id_fkey"
            columns: ["canonical_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_compliance_snapshot_id_fkey"
            columns: ["compliance_snapshot_id"]
            isOneToOne: false
            referencedRelation: "project_compliance_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_project_packages_intended_cycle_id_fkey"
            columns: ["intended_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_opted_out_by_user_id_fkey"
            columns: ["opted_out_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_project_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_rolled_from_package_id_fkey"
            columns: ["rolled_from_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_packages_rolled_from_package_id_fkey"
            columns: ["rolled_from_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_rolled_from_package_id_fkey"
            columns: ["rolled_from_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_rolled_to_package_id_fkey"
            columns: ["rolled_to_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_packages_rolled_to_package_id_fkey"
            columns: ["rolled_to_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_rolled_to_package_id_fkey"
            columns: ["rolled_to_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_supersedes_package_id_fkey"
            columns: ["supersedes_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_project_packages_supersedes_package_id_fkey"
            columns: ["supersedes_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_supersedes_package_id_fkey"
            columns: ["supersedes_package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_provisional_award_controls: {
        Row: {
          approval_id: number
          approved_result_hash: string
          asset_eligibility_status: string
          created_at: string
          final_award_minor: number
          id: number
          minor_unit_cap: number
          monthly_cycle_id: number
          ownership_status: string
          payable_status: string
          redistribution_top_up_minor: number
          retained_initial_minor: number
          run_award_id: number
          status: string
          user_id: string
        }
        Insert: {
          approval_id: number
          approved_result_hash: string
          asset_eligibility_status?: string
          created_at?: string
          final_award_minor: number
          id?: never
          minor_unit_cap: number
          monthly_cycle_id: number
          ownership_status?: string
          payable_status?: string
          redistribution_top_up_minor: number
          retained_initial_minor: number
          run_award_id: number
          status?: string
          user_id: string
        }
        Update: {
          approval_id?: number
          approved_result_hash?: string
          asset_eligibility_status?: string
          created_at?: string
          final_award_minor?: number
          id?: never
          minor_unit_cap?: number
          monthly_cycle_id?: number
          ownership_status?: string
          payable_status?: string
          redistribution_top_up_minor?: number
          retained_initial_minor?: number
          run_award_id?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_provisional_award_controls_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_controls_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_controls_run_award_id_fkey"
            columns: ["run_award_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_user_awards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_controls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_provisional_award_source_fills: {
        Row: {
          approval_id: number
          award_control_id: number | null
          canonical_minor: number
          created_at: string
          disposition_id: number
          exact_usd: number
          fill_kind: string
          id: number
          ledger_transaction_id: number
          manifest_source_id: number
          project_id: number
          user_id: string | null
        }
        Insert: {
          approval_id: number
          award_control_id?: number | null
          canonical_minor: number
          created_at?: string
          disposition_id: number
          exact_usd: number
          fill_kind: string
          id?: never
          ledger_transaction_id: number
          manifest_source_id: number
          project_id: number
          user_id?: string | null
        }
        Update: {
          approval_id?: number
          award_control_id?: number | null
          canonical_minor?: number
          created_at?: string
          disposition_id?: number
          exact_usd?: number
          fill_kind?: string
          id?: never
          ledger_transaction_id?: number
          manifest_source_id?: number
          project_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_provisional_award_source_fills_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_award_control_id_fkey"
            columns: ["award_control_id"]
            isOneToOne: false
            referencedRelation: "epoch_provisional_award_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: true
            referencedRelation: "epoch_allocation_source_dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_manifest_source_id_fkey"
            columns: ["manifest_source_id"]
            isOneToOne: false
            referencedRelation: "epoch_allocation_manifest_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_provisional_award_source_fills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_shadow_runtime_controls: {
        Row: {
          deployment_environment: string
          production_value_flow_enabled: boolean
          scheduler_enabled: boolean
        }
        Insert: {
          deployment_environment: string
          production_value_flow_enabled?: boolean
          scheduler_enabled?: boolean
        }
        Update: {
          deployment_environment?: string
          production_value_flow_enabled?: boolean
          scheduler_enabled?: boolean
        }
        Relationships: []
      }
      epoch_shadow_states: {
        Row: {
          accounting_period_id: number
          business_calendar_region: string
          carryover_complete: boolean
          created_at: string
          current_stage: string
          id: number
          is_paused: boolean
          legacy_status_snapshot: string | null
          monthly_cycle_id: number | null
          opt_out_email_delivered_at: string | null
          pause_reason: string | null
          payout_opened_at: string | null
          production_enabled: boolean
          stage_ready_at: string | null
          state_version: number
          updated_at: string
        }
        Insert: {
          accounting_period_id: number
          business_calendar_region?: string
          carryover_complete?: boolean
          created_at?: string
          current_stage?: string
          id?: never
          is_paused?: boolean
          legacy_status_snapshot?: string | null
          monthly_cycle_id?: number | null
          opt_out_email_delivered_at?: string | null
          pause_reason?: string | null
          payout_opened_at?: string | null
          production_enabled?: boolean
          stage_ready_at?: string | null
          state_version?: number
          updated_at?: string
        }
        Update: {
          accounting_period_id?: number
          business_calendar_region?: string
          carryover_complete?: boolean
          created_at?: string
          current_stage?: string
          id?: never
          is_paused?: boolean
          legacy_status_snapshot?: string | null
          monthly_cycle_id?: number | null
          opt_out_email_delivered_at?: string | null
          pause_reason?: string | null
          payout_opened_at?: string | null
          production_enabled?: boolean
          stage_ready_at?: string | null
          state_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_shadow_states_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: true
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_shadow_states_calendar_fk"
            columns: ["business_calendar_region"]
            isOneToOne: false
            referencedRelation: "epoch_business_calendars"
            referencedColumns: ["region_key"]
          },
          {
            foreignKeyName: "epoch_shadow_states_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: true
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_source_lot_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          evidence_hash: string
          exact_usd_amount: number
          id: number
          production_enabled: boolean
          source_lot_id: number
          successor_source_lot_id: number | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          evidence_hash: string
          exact_usd_amount: number
          id?: never
          production_enabled?: boolean
          source_lot_id: number
          successor_source_lot_id?: number | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          evidence_hash?: string
          exact_usd_amount?: number
          id?: never
          production_enabled?: boolean
          source_lot_id?: number
          successor_source_lot_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_source_lot_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_source_lot_events_source_lot_id_fkey"
            columns: ["source_lot_id"]
            isOneToOne: false
            referencedRelation: "epoch_funded_allocation_lock_candidates"
            referencedColumns: ["source_lot_id"]
          },
          {
            foreignKeyName: "epoch_source_lot_events_source_lot_id_fkey"
            columns: ["source_lot_id"]
            isOneToOne: false
            referencedRelation: "epoch_valuation_source_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_source_lot_events_successor_source_lot_id_fkey"
            columns: ["successor_source_lot_id"]
            isOneToOne: false
            referencedRelation: "epoch_funded_allocation_lock_candidates"
            referencedColumns: ["source_lot_id"]
          },
          {
            foreignKeyName: "epoch_source_lot_events_successor_source_lot_id_fkey"
            columns: ["successor_source_lot_id"]
            isOneToOne: false
            referencedRelation: "epoch_valuation_source_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_stage_artifacts: {
        Row: {
          artifact_hash: string
          artifact_key: string
          artifact_uri: string
          attempt_id: number
          created_at: string
          id: number
        }
        Insert: {
          artifact_hash: string
          artifact_key: string
          artifact_uri: string
          attempt_id: number
          created_at?: string
          id?: never
        }
        Update: {
          artifact_hash?: string
          artifact_key?: string
          artifact_uri?: string
          attempt_id?: number
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "epoch_stage_artifacts_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["latest_attempt_id"]
          },
          {
            foreignKeyName: "epoch_stage_artifacts_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_stage_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_stage_attempts: {
        Row: {
          actor_user_id: string | null
          attempt_sequence: number
          claim_token: string | null
          completed_at: string | null
          created_at: string
          expected_stage: string
          expected_state_version: number
          failure_code: string | null
          id: number
          idempotency_key: string
          input_manifest_hash: string
          no_external_call_under_lock: boolean
          production_enabled: boolean
          sanitized_metadata: Json
          scheduled_for: string
          shadow_state_id: number
          started_at: string | null
          status: string
          target_stage: string
          trigger_type: string
          worker_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          attempt_sequence: number
          claim_token?: string | null
          completed_at?: string | null
          created_at?: string
          expected_stage: string
          expected_state_version: number
          failure_code?: string | null
          id?: never
          idempotency_key: string
          input_manifest_hash: string
          no_external_call_under_lock?: boolean
          production_enabled?: boolean
          sanitized_metadata?: Json
          scheduled_for: string
          shadow_state_id: number
          started_at?: string | null
          status?: string
          target_stage: string
          trigger_type: string
          worker_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          attempt_sequence?: number
          claim_token?: string | null
          completed_at?: string | null
          created_at?: string
          expected_stage?: string
          expected_state_version?: number
          failure_code?: string | null
          id?: never
          idempotency_key?: string
          input_manifest_hash?: string
          no_external_call_under_lock?: boolean
          production_enabled?: boolean
          sanitized_metadata?: Json
          scheduled_for?: string
          shadow_state_id?: number
          started_at?: string | null
          status?: string
          target_stage?: string
          trigger_type?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_stage_attempts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_stage_attempts_shadow_state_id_fkey"
            columns: ["shadow_state_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["shadow_state_id"]
          },
          {
            foreignKeyName: "epoch_stage_attempts_shadow_state_id_fkey"
            columns: ["shadow_state_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_states"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_stage_gate_requirements: {
        Row: {
          expected_stage: string
          gate_key: string
          gate_type: string
          override_allowed: boolean
          target_stage: string
        }
        Insert: {
          expected_stage: string
          gate_key: string
          gate_type?: string
          override_allowed?: boolean
          target_stage: string
        }
        Update: {
          expected_stage?: string
          gate_key?: string
          gate_type?: string
          override_allowed?: boolean
          target_stage?: string
        }
        Relationships: []
      }
      epoch_stage_gate_results: {
        Row: {
          attempt_id: number
          created_at: string
          evidence_hash: string
          gate_key: string
          gate_type: string
          id: number
          override_id: number | null
          passed: boolean
          reason_code: string | null
        }
        Insert: {
          attempt_id: number
          created_at?: string
          evidence_hash: string
          gate_key: string
          gate_type: string
          id?: never
          override_id?: number | null
          passed: boolean
          reason_code?: string | null
        }
        Update: {
          attempt_id?: number
          created_at?: string
          evidence_hash?: string
          gate_key?: string
          gate_type?: string
          id?: never
          override_id?: number | null
          passed?: boolean
          reason_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_stage_gate_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["latest_attempt_id"]
          },
          {
            foreignKeyName: "epoch_stage_gate_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_stage_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_stage_gate_results_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "epoch_stage_overrides"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_stage_overrides: {
        Row: {
          actor_user_id: string
          attempt_id: number | null
          created_at: string
          evidence_hash: string
          gate_key: string
          id: number
          production_enabled: boolean
          reason: string
          shadow_state_id: number
          stage: string
        }
        Insert: {
          actor_user_id: string
          attempt_id?: number | null
          created_at?: string
          evidence_hash: string
          gate_key: string
          id?: never
          production_enabled?: boolean
          reason: string
          shadow_state_id: number
          stage: string
        }
        Update: {
          actor_user_id?: string
          attempt_id?: number | null
          created_at?: string
          evidence_hash?: string
          gate_key?: string
          id?: never
          production_enabled?: boolean
          reason?: string
          shadow_state_id?: number
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_stage_overrides_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_stage_overrides_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["latest_attempt_id"]
          },
          {
            foreignKeyName: "epoch_stage_overrides_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "epoch_stage_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_stage_overrides_shadow_state_id_fkey"
            columns: ["shadow_state_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_observability"
            referencedColumns: ["shadow_state_id"]
          },
          {
            foreignKeyName: "epoch_stage_overrides_shadow_state_id_fkey"
            columns: ["shadow_state_id"]
            isOneToOne: false
            referencedRelation: "epoch_shadow_states"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_valuation_source_lots: {
        Row: {
          base_fee_bps: number
          base_fee_exact_usd: number
          canonical_minor_unit_scale: number
          classification_status: string
          created_at: string
          custody_account_id: number
          deployment_environment: string
          deterministic_source_order: number
          distributable_exact_usd: number
          evidence_hash: string
          expires_after_cycle_id: number | null
          fee_ledger_transaction_id: number
          fee_policy_id: number
          financial_asset_id: number
          fx_difference_exact_usd: number
          fx_snapshot_id: number
          gross_exact_usd: number
          id: number
          monthly_cycle_id: number
          native_atomic_amount: number
          origin_source_lot_id: number | null
          package_id: number
          package_source_id: number | null
          production_enabled: boolean
          project_fee_assessed_once: boolean
          project_fee_bps: number
          project_fee_exact_usd: number
          project_id: number
          rail_key: string
          reserved_exact_usd: number
          source_kind: string
          source_lot_key: string
          source_position: number
          source_preliminary_exact_usd: number
          state: string
        }
        Insert: {
          base_fee_bps: number
          base_fee_exact_usd: number
          canonical_minor_unit_scale?: number
          classification_status?: string
          created_at?: string
          custody_account_id: number
          deployment_environment: string
          deterministic_source_order: number
          distributable_exact_usd: number
          evidence_hash: string
          expires_after_cycle_id?: number | null
          fee_ledger_transaction_id: number
          fee_policy_id: number
          financial_asset_id: number
          fx_difference_exact_usd: number
          fx_snapshot_id: number
          gross_exact_usd: number
          id?: never
          monthly_cycle_id: number
          native_atomic_amount: number
          origin_source_lot_id?: number | null
          package_id: number
          package_source_id?: number | null
          production_enabled?: boolean
          project_fee_assessed_once: boolean
          project_fee_bps: number
          project_fee_exact_usd: number
          project_id: number
          rail_key: string
          reserved_exact_usd?: number
          source_kind: string
          source_lot_key: string
          source_position: number
          source_preliminary_exact_usd: number
          state?: string
        }
        Update: {
          base_fee_bps?: number
          base_fee_exact_usd?: number
          canonical_minor_unit_scale?: number
          classification_status?: string
          created_at?: string
          custody_account_id?: number
          deployment_environment?: string
          deterministic_source_order?: number
          distributable_exact_usd?: number
          evidence_hash?: string
          expires_after_cycle_id?: number | null
          fee_ledger_transaction_id?: number
          fee_policy_id?: number
          financial_asset_id?: number
          fx_difference_exact_usd?: number
          fx_snapshot_id?: number
          gross_exact_usd?: number
          id?: never
          monthly_cycle_id?: number
          native_atomic_amount?: number
          origin_source_lot_id?: number | null
          package_id?: number
          package_source_id?: number | null
          production_enabled?: boolean
          project_fee_assessed_once?: boolean
          project_fee_bps?: number
          project_fee_exact_usd?: number
          project_id?: number
          rail_key?: string
          reserved_exact_usd?: number
          source_kind?: string
          source_lot_key?: string
          source_position?: number
          source_preliminary_exact_usd?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "epoch_source_lot_pair"
            columns: ["financial_asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "epoch_financial_prep_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_expires_after_cycle_id_fkey"
            columns: ["expires_after_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_fee_ledger_transaction_id_fkey"
            columns: ["fee_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_fee_ledger_transaction_id_fkey"
            columns: ["fee_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_fee_policy_id_fkey"
            columns: ["fee_policy_id"]
            isOneToOne: false
            referencedRelation: "epoch_fee_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_fx_snapshot_id_fkey"
            columns: ["fx_snapshot_id"]
            isOneToOne: false
            referencedRelation: "epoch_fx_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_origin_source_lot_id_fkey"
            columns: ["origin_source_lot_id"]
            isOneToOne: false
            referencedRelation: "epoch_funded_allocation_lock_candidates"
            referencedColumns: ["source_lot_id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_origin_source_lot_id_fkey"
            columns: ["origin_source_lot_id"]
            isOneToOne: false
            referencedRelation: "epoch_valuation_source_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_source_id_fkey"
            columns: ["package_source_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_funding_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_financial_events: {
        Row: {
          asset_id: number
          custody_account_id: number
          event_type: string
          evidence_hash: string
          id: number
          legacy_timestamp_evidence: Json
          observed_at: string
          occurred_at: string
          ordering_status: string
          production_enabled: boolean
          provider_event_id: string
          provider_key: string
          provider_sequence: number | null
          settled_native_amount: number
        }
        Insert: {
          asset_id: number
          custody_account_id: number
          event_type: string
          evidence_hash: string
          id?: never
          legacy_timestamp_evidence?: Json
          observed_at?: string
          occurred_at: string
          ordering_status: string
          production_enabled?: boolean
          provider_event_id: string
          provider_key: string
          provider_sequence?: number | null
          settled_native_amount: number
        }
        Update: {
          asset_id?: number
          custody_account_id?: number
          event_type?: string
          evidence_hash?: string
          id?: never
          legacy_timestamp_evidence?: Json
          observed_at?: string
          occurred_at?: string
          ordering_status?: string
          production_enabled?: boolean
          provider_event_id?: string
          provider_key?: string
          provider_sequence?: number | null
          settled_native_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "external_event_asset_custody_fk"
            columns: ["asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
          {
            foreignKeyName: "external_financial_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_financial_events_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_funding_applications: {
        Row: {
          applied_native_amount: number
          created_at: string
          event_id: number
          evidence_hash: string
          financial_reference_id: number
          id: number
          production_enabled: boolean
        }
        Insert: {
          applied_native_amount: number
          created_at?: string
          event_id: number
          evidence_hash: string
          financial_reference_id: number
          id?: never
          production_enabled?: boolean
        }
        Update: {
          applied_native_amount?: number
          created_at?: string
          event_id?: number
          evidence_hash?: string
          financial_reference_id?: number
          id?: never
          production_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "external_funding_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "external_financial_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_funding_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shadow_financial_reconciliation_observability"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "external_funding_applications_financial_reference_id_fkey"
            columns: ["financial_reference_id"]
            isOneToOne: false
            referencedRelation: "financial_references"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_assets: {
        Row: {
          asset_key: string
          atomic_scale: number
          classification_metadata: Json
          classification_status: string
          created_at: string
          id: number
          production_enabled: boolean
          rail_key: string
          symbol: string
        }
        Insert: {
          asset_key: string
          atomic_scale: number
          classification_metadata?: Json
          classification_status?: string
          created_at?: string
          id?: never
          production_enabled?: boolean
          rail_key: string
          symbol: string
        }
        Update: {
          asset_key?: string
          atomic_scale?: number
          classification_metadata?: Json
          classification_status?: string
          created_at?: string
          id?: never
          production_enabled?: boolean
          rail_key?: string
          symbol?: string
        }
        Relationships: []
      }
      financial_custody_accounts: {
        Row: {
          asset_id: number
          classification_metadata: Json
          classification_status: string
          created_at: string
          custody_key: string
          external_reference_hash: string
          id: number
          production_enabled: boolean
          provider_key: string
        }
        Insert: {
          asset_id: number
          classification_metadata?: Json
          classification_status?: string
          created_at?: string
          custody_key: string
          external_reference_hash: string
          id?: never
          production_enabled?: boolean
          provider_key: string
        }
        Update: {
          asset_id?: number
          classification_metadata?: Json
          classification_status?: string
          created_at?: string
          custody_key?: string
          external_reference_hash?: string
          id?: never
          production_enabled?: boolean
          provider_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_custody_accounts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cutover_canonical_links: {
        Row: {
          canonical_id: string
          canonical_type: string
          evidence_hash: string
          id: number
          ledger_transaction_id: number | null
          linked_at: string
          run_id: number
          source_record_id: number
          withdrawal_obligation_id: number | null
        }
        Insert: {
          canonical_id: string
          canonical_type: string
          evidence_hash: string
          id?: never
          ledger_transaction_id?: number | null
          linked_at?: string
          run_id: number
          source_record_id: number
          withdrawal_obligation_id?: number | null
        }
        Update: {
          canonical_id?: string
          canonical_type?: string
          evidence_hash?: string
          id?: never
          ledger_transaction_id?: number | null
          linked_at?: string
          run_id?: number
          source_record_id?: number
          withdrawal_obligation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_canonical_links_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_reconciliation_report"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_canonical_credit_reads"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_compatibility_positions"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligation_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cutover_differences: {
        Row: {
          canonical_minor: number | null
          created_at: string
          detail: Json
          difference_minor: number | null
          difference_type: string
          id: number
          legacy_minor: number | null
          run_id: number
          severity: string
          source_record_id: number
        }
        Insert: {
          canonical_minor?: number | null
          created_at?: string
          detail?: Json
          difference_minor?: number | null
          difference_type: string
          id?: never
          legacy_minor?: number | null
          run_id: number
          severity: string
          source_record_id: number
        }
        Update: {
          canonical_minor?: number | null
          created_at?: string
          detail?: Json
          difference_minor?: number | null
          difference_type?: string
          id?: never
          legacy_minor?: number | null
          run_id?: number
          severity?: string
          source_record_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_differences_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_reconciliation_report"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "financial_cutover_differences_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_differences_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cutover_instance_state: {
        Row: {
          active_run_id: number | null
          canonical_reads_enabled: boolean
          deployment_environment: string
          legacy_writes_enabled: boolean
          production_value_flow_enabled: boolean
          singleton: boolean
          state_version: number
          updated_at: string
        }
        Insert: {
          active_run_id?: number | null
          canonical_reads_enabled?: boolean
          deployment_environment?: string
          legacy_writes_enabled?: boolean
          production_value_flow_enabled?: boolean
          singleton?: boolean
          state_version?: number
          updated_at?: string
        }
        Update: {
          active_run_id?: number | null
          canonical_reads_enabled?: boolean
          deployment_environment?: string
          legacy_writes_enabled?: boolean
          production_value_flow_enabled?: boolean
          singleton?: boolean
          state_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_instance_state_active_run_id_fkey"
            columns: ["active_run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_reconciliation_report"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "financial_cutover_instance_state_active_run_id_fkey"
            columns: ["active_run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_instance_state_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      financial_cutover_runs: {
        Row: {
          activated_at: string | null
          actor_user_id: string
          blocker_count: number
          canonical_minor_total: number
          command_hash: string
          contract_version: string
          deployment_environment: string
          evidence_hash: string
          id: number
          idempotency_key: string
          legacy_minor_total: number
          manifest_hash: string | null
          prepared_at: string
          production_enabled: boolean
          rolled_back_at: string | null
          source_count: number
          status: string
          warning_count: number
        }
        Insert: {
          activated_at?: string | null
          actor_user_id: string
          blocker_count?: number
          canonical_minor_total?: number
          command_hash: string
          contract_version?: string
          deployment_environment: string
          evidence_hash: string
          id?: never
          idempotency_key: string
          legacy_minor_total?: number
          manifest_hash?: string | null
          prepared_at?: string
          production_enabled?: boolean
          rolled_back_at?: string | null
          source_count?: number
          status?: string
          warning_count?: number
        }
        Update: {
          activated_at?: string | null
          actor_user_id?: string
          blocker_count?: number
          canonical_minor_total?: number
          command_hash?: string
          contract_version?: string
          deployment_environment?: string
          evidence_hash?: string
          id?: never
          idempotency_key?: string
          legacy_minor_total?: number
          manifest_hash?: string | null
          prepared_at?: string
          production_enabled?: boolean
          rolled_back_at?: string | null
          source_count?: number
          status?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_runs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_cutover_runs_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      financial_cutover_runtime_controls: {
        Row: {
          activation_enabled: boolean
          deployment_environment: string
          prepare_enabled: boolean
          production_value_flow_enabled: boolean
          updated_at: string
        }
        Insert: {
          activation_enabled?: boolean
          deployment_environment: string
          prepare_enabled?: boolean
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Update: {
          activation_enabled?: boolean
          deployment_environment?: string
          prepare_enabled?: boolean
          production_value_flow_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      financial_cutover_source_records: {
        Row: {
          classification: string
          classification_evidence_hash: string
          created_at: string
          currency_code: string | null
          id: number
          legacy_minor: number | null
          monthly_cycle_id: number | null
          project_id: number | null
          run_id: number
          source_hash: string
          source_id: string
          source_snapshot: Json
          source_type: string
          user_id: string | null
        }
        Insert: {
          classification: string
          classification_evidence_hash: string
          created_at?: string
          currency_code?: string | null
          id?: never
          legacy_minor?: number | null
          monthly_cycle_id?: number | null
          project_id?: number | null
          run_id: number
          source_hash: string
          source_id: string
          source_snapshot: Json
          source_type: string
          user_id?: string | null
        }
        Update: {
          classification?: string
          classification_evidence_hash?: string
          created_at?: string
          currency_code?: string | null
          id?: never
          legacy_minor?: number | null
          monthly_cycle_id?: number | null
          project_id?: number | null
          run_id?: number
          source_hash?: string
          source_id?: string
          source_snapshot?: Json
          source_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_source_records_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_reconciliation_report"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      financial_cutover_state_events: {
        Row: {
          actor_user_id: string
          detail: Json
          event_type: string
          evidence_hash: string
          id: number
          recorded_at: string
          run_id: number
        }
        Insert: {
          actor_user_id: string
          detail?: Json
          event_type: string
          evidence_hash: string
          id?: never
          recorded_at?: string
          run_id: number
        }
        Update: {
          actor_user_id?: string
          detail?: Json
          event_type?: string
          evidence_hash?: string
          id?: never
          recorded_at?: string
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_state_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_cutover_state_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_reconciliation_report"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "financial_cutover_state_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_references: {
        Row: {
          asset_id: number
          classification_status: string
          created_at: string
          custody_account_id: number
          evidence_hash: string
          id: number
          native_atomic_limit: number
          production_enabled: boolean
          reference_key: string
          reference_type: string
        }
        Insert: {
          asset_id: number
          classification_status?: string
          created_at?: string
          custody_account_id: number
          evidence_hash: string
          id?: never
          native_atomic_limit: number
          production_enabled?: boolean
          reference_key: string
          reference_type: string
        }
        Update: {
          asset_id?: number
          classification_status?: string
          created_at?: string
          custody_account_id?: number
          evidence_hash?: string
          id?: never
          native_atomic_limit?: number
          production_enabled?: boolean
          reference_key?: string
          reference_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_references_asset_custody_fkey"
            columns: ["asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
          {
            foreignKeyName: "financial_references_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_references_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_runtime_controls: {
        Row: {
          deployment_environment: string
          neutral_posting_enabled: boolean
          production_value_flow_enabled: boolean
          professional_approval_reference: string | null
          updated_at: string
        }
        Insert: {
          deployment_environment: string
          neutral_posting_enabled?: boolean
          production_value_flow_enabled?: boolean
          professional_approval_reference?: string | null
          updated_at?: string
        }
        Update: {
          deployment_environment?: string
          neutral_posting_enabled?: boolean
          production_value_flow_enabled?: boolean
          professional_approval_reference?: string | null
          updated_at?: string
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
      ledger_accounts: {
        Row: {
          account_key: string
          created_at: string
          id: number
          normal_balance: string
          production_enabled: boolean
          provisional_classification_key: string
          required_dimensions: Json
          review_posting_enabled: boolean
        }
        Insert: {
          account_key: string
          created_at?: string
          id?: never
          normal_balance: string
          production_enabled?: boolean
          provisional_classification_key: string
          required_dimensions?: Json
          review_posting_enabled?: boolean
        }
        Update: {
          account_key?: string
          created_at?: string
          id?: never
          normal_balance?: string
          production_enabled?: boolean
          provisional_classification_key?: string
          required_dimensions?: Json
          review_posting_enabled?: boolean
        }
        Relationships: []
      }
      ledger_postings: {
        Row: {
          account_id: number
          asset_id: number | null
          created_at: string
          custody_account_id: number | null
          functional_usd_amount: number
          fx_usd_per_unit: number | null
          id: number
          native_atomic_amount: number | null
          project_id: number | null
          sequence_no: number
          side: string
          transaction_id: number
          user_id: string | null
        }
        Insert: {
          account_id: number
          asset_id?: number | null
          created_at?: string
          custody_account_id?: number | null
          functional_usd_amount: number
          fx_usd_per_unit?: number | null
          id?: never
          native_atomic_amount?: number | null
          project_id?: number | null
          sequence_no: number
          side: string
          transaction_id: number
          user_id?: string | null
        }
        Update: {
          account_id?: number
          asset_id?: number | null
          created_at?: string
          custody_account_id?: number | null
          functional_usd_amount?: number
          fx_usd_per_unit?: number | null
          id?: never
          native_atomic_amount?: number | null
          project_id?: number | null
          sequence_no?: number
          side?: string
          transaction_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "ledger_postings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          accounting_period_id: number
          actor_type: string
          actor_user_id: string | null
          classification_status: string
          command_hash: string
          contract_version: string
          deployment_environment: string
          effective_at: string
          evidence_hash: string
          financial_reference_id: number | null
          id: number
          idempotency_key: string
          recorded_at: string
          reversal_of_transaction_id: number | null
          transaction_type: string
        }
        Insert: {
          accounting_period_id: number
          actor_type: string
          actor_user_id?: string | null
          classification_status?: string
          command_hash: string
          contract_version?: string
          deployment_environment: string
          effective_at: string
          evidence_hash: string
          financial_reference_id?: number | null
          id?: never
          idempotency_key: string
          recorded_at?: string
          reversal_of_transaction_id?: number | null
          transaction_type: string
        }
        Update: {
          accounting_period_id?: number
          actor_type?: string
          actor_user_id?: string | null
          classification_status?: string
          command_hash?: string
          contract_version?: string
          deployment_environment?: string
          effective_at?: string
          evidence_hash?: string
          financial_reference_id?: number | null
          id?: never
          idempotency_key?: string
          recorded_at?: string
          reversal_of_transaction_id?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ledger_transactions_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "ledger_transactions_financial_reference_id_fkey"
            columns: ["financial_reference_id"]
            isOneToOne: false
            referencedRelation: "financial_references"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
        ]
      }
      legal_acceptance_records: {
        Row: {
          accepted_at: string
          actor_capacity: string
          actor_user_id: string
          content_hash: string
          created_at: string
          document_identifier: string
          document_status: string
          document_version_id: string
          id: string
          locale: string
          source_surface: string
        }
        Insert: {
          accepted_at?: string
          actor_capacity: string
          actor_user_id: string
          content_hash: string
          created_at?: string
          document_identifier: string
          document_status: string
          document_version_id: string
          id?: string
          locale: string
          source_surface: string
        }
        Update: {
          accepted_at?: string
          actor_capacity?: string
          actor_user_id?: string
          content_hash?: string
          created_at?: string
          document_identifier?: string
          document_status?: string
          document_version_id?: string
          id?: string
          locale?: string
          source_surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptance_records_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "legal_acceptance_records_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          approved_at: string | null
          content_hash: string
          created_at: string
          document_identifier: string
          document_kind: string
          effective_at: string | null
          id: string
          locale: string
          status: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          content_hash: string
          created_at?: string
          document_identifier: string
          document_kind: string
          effective_at?: string | null
          id?: string
          locale: string
          status: string
          version: string
        }
        Update: {
          approved_at?: string | null
          content_hash?: string
          created_at?: string
          document_identifier?: string
          document_kind?: string
          effective_at?: string | null
          id?: string
          locale?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      monthly_cycle_allocation_asset_fills: {
        Row: {
          asset_code: string
          asset_type: string
          created_at: string
          id: number
          monthly_cycle_id: number
          partial: boolean
          pool_id: string
          preference_rank: number
          project_id: number
          run_id: number
          source_amount: number
          usd_value: number
          user_id: string
        }
        Insert: {
          asset_code: string
          asset_type: string
          created_at?: string
          id?: number
          monthly_cycle_id: number
          partial?: boolean
          pool_id: string
          preference_rank: number
          project_id: number
          run_id: number
          source_amount: number
          usd_value: number
          user_id: string
        }
        Update: {
          asset_code?: string
          asset_type?: string
          created_at?: string
          id?: number
          monthly_cycle_id?: number
          partial?: boolean
          pool_id?: string
          preference_rank?: number
          project_id?: number
          run_id?: number
          source_amount?: number
          usd_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_allocation_asset_fills_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_asset_fills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_asset_fills_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_asset_fills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_cycle_allocation_project_results: {
        Row: {
          attribution_points: number
          created_at: string
          id: number
          monthly_cycle_id: number
          project_id: number
          project_pool_usd: number
          raw_usd: number
          run_id: number
          scoped_cubid_id: string
          total_project_points: number
          user_id: string
        }
        Insert: {
          attribution_points: number
          created_at?: string
          id?: number
          monthly_cycle_id: number
          project_id: number
          project_pool_usd: number
          raw_usd: number
          run_id: number
          scoped_cubid_id: string
          total_project_points: number
          user_id: string
        }
        Update: {
          attribution_points?: number
          created_at?: string
          id?: number
          monthly_cycle_id?: number
          project_id?: number
          project_pool_usd?: number
          raw_usd?: number
          run_id?: number
          scoped_cubid_id?: string
          total_project_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_allocation_project_results_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_project_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_project_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_project_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_cycle_allocation_returned_pools: {
        Row: {
          asset_code: string
          asset_type: string
          created_at: string
          id: number
          monthly_cycle_id: number
          pool_id: string
          project_id: number
          reason_code: string
          run_id: number
          source_amount: number
          usd_value: number
        }
        Insert: {
          asset_code: string
          asset_type: string
          created_at?: string
          id?: number
          monthly_cycle_id: number
          pool_id: string
          project_id: number
          reason_code: string
          run_id: number
          source_amount: number
          usd_value: number
        }
        Update: {
          asset_code?: string
          asset_type?: string
          created_at?: string
          id?: number
          monthly_cycle_id?: number
          pool_id?: string
          project_id?: number
          reason_code?: string
          run_id?: number
          source_amount?: number
          usd_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_allocation_returned_pools_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_returned_pools_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_allocation_returned_pools_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cycle_bookkeeping_credits: {
        Row: {
          allocation_breakdown: Json
          asset_fills: Json
          created_at: string
          credited_at: string
          credited_by_user_id: string | null
          currency_code: string
          id: number
          idempotency_key: string
          monthly_cycle_id: number
          payment_status: string
          run_id: number
          source_breakdown: Json
          source_result_id: number
          status: string
          updated_at: string
          usd_equivalent_amount: number
          user_id: string
        }
        Insert: {
          allocation_breakdown?: Json
          asset_fills?: Json
          created_at?: string
          credited_at?: string
          credited_by_user_id?: string | null
          currency_code?: string
          id?: number
          idempotency_key: string
          monthly_cycle_id: number
          payment_status?: string
          run_id: number
          source_breakdown?: Json
          source_result_id: number
          status?: string
          updated_at?: string
          usd_equivalent_amount: number
          user_id: string
        }
        Update: {
          allocation_breakdown?: Json
          asset_fills?: Json
          created_at?: string
          credited_at?: string
          credited_by_user_id?: string | null
          currency_code?: string
          id?: number
          idempotency_key?: string
          monthly_cycle_id?: number
          payment_status?: string
          run_id?: number
          source_breakdown?: Json
          source_result_id?: number
          status?: string
          updated_at?: string
          usd_equivalent_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_credited_by_user_id_fkey"
            columns: ["credited_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_source_result_id_fkey"
            columns: ["source_result_id"]
            isOneToOne: false
            referencedRelation: "zkas_run_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_cycle_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          attempt_id: string
          created_at: string
          cycle_key: string
          event_type: string
          id: number
          message: string | null
          metadata: Json
          monthly_cycle_id: number | null
          outcome: string
          severity: string
        }
        Insert: {
          actor_role: string
          actor_user_id?: string | null
          attempt_id: string
          created_at?: string
          cycle_key: string
          event_type: string
          id?: number
          message?: string | null
          metadata?: Json
          monthly_cycle_id?: number | null
          outcome: string
          severity?: string
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          attempt_id?: string
          created_at?: string
          cycle_key?: string
          event_type?: string
          id?: number
          message?: string | null
          metadata?: Json
          monthly_cycle_id?: number | null
          outcome?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_cycle_events_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cycle_reports: {
        Row: {
          artifact_bucket: string
          artifact_hash: string | null
          artifact_mime_type: string | null
          artifact_path: string | null
          audience: Database["public"]["Enums"]["monthly_cycle_report_audience"]
          created_at: string
          created_by_user_id: string | null
          id: number
          monthly_cycle_id: number
          payload: Json
          published_at: string
          subject_project_id: number | null
          subject_user_id: string | null
          summary: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          artifact_bucket?: string
          artifact_hash?: string | null
          artifact_mime_type?: string | null
          artifact_path?: string | null
          audience: Database["public"]["Enums"]["monthly_cycle_report_audience"]
          created_at?: string
          created_by_user_id?: string | null
          id?: number
          monthly_cycle_id: number
          payload?: Json
          published_at?: string
          subject_project_id?: number | null
          subject_user_id?: string | null
          summary?: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          artifact_bucket?: string
          artifact_hash?: string | null
          artifact_mime_type?: string | null
          artifact_path?: string | null
          audience?: Database["public"]["Enums"]["monthly_cycle_report_audience"]
          created_at?: string
          created_by_user_id?: string | null
          id?: number
          monthly_cycle_id?: number
          payload?: Json
          published_at?: string
          subject_project_id?: number | null
          subject_user_id?: string | null
          summary?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_reports_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_cycle_reports_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_reports_subject_project_id_fkey"
            columns: ["subject_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_reports_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_cycle_reports_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_cycles: {
        Row: {
          approval_started_at: string | null
          calculation_started_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          cycle_key: string
          distribution_started_at: string | null
          id: number
          lock_override_reason: string | null
          lock_override_unresolved_onchain: boolean
          locked_at: string | null
          locked_by_user_id: string | null
          locked_manifest: Json | null
          locked_manifest_hash: string | null
          month: number
          opened_at: string
          operator_note: string | null
          period_end: string
          period_start: string
          prep_started_at: string | null
          reporting_published_at: string | null
          status: Database["public"]["Enums"]["monthly_cycle_status"]
          status_note: string | null
          updated_at: string
          updated_by_user_id: string | null
          verification_started_at: string | null
          year: number
        }
        Insert: {
          approval_started_at?: string | null
          calculation_started_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          cycle_key: string
          distribution_started_at?: string | null
          id?: number
          lock_override_reason?: string | null
          lock_override_unresolved_onchain?: boolean
          locked_at?: string | null
          locked_by_user_id?: string | null
          locked_manifest?: Json | null
          locked_manifest_hash?: string | null
          month: number
          opened_at?: string
          operator_note?: string | null
          period_end: string
          period_start: string
          prep_started_at?: string | null
          reporting_published_at?: string | null
          status?: Database["public"]["Enums"]["monthly_cycle_status"]
          status_note?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          verification_started_at?: string | null
          year: number
        }
        Update: {
          approval_started_at?: string | null
          calculation_started_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          cycle_key?: string
          distribution_started_at?: string | null
          id?: number
          lock_override_reason?: string | null
          lock_override_unresolved_onchain?: boolean
          locked_at?: string | null
          locked_by_user_id?: string | null
          locked_manifest?: Json | null
          locked_manifest_hash?: string | null
          month?: number
          opened_at?: string
          operator_note?: string | null
          period_end?: string
          period_start?: string
          prep_started_at?: string | null
          reporting_published_at?: string | null
          status?: Database["public"]["Enums"]["monthly_cycle_status"]
          status_note?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          verification_started_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycles_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_cycles_locked_by_user_id_fkey"
            columns: ["locked_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "monthly_cycles_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
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
          intake_contract_address: string
          intake_contract_id: number
          intake_treasury_address: string
          last_checked_at: string | null
          matched_log_index: number | null
          metadata: Json | null
          monthly_cycle_id: number | null
          payment_id: number | null
          payment_method_id: number
          period_id: number
          project_id: number
          receipt: Json | null
          reconciled_at: string | null
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
          intake_contract_address: string
          intake_contract_id: number
          intake_treasury_address: string
          last_checked_at?: string | null
          matched_log_index?: number | null
          metadata?: Json | null
          monthly_cycle_id?: number | null
          payment_id?: number | null
          payment_method_id: number
          period_id: number
          project_id: number
          receipt?: Json | null
          reconciled_at?: string | null
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
          intake_contract_address?: string
          intake_contract_id?: number
          intake_treasury_address?: string
          last_checked_at?: string | null
          matched_log_index?: number | null
          metadata?: Json | null
          monthly_cycle_id?: number | null
          payment_id?: number | null
          payment_method_id?: number
          period_id?: number
          project_id?: number
          receipt?: Json | null
          reconciled_at?: string | null
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
            foreignKeyName: "onchain_payment_submissions_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
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
            foreignKeyName: "payments_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
      payout_batch_items: {
        Row: {
          amount_usd: number
          created_at: string
          id: number
          payout_batch_id: number
          payout_intent_id: number
          position: number
          status: Database["public"]["Enums"]["payout_intent_status"]
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: number
          payout_batch_id: number
          payout_intent_id: number
          position?: number
          status?: Database["public"]["Enums"]["payout_intent_status"]
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: number
          payout_batch_id?: number
          payout_intent_id?: number
          position?: number
          status?: Database["public"]["Enums"]["payout_intent_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payout_batch_items_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_payout_intent_id_fkey"
            columns: ["payout_intent_id"]
            isOneToOne: true
            referencedRelation: "payout_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batches: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          execution_payload: Json
          execution_reference: string | null
          id: number
          intent_count: number
          monthly_cycle_id: number
          rail: Database["public"]["Enums"]["payout_rail"]
          status: Database["public"]["Enums"]["payout_batch_status"]
          total_amount_usd: number
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          execution_payload?: Json
          execution_reference?: string | null
          id?: number
          intent_count?: number
          monthly_cycle_id: number
          rail: Database["public"]["Enums"]["payout_rail"]
          status?: Database["public"]["Enums"]["payout_batch_status"]
          total_amount_usd?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          execution_payload?: Json
          execution_reference?: string | null
          id?: number
          intent_count?: number
          monthly_cycle_id?: number
          rail?: Database["public"]["Enums"]["payout_rail"]
          status?: Database["public"]["Enums"]["payout_batch_status"]
          total_amount_usd?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_batches_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_batches_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batches_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payout_execution_attempts: {
        Row: {
          attempt_no: number
          created_at: string
          destination_hash: string
          financial_asset_id: number
          id: number
          payout_intent_id: number
          production_enabled: boolean
          provider_reference: string | null
          rail_key: string
          request_hash: string
          status: string
          withdrawal_request_id: string
        }
        Insert: {
          attempt_no: number
          created_at?: string
          destination_hash: string
          financial_asset_id: number
          id?: never
          payout_intent_id: number
          production_enabled?: boolean
          provider_reference?: string | null
          rail_key: string
          request_hash: string
          status?: string
          withdrawal_request_id: string
        }
        Update: {
          attempt_no?: number
          created_at?: string
          destination_hash?: string
          financial_asset_id?: number
          id?: never
          payout_intent_id?: number
          production_enabled?: boolean
          provider_reference?: string | null
          rail_key?: string
          request_hash?: string
          status?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_execution_attempts_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_execution_attempts_payout_intent_id_fkey"
            columns: ["payout_intent_id"]
            isOneToOne: false
            referencedRelation: "payout_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_execution_attempts_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_intents: {
        Row: {
          amount_usd: number
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          fee_amount_usd: number | null
          financial_asset_id: number | null
          id: number
          idempotency_key: string
          monthly_cycle_id: number
          native_atomic_amount: number | null
          payout_route_id: number | null
          rail: Database["public"]["Enums"]["payout_rail"] | null
          source_result_id: number | null
          status: Database["public"]["Enums"]["payout_intent_status"]
          status_reason: string | null
          updated_at: string
          updated_by_user_id: string | null
          user_fee_bps: number | null
          user_id: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          fee_amount_usd?: number | null
          financial_asset_id?: number | null
          id?: number
          idempotency_key: string
          monthly_cycle_id: number
          native_atomic_amount?: number | null
          payout_route_id?: number | null
          rail?: Database["public"]["Enums"]["payout_rail"] | null
          source_result_id?: number | null
          status?: Database["public"]["Enums"]["payout_intent_status"]
          status_reason?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_fee_bps?: number | null
          user_id: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          fee_amount_usd?: number | null
          financial_asset_id?: number | null
          id?: number
          idempotency_key?: string
          monthly_cycle_id?: number
          native_atomic_amount?: number | null
          payout_route_id?: number | null
          rail?: Database["public"]["Enums"]["payout_rail"] | null
          source_result_id?: number | null
          status?: Database["public"]["Enums"]["payout_intent_status"]
          status_reason?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_fee_bps?: number | null
          user_id?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_intents_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_intents_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_intents_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_intents_payout_route_id_fkey"
            columns: ["payout_route_id"]
            isOneToOne: false
            referencedRelation: "user_payout_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_intents_source_result_id_fkey"
            columns: ["source_result_id"]
            isOneToOne: false
            referencedRelation: "zkas_published_user_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_intents_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_intents_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_inventory_lots: {
        Row: {
          canonical_minor_total: number
          created_at: string
          custody_account_id: number
          deterministic_sequence: number
          evidence_hash: string
          expires_after_cycle_id: number | null
          financial_asset_id: number
          fx_snapshot_id: number
          id: number
          legacy_inventory_key: string | null
          monthly_cycle_id: number
          native_atomic_total: number
          obligation_id: number
          production_enabled: boolean
          project_id: number
          rail_key: string
          source_fill_id: number | null
          status: string
          user_id: string
        }
        Insert: {
          canonical_minor_total: number
          created_at?: string
          custody_account_id: number
          deterministic_sequence: number
          evidence_hash: string
          expires_after_cycle_id?: number | null
          financial_asset_id: number
          fx_snapshot_id: number
          id?: never
          legacy_inventory_key?: string | null
          monthly_cycle_id: number
          native_atomic_total: number
          obligation_id: number
          production_enabled?: boolean
          project_id: number
          rail_key: string
          source_fill_id?: number | null
          status?: string
          user_id: string
        }
        Update: {
          canonical_minor_total?: number
          created_at?: string
          custody_account_id?: number
          deterministic_sequence?: number
          evidence_hash?: string
          expires_after_cycle_id?: number | null
          financial_asset_id?: number
          fx_snapshot_id?: number
          id?: never
          legacy_inventory_key?: string | null
          monthly_cycle_id?: number
          native_atomic_total?: number
          obligation_id?: number
          production_enabled?: boolean
          project_id?: number
          rail_key?: string
          source_fill_id?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_inventory_lots_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_expires_after_cycle_id_fkey"
            columns: ["expires_after_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_fx_snapshot_id_fkey"
            columns: ["fx_snapshot_id"]
            isOneToOne: false
            referencedRelation: "epoch_fx_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_canonical_credit_reads"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_compatibility_positions"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligation_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_source_fill_id_fkey"
            columns: ["source_fill_id"]
            isOneToOne: true
            referencedRelation: "epoch_provisional_award_source_fills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_inventory_pair"
            columns: ["financial_asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
        ]
      }
      payout_inventory_reservations: {
        Row: {
          expires_at: string
          id: number
          inventory_lot_id: number
          native_atomic_amount: number
          originating_fx_snapshot_id: number
          released_at: string | null
          reserved_at: string
          reserved_minor: number
          sequence_no: number
          status: string
          withdrawal_request_id: string
        }
        Insert: {
          expires_at: string
          id?: never
          inventory_lot_id: number
          native_atomic_amount: number
          originating_fx_snapshot_id: number
          released_at?: string | null
          reserved_at?: string
          reserved_minor: number
          sequence_no: number
          status?: string
          withdrawal_request_id: string
        }
        Update: {
          expires_at?: string
          id?: never
          inventory_lot_id?: number
          native_atomic_amount?: number
          originating_fx_snapshot_id?: number
          released_at?: string | null
          reserved_at?: string
          reserved_minor?: number
          sequence_no?: number
          status?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_inventory_reservations_inventory_lot_id_fkey"
            columns: ["inventory_lot_id"]
            isOneToOne: false
            referencedRelation: "payout_inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_reservations_originating_fx_snapshot_id_fkey"
            columns: ["originating_fx_snapshot_id"]
            isOneToOne: false
            referencedRelation: "epoch_fx_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_reservations_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_reconciliation_events: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          external_reference: string | null
          id: number
          metadata: Json
          note: string | null
          observed_amount_usd: number | null
          payout_batch_id: number | null
          payout_intent_id: number | null
          rail: Database["public"]["Enums"]["payout_rail"] | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["payout_reconciliation_status"]
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          external_reference?: string | null
          id?: number
          metadata?: Json
          note?: string | null
          observed_amount_usd?: number | null
          payout_batch_id?: number | null
          payout_intent_id?: number | null
          rail?: Database["public"]["Enums"]["payout_rail"] | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["payout_reconciliation_status"]
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          external_reference?: string | null
          id?: number
          metadata?: Json
          note?: string | null
          observed_amount_usd?: number | null
          payout_batch_id?: number | null
          payout_intent_id?: number | null
          rail?: Database["public"]["Enums"]["payout_rail"] | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["payout_reconciliation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payout_reconciliation_events_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_reconciliation_events_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reconciliation_events_payout_intent_id_fkey"
            columns: ["payout_intent_id"]
            isOneToOne: false
            referencedRelation: "payout_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_publication_consents: {
        Row: {
          action: string
          content_hash: string
          created_at: string
          document_identifier: string
          document_status: string
          document_version_id: string
          fields: Json
          id: string
          locale: string
          recorded_at: string
          source_surface: string
          user_id: string
        }
        Insert: {
          action: string
          content_hash: string
          created_at?: string
          document_identifier: string
          document_status: string
          document_version_id: string
          fields?: Json
          id?: string
          locale: string
          recorded_at?: string
          source_surface: string
          user_id: string
        }
        Update: {
          action?: string
          content_hash?: string
          created_at?: string
          document_identifier?: string
          document_status?: string
          document_version_id?: string
          fields?: Json
          id?: string
          locale?: string
          recorded_at?: string
          source_surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_publication_consents_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_publication_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_attribution_datasets: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          id: number
          monthly_cycle_id: number
          note: string | null
          project_id: number
          proof_artifact_uri: string | null
          proof_type: string | null
          rejected_at: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          row_count: number
          status: string
          submitted_at: string
          submitted_by_user_id: string | null
          total_attribution_points: number
          updated_at: string
          verification_status: string | null
          verifier_backend: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: number
          monthly_cycle_id: number
          note?: string | null
          project_id: number
          proof_artifact_uri?: string | null
          proof_type?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          row_count?: number
          status?: string
          submitted_at?: string
          submitted_by_user_id?: string | null
          total_attribution_points?: number
          updated_at?: string
          verification_status?: string | null
          verifier_backend?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: number
          monthly_cycle_id?: number
          note?: string | null
          project_id?: number
          proof_artifact_uri?: string | null
          proof_type?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          row_count?: number
          status?: string
          submitted_at?: string
          submitted_by_user_id?: string | null
          total_attribution_points?: number
          updated_at?: string
          verification_status?: string | null
          verifier_backend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attribution_datasets_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_attribution_datasets_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attribution_datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attribution_datasets_rejected_by_user_id_fkey"
            columns: ["rejected_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_attribution_datasets_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_attribution_rows: {
        Row: {
          attribution_points: number
          category: string | null
          created_at: string
          dataset_id: number
          evidence_reference: string | null
          id: number
          monthly_cycle_id: number
          notes: string | null
          project_id: number
          resolution_message: string | null
          resolution_status: string
          row_index: number
          scoped_cubid_id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          attribution_points: number
          category?: string | null
          created_at?: string
          dataset_id: number
          evidence_reference?: string | null
          id?: number
          monthly_cycle_id: number
          notes?: string | null
          project_id: number
          resolution_message?: string | null
          resolution_status?: string
          row_index: number
          scoped_cubid_id: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          attribution_points?: number
          category?: string | null
          created_at?: string
          dataset_id?: number
          evidence_reference?: string | null
          id?: number
          monthly_cycle_id?: number
          notes?: string | null
          project_id?: number
          resolution_message?: string | null
          resolution_status?: string
          row_index?: number
          scoped_cubid_id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attribution_rows_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "project_attribution_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attribution_rows_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attribution_rows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attribution_rows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
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
      project_compliance_snapshots: {
        Row: {
          evidence_hash: string
          id: number
          kyb_status: string
          kyc_status: string
          monthly_cycle_id: number
          production_enabled: boolean
          project_id: number
          recorded_at: string
          recorded_by_user_id: string
          sanctions_status: string
          valid_until: string
          version: number
        }
        Insert: {
          evidence_hash: string
          id?: never
          kyb_status: string
          kyc_status: string
          monthly_cycle_id: number
          production_enabled?: boolean
          project_id: number
          recorded_at?: string
          recorded_by_user_id: string
          sanctions_status: string
          valid_until: string
          version: number
        }
        Update: {
          evidence_hash?: string
          id?: never
          kyb_status?: string
          kyc_status?: string
          monthly_cycle_id?: number
          production_enabled?: boolean
          project_id?: number
          recorded_at?: string
          recorded_by_user_id?: string
          sanctions_status?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_compliance_snapshots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_snapshots_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_invitation_acceptance_evidence: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          invitation_id: string
          policy_content_hash: string
          policy_document_identifier: string
          policy_document_version_id: string
          policy_locale: string
          policy_status: string
          project_id: number
          recorded_at: string
          shared_profile_fields: Json
          source_surface: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          invitation_id: string
          policy_content_hash: string
          policy_document_identifier: string
          policy_document_version_id: string
          policy_locale: string
          policy_status: string
          project_id: number
          recorded_at?: string
          shared_profile_fields: Json
          source_surface?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          invitation_id?: string
          policy_content_hash?: string
          policy_document_identifier?: string
          policy_document_version_id?: string
          policy_locale?: string
          policy_status?: string
          project_id?: number
          recorded_at?: string
          shared_profile_fields?: Json
          source_surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitation_acceptance_e_policy_document_version_id_fkey"
            columns: ["policy_document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitation_acceptance_evidence_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_invitation_acceptance_evidence_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "project_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitation_acceptance_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitation_membership_provenance: {
        Row: {
          created_at: string
          created_by_invitation: boolean
          organization_id: number
          previous_deleted_at: string | null
          previous_status:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_invitation: boolean
          organization_id: number
          previous_deleted_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_invitation?: boolean
          organization_id?: number
          previous_deleted_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitation_membership_provenance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitation_membership_provenance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_invitation_participant_provenance: {
        Row: {
          created_at: string
          created_by_invitation: boolean
          previous_is_admin: boolean | null
          previous_is_favorite: boolean | null
          project_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_invitation: boolean
          previous_is_admin?: boolean | null
          previous_is_favorite?: boolean | null
          project_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_invitation?: boolean
          previous_is_admin?: boolean | null
          previous_is_favorite?: boolean | null
          project_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitation_participant_provenance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitation_participant_provenance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          expires_at: string
          id: string
          idempotency_key: string
          invited_role: string
          invitee_email: string
          organization_id: number
          organization_membership_change: string | null
          organization_membership_previous_deleted_at: string | null
          organization_membership_previous_status:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          policy_content_hash: string
          policy_document_identifier: string
          policy_document_version_id: string
          policy_locale: string
          policy_status: string
          project_id: number
          shared_profile_fields: Json
          status: string
          token_digest: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          expires_at: string
          id?: string
          idempotency_key: string
          invited_role?: string
          invitee_email: string
          organization_id: number
          organization_membership_change?: string | null
          organization_membership_previous_deleted_at?: string | null
          organization_membership_previous_status?:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          policy_content_hash: string
          policy_document_identifier: string
          policy_document_version_id: string
          policy_locale: string
          policy_status: string
          project_id: number
          shared_profile_fields?: Json
          status?: string
          token_digest: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          invited_role?: string
          invitee_email?: string
          organization_id?: number
          organization_membership_change?: string | null
          organization_membership_previous_deleted_at?: string | null
          organization_membership_previous_status?:
            | Database["public"]["Enums"]["organization_members_status"]
            | null
          policy_content_hash?: string
          policy_document_identifier?: string
          policy_document_version_id?: string
          policy_locale?: string
          policy_status?: string
          project_id?: number
          shared_profile_fields?: Json
          status?: string
          token_digest?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_invitations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_policy_document_version_id_fkey"
            columns: ["policy_document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_monthly_contribution_submissions: {
        Row: {
          calculated_contribution_amount: number
          commitment_percentage: number
          id: number
          monthly_cycle_id: number
          notes: string | null
          period_end: string
          period_start: string
          project_id: number
          source_amount: number
          source_currency_code: string
          source_reference: string | null
          status: string
          submitted_at: string
          submitted_by_user_id: string | null
          updated_at: string
          usd_equivalent_amount: number
        }
        Insert: {
          calculated_contribution_amount: number
          commitment_percentage: number
          id?: number
          monthly_cycle_id: number
          notes?: string | null
          period_end: string
          period_start: string
          project_id: number
          source_amount: number
          source_currency_code: string
          source_reference?: string | null
          status?: string
          submitted_at?: string
          submitted_by_user_id?: string | null
          updated_at?: string
          usd_equivalent_amount: number
        }
        Update: {
          calculated_contribution_amount?: number
          commitment_percentage?: number
          id?: number
          monthly_cycle_id?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          project_id?: number
          source_amount?: number
          source_currency_code?: string
          source_reference?: string | null
          status?: string
          submitted_at?: string
          submitted_by_user_id?: string | null
          updated_at?: string
          usd_equivalent_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_monthly_contribution_submissi_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_monthly_contribution_submissions_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_monthly_contribution_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      project_stats_monthly: {
        Row: {
          actual_percentage: number | null
          contributed_amount: number
          created_at: string | null
          id: number
          month: number | null
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
          monthly_revenue?: number
          pledged_percentage?: number | null
          project_id?: number
          unique_user_count?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stats_monthly_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
      projects: {
        Row: {
          billing_email: string | null
          billing_frequency: string | null
          category_id: number | null
          created_at: string | null
          cumulative_donated: number | null
          cumulative_revenue: number | null
          default_payment_method_id: number | null
          default_reporting_currency_code: string
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
          default_reporting_currency_code?: string
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
          default_reporting_currency_code?: string
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
      shadow_close_packages: {
        Row: {
          accounting_period_id: number
          created_at: string
          id: number
          outside_tolerance_count: number
          production_enabled: boolean
          reconciliation_hash: string | null
          status: string
          trial_balance_hash: string | null
          unmatched_count: number
        }
        Insert: {
          accounting_period_id: number
          created_at?: string
          id?: never
          outside_tolerance_count?: number
          production_enabled?: boolean
          reconciliation_hash?: string | null
          status?: string
          trial_balance_hash?: string | null
          unmatched_count?: number
        }
        Update: {
          accounting_period_id?: number
          created_at?: string
          id?: never
          outside_tolerance_count?: number
          production_enabled?: boolean
          reconciliation_hash?: string | null
          status?: string
          trial_balance_hash?: string | null
          unmatched_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shadow_close_packages_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      shadow_financial_journals: {
        Row: {
          comparison_detail: Json
          comparison_status: string
          created_at: string
          event_id: number | null
          evidence_hash: string
          functional_credits: number
          functional_debits: number
          id: number
          journal_type: string
          ledger_transaction_id: number | null
          native_credits: number
          native_debits: number
          production_enabled: boolean
        }
        Insert: {
          comparison_detail?: Json
          comparison_status: string
          created_at?: string
          event_id?: number | null
          evidence_hash: string
          functional_credits: number
          functional_debits: number
          id?: never
          journal_type: string
          ledger_transaction_id?: number | null
          native_credits: number
          native_debits: number
          production_enabled?: boolean
        }
        Update: {
          comparison_detail?: Json
          comparison_status?: string
          created_at?: string
          event_id?: number | null
          evidence_hash?: string
          functional_credits?: number
          functional_debits?: number
          id?: never
          journal_type?: string
          ledger_transaction_id?: number | null
          native_credits?: number
          native_debits?: number
          production_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shadow_financial_journals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "external_financial_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadow_financial_journals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shadow_financial_reconciliation_observability"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "shadow_financial_journals_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadow_financial_journals_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
        ]
      }
      stripe_acss_debit_commands: {
        Row: {
          accounting_period_id: number
          actor_user_id: string
          capability_evidence_hash: string | null
          created_at: string
          currency_code: string
          deployment_environment: string
          expected_amount_minor: number
          id: string
          payment_id: number
          production_enabled: boolean
          project_id: number
          provider_account_id: string | null
          provider_acknowledged_at: string | null
          provider_charge_id: string | null
          provider_checkout_session_id: string | null
          provider_mandate_id: string | null
          provider_payment_intent_id: string | null
          request_hash: string
        }
        Insert: {
          accounting_period_id: number
          actor_user_id: string
          capability_evidence_hash?: string | null
          created_at?: string
          currency_code: string
          deployment_environment: string
          expected_amount_minor: number
          id?: string
          payment_id: number
          production_enabled?: boolean
          project_id: number
          provider_account_id?: string | null
          provider_acknowledged_at?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_mandate_id?: string | null
          provider_payment_intent_id?: string | null
          request_hash: string
        }
        Update: {
          accounting_period_id?: number
          actor_user_id?: string
          capability_evidence_hash?: string | null
          created_at?: string
          currency_code?: string
          deployment_environment?: string
          expected_amount_minor?: number
          id?: string
          payment_id?: number
          production_enabled?: boolean
          project_id?: number
          provider_account_id?: string | null
          provider_acknowledged_at?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_mandate_id?: string | null
          provider_payment_intent_id?: string | null
          request_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_acss_debit_commands_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_commands_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_commands_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "stripe_acss_debit_commands_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_commands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_acss_debit_custody_routes: {
        Row: {
          asset_id: number
          currency_code: string
          custody_account_id: number
          evidence_hash: string
          id: number
          production_enabled: boolean
          provisional_fx_usd_per_unit: number
          sandbox_enabled: boolean
        }
        Insert: {
          asset_id: number
          currency_code: string
          custody_account_id: number
          evidence_hash: string
          id?: never
          production_enabled?: boolean
          provisional_fx_usd_per_unit: number
          sandbox_enabled?: boolean
        }
        Update: {
          asset_id?: number
          currency_code?: string
          custody_account_id?: number
          evidence_hash?: string
          id?: never
          production_enabled?: boolean
          provisional_fx_usd_per_unit?: number
          sandbox_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stripe_acss_debit_custody_routes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_custody_routes_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_route_asset_custody_fk"
            columns: ["asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
        ]
      }
      stripe_acss_debit_evidence: {
        Row: {
          balance_status: string | null
          command_id: string
          created_at: string
          currency_code: string
          evidence_hash: string
          evidence_type: string
          fee_amount_minor: number | null
          gross_amount_minor: number
          id: number
          ledger_transaction_id: number | null
          net_amount_minor: number | null
          ordering_status: string
          production_enabled: boolean
          provider_balance_transaction_id: string | null
          provider_charge_id: string | null
          provider_checkout_session_id: string | null
          provider_mandate_id: string | null
          provider_payment_intent_id: string | null
          reversal_ledger_transaction_id: number | null
          webhook_event_id: number
        }
        Insert: {
          balance_status?: string | null
          command_id: string
          created_at?: string
          currency_code: string
          evidence_hash: string
          evidence_type: string
          fee_amount_minor?: number | null
          gross_amount_minor: number
          id?: never
          ledger_transaction_id?: number | null
          net_amount_minor?: number | null
          ordering_status: string
          production_enabled?: boolean
          provider_balance_transaction_id?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_mandate_id?: string | null
          provider_payment_intent_id?: string | null
          reversal_ledger_transaction_id?: number | null
          webhook_event_id: number
        }
        Update: {
          balance_status?: string | null
          command_id?: string
          created_at?: string
          currency_code?: string
          evidence_hash?: string
          evidence_type?: string
          fee_amount_minor?: number | null
          gross_amount_minor?: number
          id?: never
          ledger_transaction_id?: number | null
          net_amount_minor?: number | null
          ordering_status?: string
          production_enabled?: boolean
          provider_balance_transaction_id?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_mandate_id?: string | null
          provider_payment_intent_id?: string | null
          reversal_ledger_transaction_id?: number | null
          webhook_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_acss_debit_evidence_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_evidence_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_status"
            referencedColumns: ["command_id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_evidence_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_evidence_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_evidence_reversal_ledger_transaction_id_fkey"
            columns: ["reversal_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_evidence_reversal_ledger_transaction_id_fkey"
            columns: ["reversal_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_evidence_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "stripe_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_acss_debit_package_invalidations: {
        Row: {
          command_id: string
          created_at: string
          evidence_id: number
          funding_source_id: number
          id: number
          package_id: number
          production_enabled: boolean
          reason: string
        }
        Insert: {
          command_id: string
          created_at?: string
          evidence_id: number
          funding_source_id: number
          id?: never
          package_id: number
          production_enabled?: boolean
          reason: string
        }
        Update: {
          command_id?: string
          created_at?: string
          evidence_id?: number
          funding_source_id?: number
          id?: never
          package_id?: number
          production_enabled?: boolean
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_status"
            referencedColumns: ["command_id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "stripe_acss_debit_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_funding_source_id_fkey"
            columns: ["funding_source_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_funding_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_package_invalidations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_acss_debit_runtime_controls: {
        Row: {
          cad_enabled: boolean
          checkout_enabled: boolean
          deployment_environment: string
          production_value_flow_enabled: boolean
          provider_evidence_hash: string | null
          provider_evidence_status: string
          updated_at: string
          usd_enabled: boolean
        }
        Insert: {
          cad_enabled?: boolean
          checkout_enabled?: boolean
          deployment_environment: string
          production_value_flow_enabled?: boolean
          provider_evidence_hash?: string | null
          provider_evidence_status?: string
          updated_at?: string
          usd_enabled?: boolean
        }
        Update: {
          cad_enabled?: boolean
          checkout_enabled?: boolean
          deployment_environment?: string
          production_value_flow_enabled?: boolean
          provider_evidence_hash?: string | null
          provider_evidence_status?: string
          updated_at?: string
          usd_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stripe_acss_debit_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      stripe_balance_snapshots: {
        Row: {
          available_amount_minor: number
          currency_code: string
          evidence_hash: string
          id: number
          observed_at: string
          pending_amount_minor: number
          production_enabled: boolean
          webhook_event_id: number
        }
        Insert: {
          available_amount_minor: number
          currency_code: string
          evidence_hash: string
          id?: never
          observed_at: string
          pending_amount_minor: number
          production_enabled?: boolean
          webhook_event_id: number
        }
        Update: {
          available_amount_minor?: number
          currency_code?: string
          evidence_hash?: string
          id?: never
          observed_at?: string
          pending_amount_minor?: number
          production_enabled?: boolean
          webhook_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_balance_snapshots_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "stripe_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_bank_transfer_custody_routes: {
        Row: {
          asset_id: number
          created_at: string
          currency_code: string
          custody_account_id: number
          evidence_hash: string
          id: number
          production_enabled: boolean
          sandbox_enabled: boolean
          topology_status: string
        }
        Insert: {
          asset_id: number
          created_at?: string
          currency_code: string
          custody_account_id: number
          evidence_hash: string
          id?: never
          production_enabled?: boolean
          sandbox_enabled?: boolean
          topology_status?: string
        }
        Update: {
          asset_id?: number
          created_at?: string
          currency_code?: string
          custody_account_id?: number
          evidence_hash?: string
          id?: never
          production_enabled?: boolean
          sandbox_enabled?: boolean
          topology_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_bank_transfer_custody_routes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_custody_routes_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_custody_asset_fk"
            columns: ["asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
        ]
      }
      stripe_bank_transfer_evidence: {
        Row: {
          created_at: string
          currency_code: string | null
          evidence_hash: string
          evidence_type: string
          external_financial_event_id: number | null
          fee_amount_minor: number | null
          gross_amount_minor: number | null
          id: number
          intent_id: number | null
          ledger_transaction_id: number | null
          net_amount_minor: number | null
          ordering_status: string
          production_enabled: boolean
          provider_balance_currency_code: string | null
          provider_balance_fee_amount_minor: number | null
          provider_balance_gross_amount_minor: number | null
          provider_balance_net_amount_minor: number | null
          provider_balance_transaction_id: string | null
          reversal_ledger_transaction_id: number | null
          webhook_event_id: number
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          evidence_hash: string
          evidence_type: string
          external_financial_event_id?: number | null
          fee_amount_minor?: number | null
          gross_amount_minor?: number | null
          id?: never
          intent_id?: number | null
          ledger_transaction_id?: number | null
          net_amount_minor?: number | null
          ordering_status: string
          production_enabled?: boolean
          provider_balance_currency_code?: string | null
          provider_balance_fee_amount_minor?: number | null
          provider_balance_gross_amount_minor?: number | null
          provider_balance_net_amount_minor?: number | null
          provider_balance_transaction_id?: string | null
          reversal_ledger_transaction_id?: number | null
          webhook_event_id: number
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          evidence_hash?: string
          evidence_type?: string
          external_financial_event_id?: number | null
          fee_amount_minor?: number | null
          gross_amount_minor?: number | null
          id?: never
          intent_id?: number | null
          ledger_transaction_id?: number | null
          net_amount_minor?: number | null
          ordering_status?: string
          production_enabled?: boolean
          provider_balance_currency_code?: string | null
          provider_balance_fee_amount_minor?: number | null
          provider_balance_gross_amount_minor?: number | null
          provider_balance_net_amount_minor?: number | null
          provider_balance_transaction_id?: string | null
          reversal_ledger_transaction_id?: number | null
          webhook_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_bank_transfer_evidence_external_financial_event_id_fkey"
            columns: ["external_financial_event_id"]
            isOneToOne: false
            referencedRelation: "external_financial_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_external_financial_event_id_fkey"
            columns: ["external_financial_event_id"]
            isOneToOne: false
            referencedRelation: "shadow_financial_reconciliation_observability"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "stripe_bank_transfer_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "stripe_bank_transfer_status"
            referencedColumns: ["intent_id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_reversal_ledger_transaction__fkey"
            columns: ["reversal_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_reversal_ledger_transaction__fkey"
            columns: ["reversal_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_evidence_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: true
            referencedRelation: "stripe_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_bank_transfer_intents: {
        Row: {
          accounting_period_id: number
          actor_user_id: string
          created_at: string
          currency_code: string
          deployment_environment: string
          expected_amount_minor: number
          id: number
          instruction_evidence_hash: string
          instruction_status: string
          payment_id: number
          production_enabled: boolean
          project_id: number
          provider_account_id: string
          provider_customer_id: string
          provider_payment_intent_id: string
        }
        Insert: {
          accounting_period_id: number
          actor_user_id: string
          created_at?: string
          currency_code: string
          deployment_environment: string
          expected_amount_minor: number
          id?: never
          instruction_evidence_hash: string
          instruction_status?: string
          payment_id: number
          production_enabled?: boolean
          project_id: number
          provider_account_id: string
          provider_customer_id: string
          provider_payment_intent_id: string
        }
        Update: {
          accounting_period_id?: number
          actor_user_id?: string
          created_at?: string
          currency_code?: string
          deployment_environment?: string
          expected_amount_minor?: number
          id?: never
          instruction_evidence_hash?: string
          instruction_status?: string
          payment_id?: number
          production_enabled?: boolean
          project_id?: number
          provider_account_id?: string
          provider_customer_id?: string
          provider_payment_intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_bank_transfer_intents_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_intents_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_intents_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "stripe_bank_transfer_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_intents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_bank_transfer_runtime_controls: {
        Row: {
          cad_bank_transfer_enabled: boolean
          deployment_environment: string
          production_value_flow_enabled: boolean
          provider_evidence_status: string
          sandbox_enabled: boolean
          updated_at: string
          usd_bank_transfer_enabled: boolean
        }
        Insert: {
          cad_bank_transfer_enabled?: boolean
          deployment_environment: string
          production_value_flow_enabled?: boolean
          provider_evidence_status?: string
          sandbox_enabled?: boolean
          updated_at?: string
          usd_bank_transfer_enabled?: boolean
        }
        Update: {
          cad_bank_transfer_enabled?: boolean
          deployment_environment?: string
          production_value_flow_enabled?: boolean
          provider_evidence_status?: string
          sandbox_enabled?: boolean
          updated_at?: string
          usd_bank_transfer_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stripe_bank_transfer_runtime_contro_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      stripe_clearing_sweep_evidence: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          evidence_hash: string
          from_reference_hash: string
          id: number
          production_enabled: boolean
          provider_transfer_id: string
          swept_at: string
          to_reference_hash: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code: string
          evidence_hash: string
          from_reference_hash: string
          id?: never
          production_enabled?: boolean
          provider_transfer_id: string
          swept_at: string
          to_reference_hash: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          evidence_hash?: string
          from_reference_hash?: string
          id?: never
          production_enabled?: boolean
          provider_transfer_id?: string
          swept_at?: string
          to_reference_hash?: string
        }
        Relationships: []
      }
      stripe_connect_account_events: {
        Row: {
          created_at: string
          currently_due_count: number
          disabled_reason: string | null
          event_type: string
          evidence_hash: string
          external_account_enabled: boolean
          id: number
          onboarding_status: string
          payouts_enabled: boolean
          provider_created_at: string
          provider_event_id: string | null
          stripe_connect_account_id: number
        }
        Insert: {
          created_at?: string
          currently_due_count: number
          disabled_reason?: string | null
          event_type: string
          evidence_hash: string
          external_account_enabled: boolean
          id?: never
          onboarding_status: string
          payouts_enabled: boolean
          provider_created_at: string
          provider_event_id?: string | null
          stripe_connect_account_id: number
        }
        Update: {
          created_at?: string
          currently_due_count?: number
          disabled_reason?: string | null
          event_type?: string
          evidence_hash?: string
          external_account_enabled?: boolean
          id?: never
          onboarding_status?: string
          payouts_enabled?: boolean
          provider_created_at?: string
          provider_event_id?: string | null
          stripe_connect_account_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_account_events_stripe_connect_account_id_fkey"
            columns: ["stripe_connect_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connect_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_accounts: {
        Row: {
          country_code: string
          created_at: string
          currently_due_count: number
          default_currency: string
          details_submitted: boolean
          disabled_reason: string | null
          eventually_due_count: number
          evidence_hash: string
          external_account_enabled: boolean
          external_account_last4: string | null
          id: number
          onboarding_status: string
          payout_route_id: number | null
          payouts_enabled: boolean
          production_enabled: boolean
          provider_account_id: string
          provider_updated_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          currently_due_count?: number
          default_currency: string
          details_submitted?: boolean
          disabled_reason?: string | null
          eventually_due_count?: number
          evidence_hash: string
          external_account_enabled?: boolean
          external_account_last4?: string | null
          id?: never
          onboarding_status: string
          payout_route_id?: number | null
          payouts_enabled?: boolean
          production_enabled?: boolean
          provider_account_id: string
          provider_updated_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          currently_due_count?: number
          default_currency?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          eventually_due_count?: number
          evidence_hash?: string
          external_account_enabled?: boolean
          external_account_last4?: string | null
          id?: never
          onboarding_status?: string
          payout_route_id?: number | null
          payouts_enabled?: boolean
          production_enabled?: boolean
          provider_account_id?: string
          provider_updated_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_accounts_payout_route_id_fkey"
            columns: ["payout_route_id"]
            isOneToOne: true
            referencedRelation: "user_payout_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stripe_connect_fee_inventory_reservations: {
        Row: {
          command_id: number | null
          created_at: string
          inventory_lot_id: number
          native_atomic_amount: number
          reserved_minor: number
          status: string
          withdrawal_request_id: string
        }
        Insert: {
          command_id?: number | null
          created_at?: string
          inventory_lot_id: number
          native_atomic_amount: number
          reserved_minor: number
          status?: string
          withdrawal_request_id: string
        }
        Update: {
          command_id?: number | null
          created_at?: string
          inventory_lot_id?: number
          native_atomic_amount?: number
          reserved_minor?: number
          status?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_fee_inventory_reserva_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_fee_inventory_reservations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_connect_payout_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_fee_inventory_reservations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "user_stripe_connect_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_fee_inventory_reservations_inventory_lot_id_fkey"
            columns: ["inventory_lot_id"]
            isOneToOne: false
            referencedRelation: "payout_inventory_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_payout_commands: {
        Row: {
          attempt_no: number
          command_hash: string
          created_at: string
          currency_code: string
          failure_code: string | null
          gross_minor: number
          id: number
          idempotency_key: string
          ledger_transaction_id: number | null
          net_minor: number
          payout_execution_attempt_id: number
          payout_intent_id: number
          production_enabled: boolean
          provider_payout_id: string | null
          provider_payout_minor: number
          provider_request_id: string | null
          provider_transfer_id: string | null
          settled_at: string | null
          status: string
          stripe_connect_account_id: number
          submitted_at: string | null
          updated_at: string
          user_fee_minor: number
          user_fee_provider_minor: number
          withdrawal_request_id: string
        }
        Insert: {
          attempt_no: number
          command_hash: string
          created_at?: string
          currency_code: string
          failure_code?: string | null
          gross_minor: number
          id?: never
          idempotency_key: string
          ledger_transaction_id?: number | null
          net_minor: number
          payout_execution_attempt_id: number
          payout_intent_id: number
          production_enabled?: boolean
          provider_payout_id?: string | null
          provider_payout_minor: number
          provider_request_id?: string | null
          provider_transfer_id?: string | null
          settled_at?: string | null
          status?: string
          stripe_connect_account_id: number
          submitted_at?: string | null
          updated_at?: string
          user_fee_minor: number
          user_fee_provider_minor?: number
          withdrawal_request_id: string
        }
        Update: {
          attempt_no?: number
          command_hash?: string
          created_at?: string
          currency_code?: string
          failure_code?: string | null
          gross_minor?: number
          id?: never
          idempotency_key?: string
          ledger_transaction_id?: number | null
          net_minor?: number
          payout_execution_attempt_id?: number
          payout_intent_id?: number
          production_enabled?: boolean
          provider_payout_id?: string | null
          provider_payout_minor?: number
          provider_request_id?: string | null
          provider_transfer_id?: string | null
          settled_at?: string | null
          status?: string
          stripe_connect_account_id?: number
          submitted_at?: string | null
          updated_at?: string
          user_fee_minor?: number
          user_fee_provider_minor?: number
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_payout_commands_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_payout_execution_attempt_id_fkey"
            columns: ["payout_execution_attempt_id"]
            isOneToOne: true
            referencedRelation: "payout_execution_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_payout_intent_id_fkey"
            columns: ["payout_intent_id"]
            isOneToOne: false
            referencedRelation: "payout_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_stripe_connect_account_id_fkey"
            columns: ["stripe_connect_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connect_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_payout_observations: {
        Row: {
          amount_minor: number
          arrival_at: string | null
          created_at: string
          currency_code: string
          destination_last4: string | null
          evidence_hash: string
          failure_code: string | null
          id: number
          provider_status: string
          stripe_connect_payout_command_id: number
          webhook_event_id: number
        }
        Insert: {
          amount_minor: number
          arrival_at?: string | null
          created_at?: string
          currency_code: string
          destination_last4?: string | null
          evidence_hash: string
          failure_code?: string | null
          id?: never
          provider_status: string
          stripe_connect_payout_command_id: number
          webhook_event_id: number
        }
        Update: {
          amount_minor?: number
          arrival_at?: string | null
          created_at?: string
          currency_code?: string
          destination_last4?: string | null
          evidence_hash?: string
          failure_code?: string | null
          id?: never
          provider_status?: string
          stripe_connect_payout_command_id?: number
          webhook_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_payout_observa_stripe_connect_payout_comman_fkey"
            columns: ["stripe_connect_payout_command_id"]
            isOneToOne: false
            referencedRelation: "stripe_connect_payout_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_observa_stripe_connect_payout_comman_fkey"
            columns: ["stripe_connect_payout_command_id"]
            isOneToOne: false
            referencedRelation: "user_stripe_connect_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_observations_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: true
            referencedRelation: "stripe_connect_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_runtime_controls: {
        Row: {
          deployment_environment: string
          onboarding_enabled: boolean
          payout_enabled: boolean
          production_value_flow_enabled: boolean
          updated_at: string
          webhook_enabled: boolean
        }
        Insert: {
          deployment_environment: string
          onboarding_enabled?: boolean
          payout_enabled?: boolean
          production_value_flow_enabled?: boolean
          updated_at?: string
          webhook_enabled?: boolean
        }
        Update: {
          deployment_environment?: string
          onboarding_enabled?: boolean
          payout_enabled?: boolean
          production_value_flow_enabled?: boolean
          updated_at?: string
          webhook_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      stripe_connect_webhook_events: {
        Row: {
          command_sha256: string
          created_at: string
          event_type: string
          id: number
          livemode: boolean
          observation_source: string
          ordering_status: string
          payload_sha256: string
          provider_account_id: string
          provider_created_at: string
          provider_event_id: string
          provider_object_id: string
          signature_timestamp: number
        }
        Insert: {
          command_sha256: string
          created_at?: string
          event_type: string
          id?: never
          livemode: boolean
          observation_source: string
          ordering_status: string
          payload_sha256: string
          provider_account_id: string
          provider_created_at: string
          provider_event_id: string
          provider_object_id: string
          signature_timestamp: number
        }
        Update: {
          command_sha256?: string
          created_at?: string
          event_type?: string
          id?: never
          livemode?: boolean
          observation_source?: string
          ordering_status?: string
          payload_sha256?: string
          provider_account_id?: string
          provider_created_at?: string
          provider_event_id?: string
          provider_object_id?: string
          signature_timestamp?: number
        }
        Relationships: []
      }
      stripe_pay_by_bank_commands: {
        Row: {
          accounting_period_id: number
          actor_user_id: string
          capability_evidence_hash: string | null
          charge_topology: string
          created_at: string
          currency_code: string
          customer_country: string
          deployment_environment: string
          expected_amount_minor: number
          id: string
          merchant_country: string
          payment_id: number
          platform_account_id: string
          production_enabled: boolean
          project_id: number
          provider_account_id: string | null
          provider_acknowledged_at: string | null
          provider_charge_id: string | null
          provider_checkout_session_id: string | null
          provider_payment_intent_id: string | null
          request_hash: string
        }
        Insert: {
          accounting_period_id: number
          actor_user_id: string
          capability_evidence_hash?: string | null
          charge_topology: string
          created_at?: string
          currency_code: string
          customer_country: string
          deployment_environment: string
          expected_amount_minor: number
          id?: string
          merchant_country: string
          payment_id: number
          platform_account_id: string
          production_enabled?: boolean
          project_id: number
          provider_account_id?: string | null
          provider_acknowledged_at?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_payment_intent_id?: string | null
          request_hash: string
        }
        Update: {
          accounting_period_id?: number
          actor_user_id?: string
          capability_evidence_hash?: string | null
          charge_topology?: string
          created_at?: string
          currency_code?: string
          customer_country?: string
          deployment_environment?: string
          expected_amount_minor?: number
          id?: string
          merchant_country?: string
          payment_id?: number
          platform_account_id?: string
          production_enabled?: boolean
          project_id?: number
          provider_account_id?: string | null
          provider_acknowledged_at?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_payment_intent_id?: string | null
          request_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_commands_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_commands_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_commands_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_commands_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_commands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_pay_by_bank_custody_routes: {
        Row: {
          asset_id: number
          currency_code: string
          custody_account_id: number
          evidence_hash: string
          id: number
          production_enabled: boolean
          provisional_fx_usd_per_unit: number
          sandbox_enabled: boolean
        }
        Insert: {
          asset_id: number
          currency_code: string
          custody_account_id: number
          evidence_hash: string
          id?: never
          production_enabled?: boolean
          provisional_fx_usd_per_unit: number
          sandbox_enabled?: boolean
        }
        Update: {
          asset_id?: number
          currency_code?: string
          custody_account_id?: number
          evidence_hash?: string
          id?: never
          production_enabled?: boolean
          provisional_fx_usd_per_unit?: number
          sandbox_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_custody_routes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_custody_routes_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_route_asset_custody_fk"
            columns: ["asset_id", "custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["asset_id", "id"]
          },
        ]
      }
      stripe_pay_by_bank_evidence: {
        Row: {
          balance_status: string | null
          command_id: string
          created_at: string
          currency_code: string
          customer_country: string | null
          evidence_hash: string
          evidence_type: string
          fee_amount_minor: number | null
          gross_amount_minor: number
          id: number
          ledger_transaction_id: number | null
          net_amount_minor: number | null
          ordering_status: string
          production_enabled: boolean
          provider_balance_transaction_id: string | null
          provider_charge_id: string | null
          provider_checkout_session_id: string | null
          provider_payment_intent_id: string | null
          provider_refund_id: string | null
          refund_amount_minor: number | null
          reversal_ledger_transaction_id: number | null
          webhook_event_id: number
        }
        Insert: {
          balance_status?: string | null
          command_id: string
          created_at?: string
          currency_code: string
          customer_country?: string | null
          evidence_hash: string
          evidence_type: string
          fee_amount_minor?: number | null
          gross_amount_minor: number
          id?: never
          ledger_transaction_id?: number | null
          net_amount_minor?: number | null
          ordering_status: string
          production_enabled?: boolean
          provider_balance_transaction_id?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_payment_intent_id?: string | null
          provider_refund_id?: string | null
          refund_amount_minor?: number | null
          reversal_ledger_transaction_id?: number | null
          webhook_event_id: number
        }
        Update: {
          balance_status?: string | null
          command_id?: string
          created_at?: string
          currency_code?: string
          customer_country?: string | null
          evidence_hash?: string
          evidence_type?: string
          fee_amount_minor?: number | null
          gross_amount_minor?: number
          id?: never
          ledger_transaction_id?: number | null
          net_amount_minor?: number | null
          ordering_status?: string
          production_enabled?: boolean
          provider_balance_transaction_id?: string | null
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_payment_intent_id?: string | null
          provider_refund_id?: string | null
          refund_amount_minor?: number | null
          reversal_ledger_transaction_id?: number | null
          webhook_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_status"
            referencedColumns: ["command_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_reversal_ledger_transaction_id_fkey"
            columns: ["reversal_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_reversal_ledger_transaction_id_fkey"
            columns: ["reversal_ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_evidence_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "stripe_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_pay_by_bank_package_invalidations: {
        Row: {
          command_id: string
          created_at: string
          evidence_id: number
          funding_source_id: number
          id: number
          package_id: number
          production_enabled: boolean
          reason: string
        }
        Insert: {
          command_id: string
          created_at?: string
          evidence_id: number
          funding_source_id: number
          id?: never
          package_id: number
          production_enabled?: boolean
          reason: string
        }
        Update: {
          command_id?: string
          created_at?: string
          evidence_id?: number
          funding_source_id?: number
          id?: never
          package_id?: number
          production_enabled?: boolean
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_status"
            referencedColumns: ["command_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_funding_source_id_fkey"
            columns: ["funding_source_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_funding_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_package_invalidations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_pay_by_bank_residual_retirements: {
        Row: {
          command_id: string
          created_at: string
          id: number
          production_enabled: boolean
          refund_evidence_id: number
          residual_transaction_id: number
          reversal_transaction_id: number
        }
        Insert: {
          command_id: string
          created_at?: string
          id?: never
          production_enabled?: boolean
          refund_evidence_id: number
          residual_transaction_id: number
          reversal_transaction_id: number
        }
        Update: {
          command_id?: string
          created_at?: string
          id?: never
          production_enabled?: boolean
          refund_evidence_id?: number
          residual_transaction_id?: number
          reversal_transaction_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retire_residual_transaction_id_fkey"
            columns: ["residual_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retire_residual_transaction_id_fkey"
            columns: ["residual_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retire_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: true
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retire_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: true
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retirements_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retirements_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_status"
            referencedColumns: ["command_id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_residual_retirements_refund_evidence_id_fkey"
            columns: ["refund_evidence_id"]
            isOneToOne: false
            referencedRelation: "stripe_pay_by_bank_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_pay_by_bank_runtime_controls: {
        Row: {
          checkout_enabled: boolean
          deployment_environment: string
          eur_enabled: boolean
          gbp_enabled: boolean
          production_value_flow_enabled: boolean
          provider_evidence_hash: string | null
          provider_evidence_status: string
          updated_at: string
        }
        Insert: {
          checkout_enabled?: boolean
          deployment_environment: string
          eur_enabled?: boolean
          gbp_enabled?: boolean
          production_value_flow_enabled?: boolean
          provider_evidence_hash?: string | null
          provider_evidence_status?: string
          updated_at?: string
        }
        Update: {
          checkout_enabled?: boolean
          deployment_environment?: string
          eur_enabled?: boolean
          gbp_enabled?: boolean
          production_value_flow_enabled?: boolean
          provider_evidence_hash?: string | null
          provider_evidence_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          api_version: string | null
          command_sha256: string
          event_type: string
          id: number
          livemode: boolean
          observation_source: string
          observed_at: string
          payload_sha256: string
          production_enabled: boolean
          provider_account_id: string
          provider_created_at: string
          provider_event_id: string
          provider_object_id: string
          signature_timestamp: number
        }
        Insert: {
          api_version?: string | null
          command_sha256: string
          event_type: string
          id?: never
          livemode?: boolean
          observation_source: string
          observed_at?: string
          payload_sha256: string
          production_enabled?: boolean
          provider_account_id: string
          provider_created_at: string
          provider_event_id: string
          provider_object_id: string
          signature_timestamp: number
        }
        Update: {
          api_version?: string | null
          command_sha256?: string
          event_type?: string
          id?: never
          livemode?: boolean
          observation_source?: string
          observed_at?: string
          payload_sha256?: string
          production_enabled?: boolean
          provider_account_id?: string
          provider_created_at?: string
          provider_event_id?: string
          provider_object_id?: string
          signature_timestamp?: number
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
      user_asset_preferences: {
        Row: {
          accepted: boolean
          asset_code: string
          asset_type: Database["public"]["Enums"]["user_asset_preference_type"]
          created_at: string
          created_by_user_id: string | null
          id: number
          project_id: number | null
          rank: number
          updated_at: string
          updated_by_user_id: string | null
          user_id: string
        }
        Insert: {
          accepted?: boolean
          asset_code: string
          asset_type: Database["public"]["Enums"]["user_asset_preference_type"]
          created_at?: string
          created_by_user_id?: string | null
          id?: number
          project_id?: number | null
          rank: number
          updated_at?: string
          updated_by_user_id?: string | null
          user_id: string
        }
        Update: {
          accepted?: boolean
          asset_code?: string
          asset_type?: Database["public"]["Enums"]["user_asset_preference_type"]
          created_at?: string
          created_by_user_id?: string | null
          id?: number
          project_id?: number | null
          rank?: number
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_asset_preferences_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_asset_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_asset_preferences_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_asset_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      user_payout_routes: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          destination: Json
          id: number
          is_default: boolean
          label: string
          rail: Database["public"]["Enums"]["payout_rail"]
          status: Database["public"]["Enums"]["payout_route_status"]
          updated_at: string
          updated_by_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          destination?: Json
          id?: number
          is_default?: boolean
          label?: string
          rail: Database["public"]["Enums"]["payout_rail"]
          status?: Database["public"]["Enums"]["payout_route_status"]
          updated_at?: string
          updated_by_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          destination?: Json
          id?: number
          is_default?: boolean
          label?: string
          rail?: Database["public"]["Enums"]["payout_rail"]
          status?: Database["public"]["Enums"]["payout_route_status"]
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_payout_routes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_payout_routes_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_payout_routes_user_id_fkey"
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
      user_withdrawal_obligation_claims: {
        Row: {
          claimed_minor: number
          created_at: string
          id: number
          obligation_id: number
          sequence_no: number
          status: string
          updated_at: string
          withdrawal_request_id: string
        }
        Insert: {
          claimed_minor: number
          created_at?: string
          id?: never
          obligation_id: number
          sequence_no: number
          status: string
          updated_at?: string
          withdrawal_request_id: string
        }
        Update: {
          claimed_minor?: number
          created_at?: string
          id?: never
          obligation_id?: number
          sequence_no?: number
          status?: string
          updated_at?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_withdrawal_obligation_claims_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_canonical_credit_reads"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligation_claims_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_compatibility_positions"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligation_claims_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligation_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligation_claims_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligation_claims_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_withdrawal_obligations: {
        Row: {
          available_at: string
          created_at: string
          evidence_hash: string
          id: number
          monthly_cycle_id: number
          production_enabled: boolean
          source_award_control_id: number | null
          source_bookkeeping_credit_id: number | null
          source_expires_after_cycle_id: number | null
          state: string
          total_minor: number
          user_id: string
        }
        Insert: {
          available_at?: string
          created_at?: string
          evidence_hash: string
          id?: never
          monthly_cycle_id: number
          production_enabled?: boolean
          source_award_control_id?: number | null
          source_bookkeeping_credit_id?: number | null
          source_expires_after_cycle_id?: number | null
          state?: string
          total_minor: number
          user_id: string
        }
        Update: {
          available_at?: string
          created_at?: string
          evidence_hash?: string
          id?: never
          monthly_cycle_id?: number
          production_enabled?: boolean
          source_award_control_id?: number | null
          source_bookkeeping_credit_id?: number | null
          source_expires_after_cycle_id?: number | null
          state?: string
          total_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_withdrawal_obligations_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_source_award_control_id_fkey"
            columns: ["source_award_control_id"]
            isOneToOne: true
            referencedRelation: "epoch_provisional_award_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_source_bookkeeping_credit_id_fkey"
            columns: ["source_bookkeeping_credit_id"]
            isOneToOne: true
            referencedRelation: "financial_cutover_canonical_credit_reads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_source_bookkeeping_credit_id_fkey"
            columns: ["source_bookkeeping_credit_id"]
            isOneToOne: true
            referencedRelation: "financial_cutover_compatibility_positions"
            referencedColumns: ["legacy_credit_id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_source_bookkeeping_credit_id_fkey"
            columns: ["source_bookkeeping_credit_id"]
            isOneToOne: true
            referencedRelation: "monthly_cycle_bookkeeping_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_source_expires_after_cycle_id_fkey"
            columns: ["source_expires_after_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_withdrawal_request_credits: {
        Row: {
          bookkeeping_credit_id: number
          created_at: string
          reserved_usd_amount: number
          withdrawal_request_id: string
        }
        Insert: {
          bookkeeping_credit_id: number
          created_at?: string
          reserved_usd_amount: number
          withdrawal_request_id: string
        }
        Update: {
          bookkeeping_credit_id?: number
          created_at?: string
          reserved_usd_amount?: number
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_withdrawal_request_credits_bookkeeping_credit_id_fkey"
            columns: ["bookkeeping_credit_id"]
            isOneToOne: true
            referencedRelation: "financial_cutover_canonical_credit_reads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_request_credits_bookkeeping_credit_id_fkey"
            columns: ["bookkeeping_credit_id"]
            isOneToOne: true
            referencedRelation: "financial_cutover_compatibility_positions"
            referencedColumns: ["legacy_credit_id"]
          },
          {
            foreignKeyName: "user_withdrawal_request_credits_bookkeeping_credit_id_fkey"
            columns: ["bookkeeping_credit_id"]
            isOneToOne: true
            referencedRelation: "monthly_cycle_bookkeeping_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_request_credits_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_withdrawal_requests: {
        Row: {
          closed_at: string | null
          created_at: string
          currency_code: string
          destination_hash: string | null
          fee_minor: number | null
          financial_asset_id: number | null
          id: string
          idempotency_key: string
          net_minor: number | null
          payout_route_id: number
          production_enabled: boolean
          project_id: number | null
          queue_for_cycle_id: number | null
          queue_for_cycle_key: string | null
          rail_key: string | null
          request_hash: string | null
          requested_at: string
          requested_minor: number | null
          requested_usd_amount: number
          status: string
          status_reason: string | null
          updated_at: string
          user_fee_bps: number | null
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          currency_code?: string
          destination_hash?: string | null
          fee_minor?: number | null
          financial_asset_id?: number | null
          id?: string
          idempotency_key: string
          net_minor?: number | null
          payout_route_id: number
          production_enabled?: boolean
          project_id?: number | null
          queue_for_cycle_id?: number | null
          queue_for_cycle_key?: string | null
          rail_key?: string | null
          request_hash?: string | null
          requested_at?: string
          requested_minor?: number | null
          requested_usd_amount: number
          status?: string
          status_reason?: string | null
          updated_at?: string
          user_fee_bps?: number | null
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          currency_code?: string
          destination_hash?: string | null
          fee_minor?: number | null
          financial_asset_id?: number | null
          id?: string
          idempotency_key?: string
          net_minor?: number | null
          payout_route_id?: number
          production_enabled?: boolean
          project_id?: number | null
          queue_for_cycle_id?: number | null
          queue_for_cycle_key?: string | null
          rail_key?: string | null
          request_hash?: string | null
          requested_at?: string
          requested_minor?: number | null
          requested_usd_amount?: number
          status?: string
          status_reason?: string | null
          updated_at?: string
          user_fee_bps?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_withdrawal_requests_financial_asset_id_fkey"
            columns: ["financial_asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_requests_payout_route_id_fkey"
            columns: ["payout_route_id"]
            isOneToOne: false
            referencedRelation: "user_payout_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_requests_queue_for_cycle_id_fkey"
            columns: ["queue_for_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_requests_user_id_fkey"
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
          is_public: boolean
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
          is_public?: boolean
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
          is_public?: boolean
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
      withdrawal_compliance_holds: {
        Row: {
          actor_user_id: string
          evidence_hash: string
          hold_sequence: number
          id: number
          placed_at: string
          reason_code: string
          resolution: string | null
          resolved_at: string | null
          status: string
          withdrawal_request_id: string
        }
        Insert: {
          actor_user_id: string
          evidence_hash: string
          hold_sequence: number
          id?: never
          placed_at?: string
          reason_code: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          withdrawal_request_id: string
        }
        Update: {
          actor_user_id?: string
          evidence_hash?: string
          hold_sequence?: number
          id?: never
          placed_at?: string
          reason_code?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_compliance_holds_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "withdrawal_compliance_holds_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          evidence: Json
          from_status: string | null
          id: number
          to_status: string
          withdrawal_request_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          evidence?: Json
          from_status?: string | null
          id?: never
          to_status: string
          withdrawal_request_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          evidence?: Json
          from_status?: string | null
          id?: never
          to_status?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_lifecycle_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "withdrawal_lifecycle_events_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_runtime_controls: {
        Row: {
          deployment_environment: string
          production_value_flow_enabled: boolean
          reservation_enabled: boolean
          updated_at: string
        }
        Insert: {
          deployment_environment: string
          production_value_flow_enabled?: boolean
          reservation_enabled?: boolean
          updated_at?: string
        }
        Update: {
          deployment_environment?: string
          production_value_flow_enabled?: boolean
          reservation_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_runtime_controls_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: true
            referencedRelation: "financial_runtime_controls"
            referencedColumns: ["deployment_environment"]
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
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
            foreignKeyName: "zkas_datasets_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
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
            foreignKeyName: "zkas_identity_artifacts_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
          notification_id?: number | null
          published_at?: string
          run_id?: number
          user_id?: string
          zkas_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zkas_published_user_results_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
          run_id?: number
          started_at?: string | null
          status?: string
          worker_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_attempts_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
          monthly_cycle_id: number | null
          payment_id: number
          period_end: string
          project_id: number
          run_id: number
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: number
          monthly_cycle_id?: number | null
          payment_id: number
          period_end: string
          project_id: number
          run_id: number
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: number
          monthly_cycle_id?: number | null
          payment_id?: number
          period_end?: string
          project_id?: number
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_payments_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
          monthly_cycle_id: number | null
          project_id: number
          run_id: number
          user_count: number
        }
        Insert: {
          bucket_key: string
          bucket_label: string
          created_at?: string
          id?: number
          monthly_cycle_id?: number | null
          project_id: number
          run_id: number
          user_count?: number
        }
        Update: {
          bucket_key?: string
          bucket_label?: string
          created_at?: string
          id?: number
          monthly_cycle_id?: number | null
          project_id?: number
          run_id?: number
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_project_cubid_buckets_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
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
            foreignKeyName: "zkas_run_project_summaries_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
          output_row_hash?: string
          project_count?: number
          run_id?: number
          zkas_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zkas_run_results_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
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
          monthly_cycle_id: number | null
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
          monthly_cycle_id?: number | null
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
          monthly_cycle_id?: number | null
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
            foreignKeyName: "zkas_runs_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
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
      base_intake_v2_receipt_observability: {
        Row: {
          accounting_period_id: number | null
          block_hash: string | null
          block_number: number | null
          confirmation_count: number | null
          created_at: string | null
          deployment_id: number | null
          epoch_observed_native_amount: number | null
          epoch_treasury_address: string | null
          evidence_hash: string | null
          fee_version_id: number | null
          gross_native_amount: number | null
          id: number | null
          log_index: number | null
          net_epoch_native_amount: number | null
          observed_at: string | null
          observed_log_index: number | null
          observed_receipt_block_number: number | null
          observed_receipt_reference: string | null
          platform_fee_native_amount: number | null
          platform_observed_native_amount: number | null
          platform_treasury_address: string | null
          production_enabled: boolean | null
          project_fee_bps: number | null
          project_fee_version: number | null
          project_id: number | null
          provider_event_id: string | null
          receipt_reference: string | null
          reconciled_observed_at: string | null
          reconciliation_status: string | null
          replacement_tx_hash: string | null
          sender_address: string | null
          token_address: string | null
          token_symbol: string | null
          tx_hash: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_intake_v2_receipts_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_receipts_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "base_intake_v2_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_receipts_fee_version_id_fkey"
            columns: ["fee_version_id"]
            isOneToOne: false
            referencedRelation: "base_project_fee_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_intake_v2_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_allocation_operator_view: {
        Row: {
          calculated_at: string | null
          cycle_key: string | null
          final_allocation_minor: number | null
          funded_exact_usd: number | null
          funded_minor: number | null
          locked_at: string | null
          manifest_hash: string | null
          manifest_id: number | null
          overlap_pool_minor: number | null
          provisional_only: boolean | null
          result_hash: string | null
          retained_initial_minor: number | null
          returned_residue_minor: number | null
          run_id: number | null
          score_pool_minor: number | null
          status: string | null
          top_up_minor: number | null
          user_count: number | null
          version: number | null
        }
        Relationships: []
      }
      epoch_close_operator_view: {
        Row: {
          actor_user_id: string | null
          approved_at: string | null
          artifact_count: number | null
          close_package_id: number | null
          cycle_key: string | null
          final_allocation_minor: number | null
          funded_minor: number | null
          manifest_hash: string | null
          provisional_only: boolean | null
          redistribution_pool_minor: number | null
          result_hash: string | null
          returned_residue_minor: number | null
          root_approved_at: string | null
          root_hash: string | null
          status: string | null
          top_up_minor: number | null
          user_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_allocation_approvals_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      epoch_close_public_project_view: {
        Row: {
          created_at: string | null
          cycle_key: string | null
          funded_minor: number | null
          project_slug: string | null
          published_cohort_count: number | null
          root_hash: string | null
          source_count: number | null
          status: string | null
        }
        Relationships: []
      }
      epoch_close_public_view: {
        Row: {
          created_at: string | null
          cycle_key: string | null
          final_allocation_minor: number | null
          funded_minor: number | null
          published_user_count: number | null
          redistribution_pool_minor: number | null
          returned_residue_minor: number | null
          root_hash: string | null
          status: string | null
          top_up_minor: number | null
        }
        Relationships: []
      }
      epoch_financial_prep_cycle_summary: {
        Row: {
          base_fee_exact_usd: number | null
          cycle_key: string | null
          distributable_exact_usd: number | null
          gross_exact_usd: number | null
          monthly_cycle_id: number | null
          native_atomic_total: number | null
          neutral_provisional_only: boolean | null
          project_count: number | null
          project_fee_exact_usd: number | null
          ready_source_count: number | null
          reserved_exact_usd: number | null
          source_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_valuation_source_lots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_financial_prep_operator_view: {
        Row: {
          asset_key: string | null
          base_fee_exact_usd: number | null
          classification_status: string | null
          created_at: string | null
          custody_key: string | null
          cycle_key: string | null
          deterministic_source_order: number | null
          distributable_exact_usd: number | null
          fx_difference_exact_usd: number | null
          gross_exact_usd: number | null
          monthly_cycle_id: number | null
          native_atomic_amount: number | null
          project_fee_exact_usd: number | null
          project_id: number | null
          project_slug: string | null
          rail_key: string | null
          rate_usd_per_unit: number | null
          reserved_exact_usd: number | null
          source_kind: string | null
          source_lot_key: string | null
          source_preliminary_exact_usd: number | null
          state: string | null
          symbol: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_valuation_source_lots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_funded_allocation_lock_candidates: {
        Row: {
          asset_key: string | null
          atomic_scale: number | null
          base_fee_exact_usd: number | null
          canonical_minor_unit_scale: number | null
          cubid_evidence_hash: string | null
          custody_key: string | null
          deterministic_source_order: number | null
          distributable_exact_usd: number | null
          eligible_user_count: number | null
          fx_difference_exact_usd: number | null
          gross_exact_usd: number | null
          locked_cubid_score: number | null
          locked_max_cubid_score: number | null
          monthly_cycle_id: number | null
          native_atomic_amount: number | null
          package_id: number | null
          project_fee_exact_usd: number | null
          project_id: number | null
          rail_key: string | null
          rate_usd_per_unit: number | null
          source_evidence_hash: string | null
          source_kind: string | null
          source_lot_id: number | null
          source_lot_key: string | null
          source_position: number | null
          source_preliminary_exact_usd: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_package_cohort_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_lock_candidates"
            referencedColumns: ["package_id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_package_operator_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "epoch_project_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_valuation_source_lots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_lock_candidates: {
        Row: {
          attribution_dataset_id: number | null
          canonical_cycle_id: number | null
          compliance_snapshot_id: number | null
          eligible_user_count: number | null
          manifest_hash: string | null
          package_id: number | null
          preliminary_usd: number | null
          project_id: number | null
          version: number | null
        }
        Insert: {
          attribution_dataset_id?: number | null
          canonical_cycle_id?: number | null
          compliance_snapshot_id?: number | null
          eligible_user_count?: number | null
          manifest_hash?: string | null
          package_id?: number | null
          preliminary_usd?: number | null
          project_id?: number | null
          version?: number | null
        }
        Update: {
          attribution_dataset_id?: number | null
          canonical_cycle_id?: number | null
          compliance_snapshot_id?: number | null
          eligible_user_count?: number | null
          manifest_hash?: string | null
          package_id?: number | null
          preliminary_usd?: number | null
          project_id?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_packages_attribution_dataset_id_fkey"
            columns: ["attribution_dataset_id"]
            isOneToOne: false
            referencedRelation: "project_attribution_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_canonical_cycle_id_fkey"
            columns: ["canonical_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_compliance_snapshot_id_fkey"
            columns: ["compliance_snapshot_id"]
            isOneToOne: false
            referencedRelation: "project_compliance_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_project_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_operator_view: {
        Row: {
          base_fee_deferred: boolean | null
          canonical_cycle_key: string | null
          cohort_count: number | null
          compliance_status: string | null
          cubid_status: string | null
          cutoff_at: string | null
          eligible_user_count: number | null
          funding_source_count: number | null
          funding_status: string | null
          held_user_count: number | null
          id: number | null
          intended_cycle_key: string | null
          list_status: string | null
          manifest_hash: string | null
          payment_count: number | null
          preliminary_usd: number | null
          project_fee_assessed_once: boolean | null
          project_id: number | null
          project_name: string | null
          project_slug: string | null
          reconciliation_deadline_at: string | null
          reconciliation_email_delivered_at: string | null
          status: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_project_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_project_package_public_preliminary: {
        Row: {
          cohort_count: number | null
          cycle_key: string | null
          eligible_user_count: number | null
          funding_source_count: number | null
          held_user_count: number | null
          manifest_hash: string | null
          preliminary_usd: number | null
          project_name: string | null
          project_slug: string | null
          status: string | null
          version: number | null
        }
        Relationships: []
      }
      epoch_shadow_observability: {
        Row: {
          accounting_period_id: number | null
          completed_at: string | null
          current_stage: string | null
          is_paused: boolean | null
          latest_attempt_id: number | null
          latest_attempt_status: string | null
          latest_failure_code: string | null
          latest_target_stage: string | null
          latest_trigger_type: string | null
          legacy_compatibility_status: string | null
          legacy_status_snapshot: string | null
          monthly_cycle_id: number | null
          pause_reason: string | null
          shadow_state_id: number | null
          started_at: string | null
          state_version: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epoch_shadow_states_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: true
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_shadow_states_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: true
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cutover_canonical_credit_reads: {
        Row: {
          allocation_breakdown: Json | null
          asset_fills: Json | null
          canonical_obligation_id: number | null
          canonical_state: string | null
          credited_at: string | null
          currency_code: string | null
          id: number | null
          monthly_cycle_id: number | null
          payment_status: string | null
          read_source: string | null
          run_id: number | null
          source_breakdown: Json | null
          source_result_id: number | null
          status: string | null
          usd_equivalent_amount: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "zkas_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_source_result_id_fkey"
            columns: ["source_result_id"]
            isOneToOne: false
            referencedRelation: "zkas_run_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      financial_cutover_compatibility_positions: {
        Row: {
          canonical_minor: number | null
          canonical_obligation_id: number | null
          canonical_state: string | null
          legacy_credit_id: number | null
          legacy_status: string | null
          monthly_cycle_id: number | null
          read_source: string | null
          usd_equivalent_amount: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cycle_bookkeeping_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      financial_cutover_reconciliation_report: {
        Row: {
          activated_at: string | null
          blocker_count: number | null
          canonical_minor_total: number | null
          deployment_environment: string | null
          difference_minor: number | null
          legacy_minor_total: number | null
          linked_source_count: number | null
          manifest_hash: string | null
          prepared_at: string | null
          rolled_back_at: string | null
          run_id: number | null
          source_count: number | null
          status: string | null
          warning_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_runs_deployment_environment_fkey"
            columns: ["deployment_environment"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runtime_controls"
            referencedColumns: ["deployment_environment"]
          },
        ]
      }
      financial_cutover_source_report: {
        Row: {
          canonical_id: string | null
          canonical_minor: number | null
          canonical_type: string | null
          classification: string | null
          classification_evidence_hash: string | null
          currency_code: string | null
          difference_minor: number | null
          difference_type: string | null
          ledger_transaction_id: number | null
          legacy_minor: number | null
          monthly_cycle_id: number | null
          project_id: number | null
          run_id: number | null
          severity: string | null
          source_hash: string | null
          source_id: string | null
          source_type: string | null
          user_id: string | null
          withdrawal_obligation_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_cutover_canonical_links_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_canonical_credit_reads"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_compatibility_positions"
            referencedColumns: ["canonical_obligation_id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligation_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_canonical_links_withdrawal_obligation_id_fkey"
            columns: ["withdrawal_obligation_id"]
            isOneToOne: false
            referencedRelation: "user_withdrawal_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_reconciliation_report"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "financial_cutover_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cutover_source_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
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
      shadow_financial_reconciliation_observability: {
        Row: {
          applied_native_amount: number | null
          close_package_status: string | null
          event_id: number | null
          event_type: string | null
          journal_count: number | null
          legacy_timestamp_evidence: Json | null
          observed_at: string | null
          occurred_at: string | null
          ordering_status: string | null
          provider_event_id: string | null
          provider_key: string | null
          settled_native_amount: number | null
          suspense_count: number | null
          unmatched_native_amount: number | null
          variance_classification: string | null
          variance_native_amount: number | null
        }
        Relationships: []
      }
      shadow_ledger_trial_balance: {
        Row: {
          account_id: number | null
          accounting_period_id: number | null
          asset_id: number | null
          custody_account_id: number | null
          functional_usd_balance: number | null
          ledger_transaction_id: number | null
          native_atomic_balance: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "financial_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "financial_custody_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_acss_debit_status: {
        Row: {
          available_for_package: boolean | null
          command_id: string | null
          created_at: string | null
          currency_code: string | null
          expected_amount_minor: number | null
          payment_id: number | null
          project_id: number | null
          reversed: boolean | null
          status: string | null
          status_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_acss_debit_commands_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_acss_debit_commands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_bank_transfer_status: {
        Row: {
          available_for_shadow_close: boolean | null
          created_at: string | null
          currency_code: string | null
          expected_amount_minor: number | null
          fee_amount_minor: number | null
          gross_amount_minor: number | null
          intent_id: number | null
          net_amount_minor: number | null
          ordering_status: string | null
          payment_id: number | null
          project_id: number | null
          status: string | null
          status_at: string | null
          sweep_evidence_pending: boolean | null
          topology_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_bank_transfer_intents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_bank_transfer_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_pay_by_bank_status: {
        Row: {
          available_for_package: boolean | null
          command_id: string | null
          created_at: string | null
          currency_code: string | null
          expected_amount_minor: number | null
          payment_id: number | null
          project_id: number | null
          reversed: boolean | null
          status: string | null
          status_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_pay_by_bank_commands_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_pay_by_bank_commands_project_id_fkey"
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
      user_stripe_connect_payouts: {
        Row: {
          created_at: string | null
          currency_code: string | null
          failure_code: string | null
          gross_minor: number | null
          id: number | null
          ledger_transaction_id: number | null
          net_minor: number | null
          settled_at: string | null
          status: string | null
          submitted_at: string | null
          user_fee_minor: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connect_payout_commands_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: true
            referencedRelation: "shadow_ledger_trial_balance"
            referencedColumns: ["ledger_transaction_id"]
          },
        ]
      }
      user_withdrawal_asset_inventory: {
        Row: {
          asset_key: string | null
          available_minor: number | null
          lot_count: number | null
          oldest_cycle_id: number | null
          project_id: number | null
          rail_key: string | null
          symbol: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_inventory_lots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_inventory_lots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_withdrawal_obligation_balances: {
        Row: {
          available_minor: number | null
          closed_minor: number | null
          held_minor: number | null
          id: number | null
          monthly_cycle_id: number | null
          paid_minor: number | null
          queued_minor: number | null
          reserved_minor: number | null
          state: string | null
          total_minor: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_withdrawal_obligations_monthly_cycle_id_fkey"
            columns: ["monthly_cycle_id"]
            isOneToOne: false
            referencedRelation: "monthly_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_withdrawal_obligations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      accept_project_invitation: {
        Args: {
          p_actor_email: string
          p_actor_user_id: string
          p_token_digest: string
        }
        Returns: {
          accepted_at: string
          invitation_id: string
          invited_role: string
          organization_id: number
          project_id: number
          project_name: string
          project_slug: string
          status: string
        }[]
      }
      accept_project_invitation_review: {
        Args: {
          p_actor_email: string
          p_actor_user_id: string
          p_content_hash: string
          p_document_identifier: string
          p_locale: string
          p_shared_profile_fields: Json
          p_token_digest: string
        }
        Returns: {
          accepted_at: string
          evidence_id: string
          invitation_id: string
          invited_role: string
          organization_id: number
          policy_status: string
          project_id: number
          project_name: string
          project_slug: string
          shared_profile_fields: Json
          status: string
        }[]
      }
      acknowledge_stripe_acss_debit_checkout: {
        Args: { p_command: Json }
        Returns: string
      }
      acknowledge_stripe_pay_by_bank_checkout: {
        Args: { p_command: Json }
        Returns: string
      }
      activate_financial_cutover: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      activate_financial_cutover_unchecked: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      activate_financial_cutover_without_complete_supersession_events: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      apply_external_funding: {
        Args: {
          p_deployment_environment: string
          p_event_id: number
          p_evidence_hash: string
          p_financial_reference_id: number
          p_native_amount: number
        }
        Returns: number
      }
      approve_epoch_allocation_close: {
        Args: { p_command: Json }
        Returns: Json
      }
      assert_financial_cutover_activation_current: {
        Args: { p_run_id: number }
        Returns: undefined
      }
      authorize_base_safe_payout: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      can_read_ledger_transaction: {
        Args: { p_transaction_id: number }
        Returns: boolean
      }
      claim_epoch_shadow_attempt: {
        Args: {
          p_deployment_environment: string
          p_now: string
          p_worker_id: string
        }
        Returns: {
          attempt_id: number
          claim_token: string
          expected_stage: string
          expected_state_version: number
          input_manifest_hash: string
          shadow_state_id: number
          target_stage: string
        }[]
      }
      clamp_epoch_fee_bps: {
        Args: { p_max: number; p_min: number; p_requested: number }
        Returns: number
      }
      complete_epoch_shadow_attempt: {
        Args: {
          p_artifacts: Json
          p_attempt_id: number
          p_claim_token: string
          p_completed_at: string
          p_deployment_environment: string
          p_failure_code: string
          p_gate_results: Json
          p_succeeded: boolean
        }
        Returns: string
      }
      confirm_base_safe_payout_authorization: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      confirm_epoch_allocation_close_root: {
        Args: { p_command: Json }
        Returns: Json
      }
      create_user_withdrawal_request: {
        Args: {
          p_actor_user_id: string
          p_idempotency_key: string
          p_payout_route_id: number
        }
        Returns: {
          credit_count: number
          currency_code: string
          no_payout_executed: boolean
          payout_route_id: number
          request_id: string
          requested_at: string
          requested_usd_amount: number
          status: string
        }[]
      }
      create_user_withdrawal_request_v2: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      create_user_withdrawal_request_v3: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      decide_epoch_project_package: {
        Args: { p_command: Json }
        Returns: number
      }
      decline_project_invitation_review: {
        Args: {
          p_actor_email: string
          p_actor_user_id: string
          p_token_digest: string
        }
        Returns: {
          invitation_id: string
          recorded_at: string
          status: string
        }[]
      }
      enqueue_epoch_shadow_attempt: {
        Args: {
          p_actor_user_id: string
          p_deployment_environment: string
          p_expected_stage: string
          p_expected_state_version: number
          p_idempotency_key: string
          p_input_manifest_hash: string
          p_scheduled_for: string
          p_shadow_state_id: number
          p_target_stage: string
          p_trigger_type: string
        }
        Returns: number
      }
      epoch_allocation_runtime_enabled: {
        Args: { p_environment: string }
        Returns: boolean
      }
      epoch_close_runtime_enabled: {
        Args: { p_environment: string }
        Returns: boolean
      }
      epoch_financial_prep_runtime_enabled: {
        Args: { p_environment: string }
        Returns: boolean
      }
      epoch_project_package_business_deadline: {
        Args: { p_delivered_at: string }
        Returns: string
      }
      epoch_project_package_pseudonym: {
        Args: { p_project_id: number; p_user_id: string }
        Returns: string
      }
      epoch_project_package_runtime_enabled: {
        Args: { p_environment: string }
        Returns: boolean
      }
      epoch_shadow_next_stage: { Args: { p_stage: string }; Returns: string }
      expire_project_invitations_review: {
        Args: { p_invitee_email?: string; p_project_id: number }
        Returns: number
      }
      expire_withdrawal_inventory_reservations: {
        Args: { p_environment: string; p_now: string }
        Returns: number
      }
      finalize_onchain_payment_reconciliation: {
        Args: {
          p_confirmation_count: number
          p_failure_code: string
          p_failure_reason: string
          p_last_checked_at: string
          p_matched_log_index: number
          p_payment_confirmed_at: string
          p_payment_id: number
          p_payment_note: string
          p_payment_status_id: number
          p_payment_updated_at: string
          p_submission_confirmed_at: string
          p_submission_id: number
          p_submission_reconciled_at: string
          p_submission_status: string
        }
        Returns: undefined
      }
      finalize_silent_epoch_project_packages: {
        Args: { p_environment: string; p_now?: string }
        Returns: number
      }
      financial_cutover_current_source_hash: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: string
      }
      financial_cutover_runtime_enabled: {
        Args: { p_capability: string; p_environment: string }
        Returns: boolean
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
      get_base_safe_payout_authorization_input: {
        Args: { p_deployment_id: number; p_payout_intent_id: number }
        Returns: Json
      }
      get_public_epoch_project_package: {
        Args: { p_cycle_key: string; p_project_slug: string }
        Returns: {
          cohort_count: number | null
          cycle_key: string | null
          eligible_user_count: number | null
          funding_source_count: number | null
          held_user_count: number | null
          manifest_hash: string | null
          preliminary_usd: number | null
          project_name: string | null
          project_slug: string | null
          status: string | null
          version: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "epoch_project_package_public_preliminary"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      harvest_epoch_source_lot: { Args: { p_command: Json }; Returns: number }
      harvest_expired_epoch_source_lots: {
        Args: {
          p_environment: string
          p_limit?: number
          p_target_cycle_key: string
        }
        Returns: number
      }
      ingest_external_financial_event: {
        Args: {
          p_asset_id: number
          p_custody_account_id: number
          p_deployment_environment: string
          p_event_type: string
          p_evidence_hash: string
          p_legacy_timestamp_evidence: Json
          p_occurred_at: string
          p_provider_event_id: string
          p_provider_key: string
          p_provider_sequence: number
          p_settled_native_amount: number
        }
        Returns: number
      }
      ingest_stripe_acss_debit_webhook: {
        Args: { p_command: Json }
        Returns: number
      }
      ingest_stripe_bank_transfer_webhook: {
        Args: { p_command: Json }
        Returns: {
          evidence_id: number
          ledger_transaction_id: number
          webhook_event_id: number
        }[]
      }
      ingest_stripe_connect_webhook: {
        Args: { p_command: Json }
        Returns: Json
      }
      ingest_stripe_connect_webhook_once: {
        Args: { p_command: Json }
        Returns: Json
      }
      ingest_stripe_pay_by_bank_webhook: {
        Args: { p_command: Json }
        Returns: number
      }
      inspect_project_invitation_review: {
        Args: {
          p_actor_email: string
          p_actor_user_id: string
          p_token_digest: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          invited_role: string
          policy_content_hash: string
          policy_document_identifier: string
          policy_locale: string
          policy_status: string
          project_id: number
          project_name: string
          project_slug: string
          shared_profile_fields: Json
          status: string
        }[]
      }
      is_project_financial_admin: {
        Args: { p_actor_user_id: string; p_project_id: number }
        Returns: boolean
      }
      list_discoverable_public_user_ids: {
        Args: never
        Returns: {
          fields: Json
          user_id: string
        }[]
      }
      list_epoch_project_packages: {
        Args: { p_actor_user_id: string; p_project_slug?: string }
        Returns: {
          base_fee_deferred: boolean | null
          canonical_cycle_key: string | null
          cohort_count: number | null
          compliance_status: string | null
          cubid_status: string | null
          cutoff_at: string | null
          eligible_user_count: number | null
          funding_source_count: number | null
          funding_status: string | null
          held_user_count: number | null
          id: number | null
          intended_cycle_key: string | null
          list_status: string | null
          manifest_hash: string | null
          payment_count: number | null
          preliminary_usd: number | null
          project_fee_assessed_once: boolean | null
          project_id: number | null
          project_name: string | null
          project_slug: string | null
          reconciliation_deadline_at: string | null
          reconciliation_email_delivered_at: string | null
          status: string | null
          version: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "epoch_project_package_operator_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_project_member_shared_profiles: {
        Args: { p_actor_user_id: string; p_project_id: number }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          is_admin: boolean
          location_name: string
          occupation_name: string
          profile_headline: string
          shared_profile_fields: Json
          user_id: string
        }[]
      }
      list_project_stripe_acss_debit_status: {
        Args: { p_actor_user_id: string; p_project_slug: string }
        Returns: {
          available_for_package: boolean | null
          command_id: string | null
          created_at: string | null
          currency_code: string | null
          expected_amount_minor: number | null
          payment_id: number | null
          project_id: number | null
          reversed: boolean | null
          status: string | null
          status_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "stripe_acss_debit_status"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_project_stripe_bank_transfer_status: {
        Args: { p_actor_user_id: string; p_project_slug: string }
        Returns: {
          available_for_shadow_close: boolean | null
          created_at: string | null
          currency_code: string | null
          expected_amount_minor: number | null
          fee_amount_minor: number | null
          gross_amount_minor: number | null
          intent_id: number | null
          net_amount_minor: number | null
          ordering_status: string | null
          payment_id: number | null
          project_id: number | null
          status: string | null
          status_at: string | null
          sweep_evidence_pending: boolean | null
          topology_status: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "stripe_bank_transfer_status"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_project_stripe_pay_by_bank_status: {
        Args: { p_actor_user_id: string; p_project_slug: string }
        Returns: {
          available_for_package: boolean | null
          command_id: string | null
          created_at: string | null
          currency_code: string | null
          expected_amount_minor: number | null
          payment_id: number | null
          project_id: number | null
          reversed: boolean | null
          status: string | null
          status_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "stripe_pay_by_bank_status"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lock_funded_epoch_allocation: { Args: { p_command: Json }; Returns: Json }
      manage_user_withdrawal_request: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_environment: string
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      place_withdrawal_compliance_hold: {
        Args: {
          p_actor_user_id: string
          p_environment: string
          p_evidence_hash: string
          p_reason_code: string
          p_request_id: string
        }
        Returns: Json
      }
      post_epoch_fx_snapshot: { Args: { p_command: Json }; Returns: number }
      post_neutral_ledger_transaction: {
        Args: { p_command: Json }
        Returns: number
      }
      post_shadow_financial_journal: {
        Args: {
          p_comparison_status: string
          p_deployment_environment: string
          p_detail: Json
          p_event_id: number
          p_evidence_hash: string
          p_journal_type: string
          p_ledger_transaction_id: number
        }
        Returns: number
      }
      prepare_epoch_financial_sources: {
        Args: { p_command: Json }
        Returns: number
      }
      prepare_epoch_project_package_email: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_environment: string
          p_package_id: number
        }
        Returns: {
          evidence_hash: string
          package_id: number
          recipient_email: string
          recipient_hash: string
          subject: string
          text_body: string
        }[]
      }
      prepare_epoch_withdrawal_obligations: {
        Args: {
          p_actor_user_id: string
          p_close_package_id: number
          p_environment: string
        }
        Returns: Json
      }
      prepare_financial_cutover: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      prepare_stripe_acss_debit_command: {
        Args: { p_command: Json }
        Returns: string
      }
      prepare_stripe_connect_payout: {
        Args: {
          p_actor_user_id: string
          p_environment: string
          p_payout_intent_id: number
        }
        Returns: Json
      }
      prepare_stripe_connect_payout_once: {
        Args: {
          p_actor_user_id: string
          p_environment: string
          p_payout_intent_id: number
        }
        Returns: Json
      }
      prepare_stripe_pay_by_bank_command: {
        Args: { p_command: Json }
        Returns: string
      }
      publish_project_onboarding_draft_atomic: {
        Args: {
          p_billing_email: string
          p_billing_frequency: string
          p_category_ids: number[]
          p_contact_email: string
          p_default_payment_method_id: number
          p_default_reporting_currency_code?: string
          p_description: string
          p_detailed_description: string
          p_logo_url: string
          p_name: string
          p_payment_percentage: number
          p_payment_periodicity_id: number
          p_slug: string
          p_website: string
        }
        Returns: {
          project_id: number
          project_slug: string
        }[]
      }
      read_epoch_close_scope: {
        Args: {
          p_actor_user_id: string
          p_cycle_key: string
          p_project_id?: number
          p_scope: string
        }
        Returns: Json
      }
      reconcile_base_intake_v2_receipt: {
        Args: { p_command: Json }
        Returns: number
      }
      reconcile_base_intake_v2_receipt_trusted_internal: {
        Args: { p_command: Json }
        Returns: number
      }
      reconcile_base_safe_payout: { Args: { p_command: Json }; Returns: Json }
      record_base_intake_v2_receipt: {
        Args: { p_command: Json }
        Returns: number
      }
      record_custody_reconciliation: {
        Args: {
          p_asset_id: number
          p_custody_account_id: number
          p_deployment_environment: string
          p_evidence_hash: string
          p_observed_at: string
          p_provider_native: number
          p_tolerance: number
        }
        Returns: number
      }
      record_epoch_fx_observation: {
        Args: { p_command: Json }
        Returns: number
      }
      record_epoch_project_package_email_delivery: {
        Args: { p_command: Json }
        Returns: number
      }
      record_epoch_stage_override: {
        Args: {
          p_actor_context: string
          p_actor_user_id: string
          p_attempt_id: number
          p_deployment_environment: string
          p_evidence_hash: string
          p_gate_key: string
          p_reason: string
        }
        Returns: number
      }
      record_funded_epoch_allocation: {
        Args: { p_command: Json }
        Returns: number
      }
      record_profile_publication_choice: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_content_hash: string
          p_document_identifier: string
          p_fields: Json
          p_locale: string
          p_source_surface: string
        }
        Returns: {
          consent_id: string
          is_public: boolean
          recorded_at: string
        }[]
      }
      record_review_policy_acknowledgement: {
        Args: {
          p_actor_capacity: string
          p_actor_user_id: string
          p_content_hash: string
          p_document_identifier: string
          p_locale: string
          p_source_surface: string
        }
        Returns: {
          acceptance_id: string
          recorded_at: string
        }[]
      }
      record_stripe_bank_transfer_intent: {
        Args: { p_command: Json }
        Returns: number
      }
      record_stripe_connect_payout_failure: {
        Args: {
          p_command_id: number
          p_failure_code: string
          p_transfer_id: string
        }
        Returns: Json
      }
      record_stripe_connect_payout_submission: {
        Args: {
          p_command_id: number
          p_payout_id: string
          p_provider_request_id: string
          p_transfer_id: string
        }
        Returns: Json
      }
      replace_user_asset_preferences_atomic: {
        Args: { p_preferences?: Json; p_user_id: string }
        Returns: {
          accepted: boolean
          asset_code: string
          asset_type: Database["public"]["Enums"]["user_asset_preference_type"]
          created_at: string
          created_by_user_id: string | null
          id: number
          project_id: number | null
          rank: number
          updated_at: string
          updated_by_user_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_asset_preferences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_withdrawal_inventory: {
        Args: { p_now?: string; p_request_id: string }
        Returns: boolean
      }
      reverse_neutral_ledger_transaction: {
        Args: { p_command: Json }
        Returns: number
      }
      revoke_project_invitation_review: {
        Args: { p_actor_user_id: string; p_invitation_id: string }
        Returns: {
          invitation_id: string
          recorded_at: string
          status: string
        }[]
      }
      rollback_financial_cutover: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      set_epoch_shadow_pause: {
        Args: {
          p_actor_user_id: string
          p_deployment_environment: string
          p_expected_state_version: number
          p_paused: boolean
          p_reason: string
          p_shadow_state_id: number
        }
        Returns: number
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
      stripe_connect_runtime_enabled: {
        Args: { p_capability: string; p_environment: string }
        Returns: boolean
      }
      sync_stripe_connect_account: {
        Args: { p_actor_user_id: string; p_command: Json }
        Returns: Json
      }
      validate_epoch_project_package: {
        Args: { p_command: Json }
        Returns: number
      }
      validate_epoch_project_package_without_acss: {
        Args: { p_command: Json }
        Returns: number
      }
      validate_epoch_project_package_without_pay_by_bank: {
        Args: { p_command: Json }
        Returns: number
      }
      withdrawal_runtime_enabled: {
        Args: { p_environment: string }
        Returns: boolean
      }
    }
    Enums: {
      cubid_identity_status: "unlinked" | "linked" | "verified"
      monthly_cycle_report_audience: "public" | "user" | "founder" | "operator"
      monthly_cycle_status:
        | "open"
        | "locked"
        | "prep"
        | "calculation"
        | "verification"
        | "approval"
        | "distribution"
        | "completed"
        | "reporting"
      organization_members_status: "active" | "inactive" | "deleted"
      organizations_status: "active" | "inactive" | "deleted"
      payment_collection_mode: "contract" | "deposit_address"
      payments_status: "active" | "inactive" | "deleted"
      payout_batch_status:
        | "draft"
        | "ready"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      payout_intent_status:
        | "draft"
        | "ready"
        | "batched"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
      payout_rail: "evm" | "solana" | "fiat_stub"
      payout_reconciliation_status:
        | "pending"
        | "matched"
        | "mismatch"
        | "manual_review"
        | "resolved"
      payout_route_status: "draft" | "active" | "disabled"
      projects_status: "active" | "inactive" | "deleted"
      user_asset_preference_type: "project_token" | "stablecoin" | "fiat"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cubid_identity_status: ["unlinked", "linked", "verified"],
      monthly_cycle_report_audience: ["public", "user", "founder", "operator"],
      monthly_cycle_status: [
        "open",
        "locked",
        "prep",
        "calculation",
        "verification",
        "approval",
        "distribution",
        "completed",
        "reporting",
      ],
      organization_members_status: ["active", "inactive", "deleted"],
      organizations_status: ["active", "inactive", "deleted"],
      payment_collection_mode: ["contract", "deposit_address"],
      payments_status: ["active", "inactive", "deleted"],
      payout_batch_status: [
        "draft",
        "ready",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      payout_intent_status: [
        "draft",
        "ready",
        "batched",
        "processing",
        "paid",
        "failed",
        "cancelled",
      ],
      payout_rail: ["evm", "solana", "fiat_stub"],
      payout_reconciliation_status: [
        "pending",
        "matched",
        "mismatch",
        "manual_review",
        "resolved",
      ],
      payout_route_status: ["draft", "active", "disabled"],
      projects_status: ["active", "inactive", "deleted"],
      user_asset_preference_type: ["project_token", "stablecoin", "fiat"],
      users_status: ["active", "inactive", "deleted"],
      wallet_accounts_status: ["active", "inactive", "deleted"],
      wallet_connections_status: ["active", "inactive", "deleted"],
      zkas_dataset_status: [
        "uploaded",
        "validated",
        "failed",
        "approved",
        "included",
        "replaced",
        "archived",
      ],
      zkas_execution_mode: ["local", "nitro"],
      zkas_issue_severity: ["error", "warning"],
      zkas_run_status: [
        "draft",
        "locked",
        "running",
        "completed",
        "failed",
        "finalized",
      ],
      zkas_verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const
