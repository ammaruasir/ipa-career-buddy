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
          end_reason: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          id: string
          job_position: string | null
          mode: Database["public"]["Enums"]["interview_mode"]
          questions: Json | null
          recording_chunk_count: number | null
          recording_chunks_path: string | null
          recording_duration_ms: number | null
          recording_status: string | null
          recording_url: string | null
          status: Database["public"]["Enums"]["interview_status"]
          type: Database["public"]["Enums"]["interview_type"]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["interview_visibility"]
        }
        Insert: {
          created_at?: string
          end_reason?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          job_position?: string | null
          mode?: Database["public"]["Enums"]["interview_mode"]
          questions?: Json | null
          recording_chunk_count?: number | null
          recording_chunks_path?: string | null
          recording_duration_ms?: number | null
          recording_status?: string | null
          recording_url?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          type: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["interview_visibility"]
        }
        Update: {
          created_at?: string
          end_reason?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          job_position?: string | null
          mode?: Database["public"]["Enums"]["interview_mode"]
          questions?: Json | null
          recording_chunk_count?: number | null
          recording_chunks_path?: string | null
          recording_duration_ms?: number | null
          recording_status?: string | null
          recording_url?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["interview_visibility"]
        }
        Relationships: []
      }
      proctor_sessions: {
        Row: {
          id: string
          interview_id: string
          proctor_id: string
          role: string
          joined_at: string
          left_at: string | null
          events: Json
          notes: string | null
        }
        Insert: {
          id?: string
          interview_id: string
          proctor_id: string
          role: string
          joined_at?: string
          left_at?: string | null
          events?: Json
          notes?: string | null
        }
        Update: {
          id?: string
          interview_id?: string
          proctor_id?: string
          role?: string
          joined_at?: string
          left_at?: string | null
          events?: Json
          notes?: string | null
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
          coached_at: string | null
          coaching: Json | null
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
          coached_at?: string | null
          coaching?: Json | null
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
          coached_at?: string | null
          coaching?: Json | null
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
      // ==========================================================
      // P0 training-platform pivot — added 2026-05-18
      // (mirrors `supabase gen types`; will be overwritten on next Lovable sync)
      // ==========================================================
      tracks: {
        Row: {
          id: string
          code: string
          name_ar: string
          name_en: string
          description: string | null
          is_active: boolean | null
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name_ar: string
          name_en: string
          description?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name_ar?: string
          name_en?: string
          description?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      competencies: {
        Row: {
          id: string
          code: string
          name_ar: string
          name_en: string
          description: string | null
          is_active: boolean | null
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name_ar: string
          name_en: string
          description?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name_ar?: string
          name_en?: string
          description?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      cohorts: {
        Row: {
          id: string
          name: string
          name_en: string | null
          track: string | null
          description: string | null
          start_date: string
          end_date: string
          instructor_id: string | null
          status: string | null
          capacity: number | null
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          name_en?: string | null
          track?: string | null
          description?: string | null
          start_date: string
          end_date: string
          instructor_id?: string | null
          status?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          name_en?: string | null
          track?: string | null
          description?: string | null
          start_date?: string
          end_date?: string
          instructor_id?: string | null
          status?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          cohort_id: string
          student_id: string
          status: string | null
          enrolled_at: string | null
        }
        Insert: {
          id?: string
          cohort_id: string
          student_id: string
          status?: string | null
          enrolled_at?: string | null
        }
        Update: {
          id?: string
          cohort_id?: string
          student_id?: string
          status?: string | null
          enrolled_at?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          id: string
          cohort_id: string
          type: string
          title: string
          description: string | null
          target_track: string | null
          due_at: string
          requirements: Json | null
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          cohort_id: string
          type: string
          title: string
          description?: string | null
          target_track?: string | null
          due_at: string
          requirements?: Json | null
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          cohort_id?: string
          type?: string
          title?: string
          description?: string | null
          target_track?: string | null
          due_at?: string
          requirements?: Json | null
          created_at?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      instructor_feedback: {
        Row: {
          id: string
          interview_id: string | null
          response_id: string | null
          instructor_id: string
          annotation_text: string
          timestamp_ms: number | null
          feedback_type: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          interview_id?: string | null
          response_id?: string | null
          instructor_id: string
          annotation_text: string
          timestamp_ms?: number | null
          feedback_type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          interview_id?: string | null
          response_id?: string | null
          instructor_id?: string
          annotation_text?: string
          timestamp_ms?: number | null
          feedback_type?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      cv_documents: {
        Row: {
          id: string
          user_id: string
          file_url: string
          file_name: string | null
          file_size: number | null
          uploaded_at: string | null
          extraction: Json | null
          section_scores: Json | null
          weaknesses: Json | null
          rewrites: Json | null
          saudi_compliance: Json | null
          target_role: string | null
          alignment_score: number | null
          analyzed_at: string | null
          model_used: string | null
          tokens_used: number | null
        }
        Insert: {
          id?: string
          user_id: string
          file_url: string
          file_name?: string | null
          file_size?: number | null
          uploaded_at?: string | null
          extraction?: Json | null
          section_scores?: Json | null
          weaknesses?: Json | null
          rewrites?: Json | null
          saudi_compliance?: Json | null
          target_role?: string | null
          alignment_score?: number | null
          analyzed_at?: string | null
          model_used?: string | null
          tokens_used?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          file_url?: string
          file_name?: string | null
          file_size?: number | null
          uploaded_at?: string | null
          extraction?: Json | null
          section_scores?: Json | null
          weaknesses?: Json | null
          rewrites?: Json | null
          saudi_compliance?: Json | null
          target_role?: string | null
          alignment_score?: number | null
          analyzed_at?: string | null
          model_used?: string | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      cv_drafts: {
        Row: {
          id: string
          user_id: string
          personal_info: Json | null
          summary: Json | null
          experience: Json | null
          education: Json | null
          skills: Json | null
          certifications: Json | null
          template: string | null
          language: string | null
          primary_color: string | null
          custom_sections: Json | null
          created_at: string | null
          updated_at: string | null
          last_exported_at: string | null
          export_count: number | null
        }
        Insert: {
          id?: string
          user_id: string
          personal_info?: Json | null
          summary?: Json | null
          experience?: Json | null
          education?: Json | null
          skills?: Json | null
          certifications?: Json | null
          template?: string | null
          language?: string | null
          primary_color?: string | null
          custom_sections?: Json | null
          created_at?: string | null
          updated_at?: string | null
          last_exported_at?: string | null
          export_count?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          personal_info?: Json | null
          summary?: Json | null
          experience?: Json | null
          education?: Json | null
          skills?: Json | null
          certifications?: Json | null
          template?: string | null
          language?: string | null
          primary_color?: string | null
          custom_sections?: Json | null
          created_at?: string | null
          updated_at?: string | null
          last_exported_at?: string | null
          export_count?: number | null
        }
        Relationships: []
      }
      cv_conversations: {
        Row: {
          id: string
          user_id: string
          cv_document_id: string | null
          cv_draft_id: string | null
          messages: Json | null
          language: string | null
          created_at: string | null
          updated_at: string | null
          last_message_at: string | null
          total_messages: number | null
          total_tokens: number | null
        }
        Insert: {
          id?: string
          user_id: string
          cv_document_id?: string | null
          cv_draft_id?: string | null
          messages?: Json | null
          language?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_message_at?: string | null
          total_messages?: number | null
          total_tokens?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          cv_document_id?: string | null
          cv_draft_id?: string | null
          messages?: Json | null
          language?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_message_at?: string | null
          total_messages?: number | null
          total_tokens?: number | null
        }
        Relationships: []
      }
      cv_interview_sessions: {
        Row: {
          id: string
          user_id: string
          status: string | null
          current_step: number | null
          total_steps: number | null
          answers: Json | null
          target_role: string | null
          target_industry: string | null
          language: string | null
          experience_level: string | null
          generated_draft_id: string | null
          created_at: string | null
          updated_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: string | null
          current_step?: number | null
          total_steps?: number | null
          answers?: Json | null
          target_role?: string | null
          target_industry?: string | null
          language?: string | null
          experience_level?: string | null
          generated_draft_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: string | null
          current_step?: number | null
          total_steps?: number | null
          answers?: Json | null
          target_role?: string | null
          target_industry?: string | null
          language?: string | null
          experience_level?: string | null
          generated_draft_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          id: number
          user_id: string
          scope: string
          occurred_at: string
        }
        Insert: {
          id?: number
          user_id: string
          scope: string
          occurred_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          scope?: string
          occurred_at?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          id: string
          user_id: string
          consent_type: string
          granted: boolean
          granted_at: string
          revoked_at: string | null
          version: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          user_id: string
          consent_type: string
          granted: boolean
          granted_at?: string
          revoked_at?: string | null
          version?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          consent_type?: string
          granted?: boolean
          granted_at?: string
          revoked_at?: string | null
          version?: string | null
          ip_address?: string | null
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
      // P0 — added 2026-05-18
      check_rate_limit: {
        Args: {
          p_user_id: string
          p_scope: string
          p_max: number
          p_window_seconds: number
        }
        Returns: { allowed: boolean; current_count: number; retry_after_seconds: number }[]
      }
      has_active_consent: {
        Args: {
          p_user_id: string
          p_consent_type: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "admin" | "hr" | "candidate" | "instructor"
      interview_status: "pending" | "in_progress" | "completed" | "cancelled"
      interview_type: "text" | "voice" | "video"
      interview_mode: "practice" | "assessment" | "mock_final"
      interview_visibility: "private" | "instructor" | "hr"
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
      interview_mode: ["practice", "assessment", "mock_final"],
      interview_visibility: ["private", "instructor", "hr"],
    },
  },
} as const
