export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      channels: {
        Row: {
          artwork_storage_path: string | null
          artwork_url: string | null
          avg_optimization_score: number | null
          created_at: string | null
          description: string | null
          external_id: string | null
          id: string
          last_imported_at: string | null
          name: string
          subscriber_count: number | null
          total_episodes: number | null
          type: string
          updated_at: string | null
          url: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          artwork_storage_path?: string | null
          artwork_url?: string | null
          avg_optimization_score?: number | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          last_imported_at?: string | null
          name: string
          subscriber_count?: number | null
          total_episodes?: number | null
          type: string
          updated_at?: string | null
          url: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          artwork_storage_path?: string | null
          artwork_url?: string | null
          avg_optimization_score?: number | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          last_imported_at?: string | null
          name?: string
          subscriber_count?: number | null
          total_episodes?: number | null
          type?: string
          updated_at?: string | null
          url?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      content_ideas: {
        Row: {
          channel_name: string | null
          created_at: string
          episode_id: string
          episode_title: string | null
          generated_ideas: Json
          id: string
          saved_ideas: number[] | null
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          channel_name?: string | null
          created_at?: string
          episode_id: string
          episode_title?: string | null
          generated_ideas: Json
          id?: string
          saved_ideas?: number[] | null
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          channel_name?: string | null
          created_at?: string
          episode_id?: string
          episode_title?: string | null
          generated_ideas?: Json
          id?: string
          saved_ideas?: number[] | null
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      episode_suggestions: {
        Row: {
          ai_suggestions: Json
          created_at: string
          episode_id: string
          id: string
          original_content: string | null
          saved_suggestions: number[] | null
          suggestion_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_suggestions: Json
          created_at?: string
          episode_id: string
          id?: string
          original_content?: string | null
          saved_suggestions?: number[] | null
          suggestion_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_suggestions?: Json
          created_at?: string
          episode_id?: string
          id?: string
          original_content?: string | null
          saved_suggestions?: number[] | null
          suggestion_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_suggestions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          ai_suggested_description: string | null
          ai_suggested_title: string | null
          artwork_storage_path: string | null
          artwork_url: string | null
          audio_url: string | null
          channel_id: string
          created_at: string | null
          description: string | null
          download_count: number | null
          duration: string | null
          episode_number: number | null
          excluded: boolean | null
          exclusion_notes: string | null
          external_id: string | null
          file_size: number | null
          has_custom_artwork: boolean | null
          id: string
          issues: string[] | null
          optimization_score: number | null
          published_at: string | null
          season_number: number | null
          title: string
          transcript: string | null
          updated_at: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          ai_suggested_description?: string | null
          ai_suggested_title?: string | null
          artwork_storage_path?: string | null
          artwork_url?: string | null
          audio_url?: string | null
          channel_id: string
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          duration?: string | null
          episode_number?: number | null
          excluded?: boolean | null
          exclusion_notes?: string | null
          external_id?: string | null
          file_size?: number | null
          has_custom_artwork?: boolean | null
          id?: string
          issues?: string[] | null
          optimization_score?: number | null
          published_at?: string | null
          season_number?: number | null
          title: string
          transcript?: string | null
          updated_at?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          ai_suggested_description?: string | null
          ai_suggested_title?: string | null
          artwork_storage_path?: string | null
          artwork_url?: string | null
          audio_url?: string | null
          channel_id?: string
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          duration?: string | null
          episode_number?: number | null
          excluded?: boolean | null
          exclusion_notes?: string | null
          external_id?: string | null
          file_size?: number | null
          has_custom_artwork?: boolean | null
          id?: string
          issues?: string[] | null
          optimization_score?: number | null
          published_at?: string | null
          season_number?: number | null
          title?: string
          transcript?: string | null
          updated_at?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
