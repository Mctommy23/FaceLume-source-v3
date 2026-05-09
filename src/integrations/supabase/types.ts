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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activation_orders: {
        Row: {
          created_at: string
          credits_granted: number
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_granted?: number
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_granted?: number
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: []
      }
      activations: {
        Row: {
          access_key: string
          activated_at: string
          created_at: string
          device_id: string
          id: string
          paid: boolean
          paid_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_key: string
          activated_at?: string
          created_at?: string
          device_id: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_key?: string
          activated_at?: string
          created_at?: string
          device_id?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      atlos_webhook_logs: {
        Row: {
          error_message: string | null
          id: string
          order_id: string | null
          payload: Json | null
          received_at: string
          response_code: number | null
          signature_header: string | null
          signature_valid: boolean
          source_ip: string | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          received_at?: string
          response_code?: number | null
          signature_header?: string | null
          signature_valid?: boolean
          source_ip?: string | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          received_at?: string
          response_code?: number | null
          signature_header?: string | null
          signature_valid?: boolean
          source_ip?: string | null
          status?: string | null
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_usd: number
          created_at: string
          credits: number
          id: string
          order_id: string | null
          paid_at: string | null
          plan: string
          status: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          credits: number
          id?: string
          order_id?: string | null
          paid_at?: string | null
          plan: string
          status?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          credits?: number
          id?: string
          order_id?: string | null
          paid_at?: string | null
          plan?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          created_at: string
          credits: number
          display_name: string | null
          id: string
          is_activated: boolean
          is_admin: boolean
          license_key: string | null
          low_credits_notified_at: string | null
          plan: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          id: string
          is_activated?: boolean
          is_admin?: boolean
          license_key?: string | null
          low_credits_notified_at?: string | null
          plan?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          id?: string
          is_activated?: boolean
          is_admin?: boolean
          license_key?: string | null
          low_credits_notified_at?: string | null
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      streaming_sessions: {
        Row: {
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          last_heartbeat_at: string
          seconds_charged: number
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          seconds_charged?: number
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          seconds_charged?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          created_at: string
          id: string
          seconds: number
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seconds: number
          timestamp?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seconds?: number
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_alerts: {
        Row: {
          created_at: string | null
          id: string | null
          message: string | null
          severity: string | null
          source: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
      admin_daily_metrics: {
        Row: {
          activations: number | null
          day: string | null
          estimated_cost: number | null
          profit: number | null
          revenue: number | null
          signups: number | null
          usage_seconds: number | null
        }
        Relationships: []
      }
      admin_revenue_summary: {
        Row: {
          activation_revenue: number | null
          activations_count: number | null
          credits_revenue: number | null
          estimated_cost: number | null
          total_revenue: number | null
          total_seconds: number | null
        }
        Relationships: []
      }
      admin_user_stats: {
        Row: {
          activated_at: string | null
          activation_orders: number | null
          activation_revenue: number | null
          credits: number | null
          credits_revenue: number | null
          display_name: string | null
          estimated_cost: number | null
          estimated_profit: number | null
          is_activated: boolean | null
          is_admin: boolean | null
          joined_at: string | null
          sessions: number | null
          total_revenue: number | null
          total_seconds: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      charge_streaming_session: {
        Args: { _session_id: string; _total_seconds: number; _user_id: string }
        Returns: {
          charged_seconds: number
          credits: number
          ended: boolean
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      end_streaming_session: {
        Args: {
          _reason?: string
          _session_id: string
          _total_seconds?: number
          _user_id: string
        }
        Returns: {
          charged_seconds: number
          credits: number
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_user_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: number
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      start_streaming_session: {
        Args: { _user_id: string }
        Returns: {
          credits: number
          session_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
