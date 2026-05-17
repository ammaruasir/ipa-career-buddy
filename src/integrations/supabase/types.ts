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
      cheat_events: {
        Row: {
          created_at: string
          details: string | null
          event_type: string
          frame_url: string | null
          id: string
          interview_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          event_type: string
          frame_url?: string | null
          id?: string
          interview_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          event_type?: string
          frame_url?: string | null
          id?: string
          interview_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheat_events_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          ai_feedback_ar: string | null
          communication_score: number | null
          confidence_level: string | null
          confidence_score: number | null
          created_at: string
          culture_alignment: number | null
          detailed_scores: Json | null
          filler_words_count: number | null
          final_recommendation: string | null
          id: string
          improvements: Json | null
          interview_id: string
          leadership: number | null
          overall_score: number | null
          personality_match: number | null
          personality_type: string | null
          problem_solving: number | null
          recommendation: string | null
          red_flags: Json | null
          review_status: string | null
          scope: string
          sentiment: string | null
          speech_pace: number | null
          strengths: Json | null
          technical_score: number | null
        }
        Insert: {
          ai_feedback_ar?: string | null
          communication_score?: number | null
          confidence_level?: string | null
          confidence_score?: number | null
          created_at?: string
          culture_alignment?: number | null
          detailed_scores?: Json | null
          filler_words_count?: number | null
          final_recommendation?: string | null
          id?: string
          improvements?: Json | null
          interview_id: string
          leadership?: number | null
          overall_score?: number | null
          personality_match?: number | null
          personality_type?: string | null
          problem_solving?: number | null
          recommendation?: string | null
          red_flags?: Json | null
          review_status?: string | null
          scope?: string
          sentiment?: string | null
          speech_pace?: number | null
          strengths?: Json | null
          technical_score?: number | null
        }
        Update: {
          ai_feedback_ar?: string | null
          communication_score?: number | null
          confidence_level?: string | null
          confidence_score?: number | null
          created_at?: string
          culture_alignment?: number | null
          detailed_scores?: Json | null
          filler_words_count?: number | null
          final_recommendation?: string | null
          id?: string
          improvements?: Json | null
          interview_id?: string
          leadership?: number | null
          overall_score?: number | null
          personality_match?: number | null
          personality_type?: string | null
          problem_solving?: number | null
          recommendation?: string | null
          red_flags?: Json | null
          review_status?: string | null
          scope?: string
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
          mode: string
          persona: string | null
          questions: Json | null
          recording_url: string | null
          status: Database["public"]["Enums"]["interview_status"]
          track: string | null
          type: Database["public"]["Enums"]["interview_type"]
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_position: string
          mode?: string
          persona?: string | null
          questions?: Json | null
          recording_url?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          track?: string | null
          type: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_position?: string
          mode?: string
          persona?: string | null
          questions?: Json | null
          recording_url?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          track?: string | null
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          created_at: string | null
          id: string
          interview_id: string | null
          pipeline_stage: string
          status: string | null
          user_id: string
          vacancy_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interview_id?: string | null
          pipeline_stage?: string
          status?: string | null
          user_id: string
          vacancy_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interview_id?: string | null
          pipeline_stage?: string
          status?: string | null
          user_id?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "job_vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_vacancies: {
        Row: {
          created_at: string | null
          created_by: string
          department: string | null
          description: string | null
          employment_type: string | null
          id: string
          is_active: boolean | null
          location: string | null
          requirements: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          department?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          requirements?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          department?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          requirements?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_location: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          education_level: string | null
          experience_years: number | null
          full_name: string | null
          gender: string | null
          gpa: string | null
          id: string
          major: string | null
          nationality: string | null
          phone: string | null
          profile_completed: boolean | null
          resume_skills: Json | null
          resume_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_location?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          education_level?: string | null
          experience_years?: number | null
          full_name?: string | null
          gender?: string | null
          gpa?: string | null
          id?: string
          major?: string | null
          nationality?: string | null
          phone?: string | null
          profile_completed?: boolean | null
          resume_skills?: Json | null
          resume_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_location?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          education_level?: string | null
          experience_years?: number | null
          full_name?: string | null
          gender?: string | null
          gpa?: string | null
          id?: string
          major?: string | null
          nationality?: string | null
          phone?: string | null
          profile_completed?: boolean | null
          resume_skills?: Json | null
          resume_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_templates: {
        Row: {
          category: string
          competency: string | null
          created_at: string
          created_by: string
          difficulty: string | null
          gov_context: boolean
          id: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          is_scenario: boolean
          language: string
          model_answer_ar: string | null
          question_text: string
          reviewed_by: string | null
          star_rubric: Json | null
          status: string
          track: string | null
        }
        Insert: {
          category?: string
          competency?: string | null
          created_at?: string
          created_by: string
          difficulty?: string | null
          gov_context?: boolean
          id?: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          is_scenario?: boolean
          language?: string
          model_answer_ar?: string | null
          question_text: string
          reviewed_by?: string | null
          star_rubric?: Json | null
          status?: string
          track?: string | null
        }
        Update: {
          category?: string
          competency?: string | null
          created_at?: string
          created_by?: string
          difficulty?: string | null
          gov_context?: boolean
          id?: string
          interview_type?: Database["public"]["Enums"]["interview_type"]
          is_scenario?: boolean
          language?: string
          model_answer_ar?: string | null
          question_text?: string
          reviewed_by?: string | null
          star_rubric?: Json | null
          status?: string
          track?: string | null
        }
        Relationships: []
      }
      responses: {
        Row: {
          ai_analysis: Json | null
          answer_text: string | null
          coaching: Json | null
          created_at: string
          duration_ms: number | null
          id: string
          interview_id: string
          media_url: string | null
          question_index: number | null
          question_text: string
          scores: Json | null
        }
        Insert: {
          ai_analysis?: Json | null
          answer_text?: string | null
          coaching?: Json | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          interview_id: string
          media_url?: string | null
          question_index?: number | null
          question_text: string
          scores?: Json | null
        }
        Update: {
          ai_analysis?: Json | null
          answer_text?: string | null
          coaching?: Json | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          interview_id?: string
          media_url?: string | null
          question_index?: number | null
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
          interview_engine: string
          interviewer_voice: Json
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
          interview_engine?: string
          interviewer_voice?: Json
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
          interview_engine?: string
          interviewer_voice?: Json
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
      cohorts: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          instructor_id: string
          name: string
          start_date: string | null
          status: string
          track: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instructor_id: string
          name: string
          start_date?: string | null
          status?: string
          track?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instructor_id?: string
          name?: string
          start_date?: string | null
          status?: string
          track?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          cohort_id: string
          enrolled_at: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          cohort_id: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          cohort_id?: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          cohort_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          interview_type: string | null
          required_questions: number | null
          target_track: string | null
          title: string
          type: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          interview_type?: string | null
          required_questions?: number | null
          target_track?: string | null
          title: string
          type: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          interview_type?: string | null
          required_questions?: number | null
          target_track?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          cv_document_id: string | null
          id: string
          interview_id: string | null
          status: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          cv_document_id?: string | null
          id?: string
          interview_id?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          cv_document_id?: string | null
          id?: string
          interview_id?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_feedback: {
        Row: {
          annotation_text: string
          created_at: string
          id: string
          instructor_id: string
          target_id: string
          target_type: string
          timestamp_ms: number | null
        }
        Insert: {
          annotation_text: string
          created_at?: string
          id?: string
          instructor_id: string
          target_id: string
          target_type: string
          timestamp_ms?: number | null
        }
        Update: {
          annotation_text?: string
          created_at?: string
          id?: string
          instructor_id?: string
          target_id?: string
          target_type?: string
          timestamp_ms?: number | null
        }
        Relationships: []
      }
      cv_documents: {
        Row: {
          created_at: string
          id: string
          language: string
          parsed: Json | null
          scores: Json | null
          source_path: string | null
          source_type: string
          suggestions: Json | null
          target_role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          parsed?: Json | null
          scores?: Json | null
          source_path?: string | null
          source_type?: string
          suggestions?: Json | null
          target_role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          parsed?: Json | null
          scores?: Json | null
          source_path?: string | null
          source_type?: string
          suggestions?: Json | null
          target_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cv_drafts: {
        Row: {
          created_at: string
          id: string
          language: string
          name: string
          sections: Json
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          name?: string
          sections?: Json
          template?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          name?: string
          sections?: Json
          template?: string
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
      is_instructor_for_student: {
        Args: {
          _instructor_id: string
          _student_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "admin" | "hr" | "candidate" | "instructor"
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
      app_role: ["student", "admin", "hr", "candidate", "instructor"],
      interview_status: ["pending", "in_progress", "completed", "cancelled"],
      interview_type: ["text", "voice", "video"],
    },
  },
} as const
