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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      evaluations: {
        Row: {
          ai_feedback_ar: string | null
          communication_score: number | null
          confidence_score: number | null
          created_at: string
          detailed_scores: Json | null
          filler_words_count: number | null
          id: string
          improvements: Json | null
          interview_id: string
          overall_score: number | null
          personality_match: number | null
          personality_type: string | null
          recommendation: string | null
          sentiment: string | null
          speech_pace: number | null
          strengths: Json | null
          technical_score: number | null
        }
        Insert: {
          ai_feedback_ar?: string | null
          communication_score?: number | null
          confidence_score?: number | null
          created_at?: string
          detailed_scores?: Json | null
          filler_words_count?: number | null
          id?: string
          improvements?: Json | null
          interview_id: string
          overall_score?: number | null
          personality_match?: number | null
          personality_type?: string | null
          recommendation?: string | null
          sentiment?: string | null
          speech_pace?: number | null
          strengths?: Json | null
          technical_score?: number | null
        }
        Update: {
          ai_feedback_ar?: string | null
          communication_score?: number | null
          confidence_score?: number | null
          created_at?: string
          detailed_scores?: Json | null
          filler_words_count?: number | null
          id?: string
          improvements?: Json | null
          interview_id?: string
          overall_score?: number | null
          personality_match?: number | null
          personality_type?: string | null
          recommendation?: string | null
          sentiment?: string | null
          speech_pace?: number | null
          strengths?: Json | null
          technical_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_notes: {
        Row: {
          action: string | null
          author_id: string
          created_at: string
          id: string
          interview_id: string
          note_text: string | null
        }
        Insert: {
          action?: string | null
          author_id: string
          created_at?: string
          id?: string
          interview_id: string
          note_text?: string | null
        }
        Update: {
          action?: string | null
          author_id?: string
          created_at?: string
          id?: string
          interview_id?: string
          note_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_notes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          created_at: string
          id: string
          job_position: string
          questions: Json | null
          status: Database["public"]["Enums"]["interview_status"]
          type: Database["public"]["Enums"]["interview_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_position: string
          questions?: Json | null
          status?: Database["public"]["Enums"]["interview_status"]
          type: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_position?: string
          questions?: Json | null
          status?: Database["public"]["Enums"]["interview_status"]
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_location: string | null
          created_at: string
          full_name: string | null
          gpa: string | null
          id: string
          major: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_location?: string | null
          created_at?: string
          full_name?: string | null
          gpa?: string | null
          id?: string
          major?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_location?: string | null
          created_at?: string
          full_name?: string | null
          gpa?: string | null
          id?: string
          major?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          difficulty: string | null
          id: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          question_text: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          difficulty?: string | null
          id?: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          question_text: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          difficulty?: string | null
          id?: string
          interview_type?: Database["public"]["Enums"]["interview_type"]
          question_text?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          ai_analysis: Json | null
          answer_text: string | null
          created_at: string
          id: string
          interview_id: string
          media_url: string | null
          question_text: string
          scores: Json | null
        }
        Insert: {
          ai_analysis?: Json | null
          answer_text?: string | null
          created_at?: string
          id?: string
          interview_id: string
          media_url?: string | null
          question_text: string
          scores?: Json | null
        }
        Update: {
          ai_analysis?: Json | null
          answer_text?: string | null
          created_at?: string
          id?: string
          interview_id?: string
          media_url?: string | null
          question_text?: string
          scores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          ai_model: string
          brand_color: string
          created_at: string
          evaluation_thresholds: Json
          filler_words: Json
          id: string
          job_positions: Json
          maintenance_mode: boolean
          questions_per_type: Json
          scoring_weights: Json
          time_per_question: Json
          updated_at: string
        }
        Insert: {
          ai_model?: string
          brand_color?: string
          created_at?: string
          evaluation_thresholds?: Json
          filler_words?: Json
          id?: string
          job_positions?: Json
          maintenance_mode?: boolean
          questions_per_type?: Json
          scoring_weights?: Json
          time_per_question?: Json
          updated_at?: string
        }
        Update: {
          ai_model?: string
          brand_color?: string
          created_at?: string
          evaluation_thresholds?: Json
          filler_words?: Json
          id?: string
          job_positions?: Json
          maintenance_mode?: boolean
          questions_per_type?: Json
          scoring_weights?: Json
          time_per_question?: Json
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "admin" | "hr"
      interview_status: "pending" | "in_progress" | "completed" | "cancelled"
      interview_type: "text" | "voice" | "video"
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
      app_role: ["student", "admin", "hr"],
      interview_status: ["pending", "in_progress", "completed", "cancelled"],
      interview_type: ["text", "voice", "video"],
    },
  },
} as const
