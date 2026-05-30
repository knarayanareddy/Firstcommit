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
      ai_audit_events: {
        Row: {
          attempts: number
          citations_found: number | null
          created_at: string
          evidence_manifest: Json
          grounding_gate_passed: boolean
          grounding_gate_reason: string
          id: string
          model_used: string | null
          org_id: string | null
          pack_id: string
          prompt_hash: string | null
          prompt_preview: string | null
          provider_used: string | null
          request_id: string
          response_hash: string | null
          response_preview: string | null
          strip_rate: number | null
          task_type: string
          trace_id: string | null
          unique_files_count: number | null
          user_id: string | null
        }
        Insert: {
          attempts?: number
          citations_found?: number | null
          created_at?: string
          evidence_manifest?: Json
          grounding_gate_passed: boolean
          grounding_gate_reason?: string
          id?: string
          model_used?: string | null
          org_id?: string | null
          pack_id: string
          prompt_hash?: string | null
          prompt_preview?: string | null
          provider_used?: string | null
          request_id: string
          response_hash?: string | null
          response_preview?: string | null
          strip_rate?: number | null
          task_type: string
          trace_id?: string | null
          unique_files_count?: number | null
          user_id?: string | null
        }
        Update: {
          attempts?: number
          citations_found?: number | null
          created_at?: string
          evidence_manifest?: Json
          grounding_gate_passed?: boolean
          grounding_gate_reason?: string
          id?: string
          model_used?: string | null
          org_id?: string | null
          pack_id?: string
          prompt_hash?: string | null
          prompt_preview?: string | null
          provider_used?: string | null
          request_id?: string
          response_hash?: string | null
          response_preview?: string | null
          strip_rate?: number | null
          task_type?: string
          trace_id?: string | null
          unique_files_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_events_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_lead_progress: {
        Row: {
          asked_at: string | null
          id: string
          is_asked: boolean
          pack_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          asked_at?: string | null
          id?: string
          is_asked?: boolean
          pack_id: string
          question_id: string
          user_id: string
        }
        Update: {
          asked_at?: string | null
          id?: string
          is_asked?: boolean
          pack_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ask_lead_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_preferences: {
        Row: {
          audience: string
          created_at: string
          depth: string
          experience_level: string | null
          framework_familiarity: string | null
          glossary_density: string
          id: string
          learner_role: string | null
          learning_style: string
          max_sections_hint: number
          mermaid_enabled: boolean
          output_language: string
          pack_id: string | null
          target_reading_level: string
          tone_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string
          created_at?: string
          depth?: string
          experience_level?: string | null
          framework_familiarity?: string | null
          glossary_density?: string
          id?: string
          learner_role?: string | null
          learning_style?: string
          max_sections_hint?: number
          mermaid_enabled?: boolean
          output_language?: string
          pack_id?: string | null
          target_reading_level?: string
          tone_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          depth?: string
          experience_level?: string | null
          framework_familiarity?: string | null
          glossary_density?: string
          id?: string
          learner_role?: string | null
          learning_style?: string
          max_sections_hint?: number
          mermaid_enabled?: boolean
          output_language?: string
          pack_id?: string | null
          target_reading_level?: string
          tone_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_preferences_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      author_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          slack_handle: string | null
          teams_handle: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          slack_handle?: string | null
          teams_handle?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          slack_handle?: string | null
          teams_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bookmark_collections: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
          pack_id: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          pack_id: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          pack_id?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmark_collections_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          bookmark_type: string
          collection_id: string | null
          created_at: string
          id: string
          is_pinned: boolean | null
          label: string | null
          pack_id: string
          preview_text: string | null
          reference_key: string
          subtitle: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          bookmark_type: string
          collection_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          label?: string | null
          pack_id: string
          preview_text?: string | null
          reference_key: string
          subtitle?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          bookmark_type?: string
          collection_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          label?: string | null
          pack_id?: string
          preview_text?: string | null
          reference_key?: string
          subtitle?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "bookmark_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      change_proposals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          description: string | null
          files: Json
          id: string
          pack_id: string
          patch_unified: string
          pr_url: string | null
          proposal_type: string
          source_id: string
          status: string
          target_base_branch: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          files?: Json
          id?: string
          pack_id: string
          patch_unified: string
          pr_url?: string | null
          proposal_type: string
          source_id: string
          status?: string
          target_base_branch?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          files?: Json
          id?: string
          pack_id?: string
          patch_unified?: string
          pr_url?: string | null
          proposal_type?: string
          source_id?: string
          status?: string
          target_base_branch?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_proposals_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_proposals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_proposals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_feedback: {
        Row: {
          comment: string | null
          create_task: boolean | null
          created_at: string
          id: string
          is_resolved: boolean | null
          message_content: string
          module_id: string | null
          pack_id: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          trace_id: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          create_task?: boolean | null
          created_at?: string
          id?: string
          is_resolved?: boolean | null
          message_content: string
          module_id?: string | null
          pack_id?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          trace_id?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          create_task?: boolean | null
          created_at?: string
          id?: string
          is_resolved?: boolean | null
          message_content?: string
          module_id?: string | null
          pack_id?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          trace_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_feedback_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          module_id: string
          pack_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module_id: string
          pack_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module_id?: string
          pack_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_transcripts_flagged: {
        Row: {
          created_at: string | null
          feedback_id: string
          id: string
          metadata: Json | null
          pack_id: string | null
          pathname: string | null
          transcript: string
        }
        Insert: {
          created_at?: string | null
          feedback_id: string
          id?: string
          metadata?: Json | null
          pack_id?: string | null
          pathname?: string | null
          transcript: string
        }
        Update: {
          created_at?: string | null
          feedback_id?: string
          id?: string
          metadata?: Json | null
          pack_id?: string | null
          pathname?: string | null
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_transcripts_flagged_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "chat_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_transcripts_flagged_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_members: {
        Row: {
          cohort_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          pack_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          pack_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          pack_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_type: string
          id: string
          is_resolved: boolean
          module_key: string
          pack_id: string
          resolved_at: string | null
          resolved_by: string | null
          section_id: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          is_resolved?: boolean
          module_key: string
          pack_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          is_resolved?: boolean
          module_key?: string
          pack_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_feedback_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_freshness: {
        Row: {
          chunk_hash_at_generation: Json | null
          chunks_snapshot: Json | null
          id: string
          is_stale: boolean
          last_checked_at: string | null
          module_key: string
          pack_id: string
          referenced_chunk_ids: string[] | null
          section_id: string
          staleness_details: Json | null
        }
        Insert: {
          chunk_hash_at_generation?: Json | null
          chunks_snapshot?: Json | null
          id?: string
          is_stale?: boolean
          last_checked_at?: string | null
          module_key: string
          pack_id: string
          referenced_chunk_ids?: string[] | null
          section_id: string
          staleness_details?: Json | null
        }
        Update: {
          chunk_hash_at_generation?: Json | null
          chunks_snapshot?: Json | null
          id?: string
          is_stale?: boolean
          last_checked_at?: string | null
          module_key?: string
          pack_id?: string
          referenced_chunk_ids?: string[] | null
          section_id?: string
          staleness_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_freshness_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ratings: {
        Row: {
          created_at: string
          id: string
          module_key: string
          pack_id: string
          rating: number
          section_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          pack_id: string
          rating: number
          section_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          pack_id?: string
          rating?: number
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ratings_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_accepted_answer: boolean | null
          thread_id: string
          upvote_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_accepted_answer?: boolean | null
          thread_id: string
          upvote_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_accepted_answer?: boolean | null
          thread_id?: string
          upvote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_threads: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          is_resolved: boolean | null
          module_key: string | null
          pack_id: string
          reply_count: number | null
          section_id: string | null
          thread_type: string | null
          title: string
          updated_at: string | null
          upvote_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          module_key?: string | null
          pack_id: string
          reply_count?: number | null
          section_id?: string | null
          thread_type?: string | null
          title: string
          updated_at?: string | null
          upvote_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          module_key?: string | null
          pack_id?: string
          reply_count?: number | null
          section_id?: string | null
          thread_type?: string | null
          title?: string
          updated_at?: string | null
          upvote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_threads_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_upvotes: {
        Row: {
          created_at: string | null
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_submissions: {
        Row: {
          ai_feedback: Json | null
          content: string
          exercise_key: string
          hints_used: number | null
          id: string
          pack_id: string
          status: string | null
          submission_type: string
          submitted_at: string | null
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          ai_feedback?: Json | null
          content: string
          exercise_key: string
          hints_used?: number | null
          id?: string
          pack_id: string
          status?: string | null
          submission_type: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          ai_feedback?: Json | null
          content?: string
          exercise_key?: string
          hints_used?: number | null
          id?: string
          pack_id?: string
          status?: string | null
          submission_type?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_submissions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          description: string
          difficulty: string | null
          estimated_minutes: number | null
          evidence_citations: Json | null
          exercise_key: string
          exercise_type: string
          hints: Json | null
          id: string
          module_key: string
          pack_id: string
          section_id: string | null
          sort_order: number | null
          title: string
          verification: Json | null
        }
        Insert: {
          created_at?: string | null
          description: string
          difficulty?: string | null
          estimated_minutes?: number | null
          evidence_citations?: Json | null
          exercise_key: string
          exercise_type: string
          hints?: Json | null
          id?: string
          module_key: string
          pack_id: string
          section_id?: string | null
          sort_order?: number | null
          title: string
          verification?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string
          difficulty?: string | null
          estimated_minutes?: number | null
          evidence_citations?: Json | null
          exercise_key?: string
          exercise_type?: string
          hints?: Json | null
          id?: string
          module_key?: string
          pack_id?: string
          section_id?: string | null
          sort_order?: number | null
          title?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_entries: {
        Row: {
          answer_markdown: string
          created_at: string | null
          created_by: string | null
          id: string
          pack_id: string
          question: string
          related_module_key: string | null
          related_section_id: string | null
          source: string
          status: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          answer_markdown: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          pack_id: string
          question: string
          related_module_key?: string | null
          related_section_id?: string | null
          source?: string
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          answer_markdown?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          pack_id?: string
          question?: string
          related_module_key?: string | null
          related_section_id?: string | null
          source?: string
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_entries_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_suggestions: {
        Row: {
          canonical_question: string
          converted_to_faq_id: string | null
          count: number | null
          example_questions: string[] | null
          id: string
          last_seen_at: string | null
          pack_id: string
          status: string | null
        }
        Insert: {
          canonical_question: string
          converted_to_faq_id?: string | null
          count?: number | null
          example_questions?: string[] | null
          id?: string
          last_seen_at?: string | null
          pack_id: string
          status?: string | null
        }
        Update: {
          canonical_question?: string
          converted_to_faq_id?: string | null
          count?: number | null
          example_questions?: string[] | null
          id?: string
          last_seen_at?: string | null
          pack_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_suggestions_converted_to_faq_id_fkey"
            columns: ["converted_to_faq_id"]
            isOneToOne: false
            referencedRelation: "faq_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_suggestions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_ask_lead: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          questions_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          questions_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          questions_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_ask_lead_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_glossaries: {
        Row: {
          created_at: string
          glossary_data: Json
          glossary_density: string | null
          id: string
          pack_id: string
        }
        Insert: {
          created_at?: string
          glossary_data?: Json
          glossary_density?: string | null
          id?: string
          pack_id: string
        }
        Update: {
          created_at?: string
          glossary_data?: Json
          glossary_density?: string | null
          id?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_glossaries_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_modules: {
        Row: {
          audience: string | null
          contradictions: Json | null
          created_at: string
          depth: string | null
          description: string | null
          difficulty: string | null
          estimated_minutes: number | null
          id: string
          module_data: Json
          module_key: string
          module_revision: number
          pack_id: string
          status: string
          title: string
          track_key: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          contradictions?: Json | null
          created_at?: string
          depth?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          id?: string
          module_data?: Json
          module_key: string
          module_revision?: number
          pack_id: string
          status?: string
          title: string
          track_key?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          contradictions?: Json | null
          created_at?: string
          depth?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          id?: string
          module_data?: Json
          module_key?: string
          module_revision?: number
          pack_id?: string
          status?: string
          title?: string
          track_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_modules_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_paths: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          paths_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          paths_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          paths_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_paths_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_quizzes: {
        Row: {
          created_at: string
          id: string
          module_key: string
          pack_id: string
          quiz_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          pack_id: string
          quiz_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          pack_id?: string
          quiz_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_quizzes_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          module_key: string | null
          pack_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          module_key?: string | null
          pack_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          module_key?: string | null
          pack_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      help_feedback: {
        Row: {
          article_id: string
          created_at: string
          id: string
          is_helpful: boolean
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          is_helpful: boolean
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          is_helpful?: boolean
          user_id?: string
        }
        Relationships: []
      }
      ingestion_job_state: {
        Row: {
          chunk_idx: number
          created_at: string
          cursor: number
          file_tree: Json | null
          files_json: Json | null
          id: string
          invocations_count: number
          job_id: string
          max_invocations: number
          pack_id: string | null
          phase: string
          source_id: string | null
          symbol_cursor: number
          updated_at: string
        }
        Insert: {
          chunk_idx?: number
          created_at?: string
          cursor?: number
          file_tree?: Json | null
          files_json?: Json | null
          id?: string
          invocations_count?: number
          job_id: string
          max_invocations?: number
          pack_id?: string | null
          phase?: string
          source_id?: string | null
          symbol_cursor?: number
          updated_at?: string
        }
        Update: {
          chunk_idx?: number
          created_at?: string
          cursor?: number
          file_tree?: Json | null
          files_json?: Json | null
          id?: string
          invocations_count?: number
          job_id?: string
          max_invocations?: number
          pack_id?: string | null
          phase?: string
          source_id?: string | null
          symbol_cursor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_job_state_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_file: string | null
          current_file_index: number | null
          elapsed_ms: number | null
          error_message: string | null
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_heartbeat_at: string | null
          metadata: Json | null
          pack_id: string
          phase: string | null
          processed_chunks: number | null
          retry_count: number
          source_id: string | null
          started_at: string | null
          status: string
          total_chunks: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_file?: string | null
          current_file_index?: number | null
          elapsed_ms?: number | null
          error_message?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_heartbeat_at?: string | null
          metadata?: Json | null
          pack_id: string
          phase?: string | null
          processed_chunks?: number | null
          retry_count?: number
          source_id?: string | null
          started_at?: string | null
          status?: string
          total_chunks?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_file?: string | null
          current_file_index?: number | null
          elapsed_ms?: number | null
          error_message?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_heartbeat_at?: string | null
          metadata?: Json | null
          pack_id?: string
          phase?: string | null
          processed_chunks?: number | null
          retry_count?: number
          source_id?: string | null
          started_at?: string | null
          status?: string
          total_chunks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credentials_encrypted: string
          id: string
          label: string | null
          org_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credentials_encrypted: string
          id?: string
          label?: string | null
          org_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string
          id?: string
          label?: string | null
          org_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_checks: {
        Row: {
          check_type: string
          created_at: string
          id: string
          module_key: string
          pack_id: string
          questions_data: Json | null
          score: number
          total: number
          user_id: string
        }
        Insert: {
          check_type: string
          created_at?: string
          id?: string
          module_key: string
          pack_id: string
          questions_data?: Json | null
          score: number
          total: number
          user_id: string
        }
        Update: {
          check_type?: string
          created_at?: string
          id?: string
          module_key?: string
          pack_id?: string
          questions_data?: Json | null
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_checks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_id: string
          content: string
          content_hash: string
          contextualized_content: string | null
          created_at: string
          embedding: string | null
          end_line: number
          entity_name: string | null
          entity_type: string | null
          exported_names: string[] | null
          fts: unknown
          generation_id: string | null
          id: string
          imports: string[] | null
          ingestion_job_id: string | null
          is_redacted: boolean | null
          line_end: number | null
          line_start: number | null
          metadata: Json | null
          module_key: string | null
          org_id: string | null
          pack_id: string
          parent_id: string | null
          path: string
          signature: string | null
          source_id: string
          start_line: number
          track_key: string | null
        }
        Insert: {
          chunk_id: string
          content: string
          content_hash: string
          contextualized_content?: string | null
          created_at?: string
          embedding?: string | null
          end_line: number
          entity_name?: string | null
          entity_type?: string | null
          exported_names?: string[] | null
          fts?: unknown
          generation_id?: string | null
          id?: string
          imports?: string[] | null
          ingestion_job_id?: string | null
          is_redacted?: boolean | null
          line_end?: number | null
          line_start?: number | null
          metadata?: Json | null
          module_key?: string | null
          org_id?: string | null
          pack_id: string
          parent_id?: string | null
          path: string
          signature?: string | null
          source_id: string
          start_line: number
          track_key?: string | null
        }
        Update: {
          chunk_id?: string
          content?: string
          content_hash?: string
          contextualized_content?: string | null
          created_at?: string
          embedding?: string | null
          end_line?: number
          entity_name?: string | null
          entity_type?: string | null
          exported_names?: string[] | null
          fts?: unknown
          generation_id?: string | null
          id?: string
          imports?: string[] | null
          ingestion_job_id?: string | null
          is_redacted?: boolean | null
          line_end?: number | null
          line_start?: number | null
          metadata?: Json | null
          module_key?: string | null
          org_id?: string | null
          pack_id?: string
          parent_id?: string | null
          path?: string
          signature?: string | null
          source_id?: string
          start_line?: number
          track_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_ingestion_job_id_fkey"
            columns: ["ingestion_job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_owners: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          ownership_score: number
          source_id: string
          updated_at: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          ownership_score?: number
          source_id: string
          updated_at?: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          ownership_score?: number
          source_id?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_owners_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_owners_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_badges: {
        Row: {
          id: string
          pack_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          pack_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          pack_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      learner_milestone_progress: {
        Row: {
          completed_at: string | null
          id: string
          milestone_id: string
          pack_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          milestone_id: string
          pack_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          milestone_id?: string
          pack_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_milestone_progress_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "onboarding_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_milestone_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          module_id: string
          pack_id: string | null
          section_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          module_id: string
          pack_id?: string | null
          section_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          module_id?: string
          pack_id?: string | null
          section_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_notes_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_state: {
        Row: {
          id: string
          last_opened_module_id: string | null
          last_opened_track_key: string | null
          pack_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_opened_module_id?: string | null
          last_opened_track_key?: string | null
          pack_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_opened_module_id?: string | null
          last_opened_track_key?: string | null
          pack_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_state_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_xp: {
        Row: {
          id: string
          pack_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          pack_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          pack_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      lifecycle_audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          error_message: string | null
          id: string
          pack_id: string
          parameters: Json
          rows_deleted: Json
          status: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          pack_id: string
          parameters?: Json
          rows_deleted?: Json
          status?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          pack_id?: string
          parameters?: Json
          rows_deleted?: Json
          status?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_audit_events_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_glossary_terms: {
        Row: {
          context: string | null
          created_at: string | null
          created_by: string | null
          definition: string
          id: string
          pack_id: string
          source: string | null
          term: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          created_by?: string | null
          definition: string
          id?: string
          pack_id: string
          source?: string | null
          term: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          created_by?: string | null
          definition?: string
          id?: string
          pack_id?: string
          source?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_glossary_terms_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_audit_events: {
        Row: {
          args_hash: string
          created_at: string
          error_code: string | null
          id: string
          pack_id: string | null
          request_id: string
          result_summary: Json
          status: string
          tool_name: string
          user_id: string | null
        }
        Insert: {
          args_hash: string
          created_at?: string
          error_code?: string | null
          id?: string
          pack_id?: string | null
          request_id: string
          result_summary?: Json
          status: string
          tool_name: string
          user_id?: string | null
        }
        Update: {
          args_hash?: string
          created_at?: string
          error_code?: string | null
          id?: string
          pack_id?: string | null
          request_id?: string
          result_summary?: Json
          status?: string
          tool_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_audit_events_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_checklist: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          priority: string
          suggested_topics: string[] | null
          team_member_id: string
          time_estimate_minutes: number | null
          track_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          priority?: string
          suggested_topics?: string[] | null
          team_member_id: string
          time_estimate_minutes?: number | null
          track_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          priority?: string
          suggested_topics?: string[] | null
          team_member_id?: string
          time_estimate_minutes?: number | null
          track_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_checklist_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_checklist_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_progress: {
        Row: {
          id: string
          is_met: boolean
          met_at: string | null
          notes: string | null
          pack_id: string
          team_member_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_met?: boolean
          met_at?: string | null
          notes?: string | null
          pack_id: string
          team_member_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_met?: boolean
          met_at?: string | null
          notes?: string | null
          pack_id?: string
          team_member_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_progress_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          created_at: string
          id: string
          min_completion_percentage: number
          min_quiz_score: number
          module_key: string
          pack_id: string
          requirement_type: string
          requires_module_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_completion_percentage?: number
          min_quiz_score?: number
          module_key: string
          pack_id: string
          requirement_type?: string
          requires_module_key: string
        }
        Update: {
          created_at?: string
          id?: string
          min_completion_percentage?: number
          min_quiz_score?: number
          module_key?: string
          pack_id?: string
          requirement_type?: string
          requires_module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pack_id: string
          pack_version: number
          plan_data: Json
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pack_id: string
          pack_version: number
          plan_data?: Json
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pack_id?: string
          pack_version?: number
          plan_data?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_plans_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_remediations: {
        Row: {
          created_at: string
          diff_summary: string | null
          id: string
          module_key: string
          original_content: string
          pack_id: string | null
          proposed_content: string
          section_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          diff_summary?: string | null
          id?: string
          module_key: string
          original_content: string
          pack_id?: string | null
          proposed_content: string
          section_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          diff_summary?: string | null
          id?: string
          module_key?: string
          original_content?: string
          pack_id?: string | null
          proposed_content?: string
          section_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_remediations_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_telemetry: {
        Row: {
          created_at: string
          help_requested: boolean
          id: string
          module_key: string
          pack_id: string
          scroll_depth_percent: number
          section_id: string | null
          time_spent_seconds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          help_requested?: boolean
          id?: string
          module_key: string
          pack_id: string
          scroll_depth_percent?: number
          section_id?: string | null
          time_spent_seconds?: number
          user_id: string
        }
        Update: {
          created_at?: string
          help_requested?: boolean
          id?: string
          module_key?: string
          pack_id?: string
          scroll_depth_percent?: number
          section_id?: string | null
          time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_telemetry_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          template_data: Json
          template_key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          template_data?: Json
          template_key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          template_data?: Json
          template_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      onboarding_milestones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          pack_id: string
          phase: string
          sort_order: number
          target_type: string
          target_value: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          pack_id: string
          phase?: string
          sort_order?: number
          target_type?: string
          target_value?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          pack_id?: string
          phase?: string
          sort_order?: number
          target_type?: string
          target_value?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_milestones_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_schedule: {
        Row: {
          created_at: string
          expected_completion_date: string | null
          id: string
          pack_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          pack_id: string
          start_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          pack_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_schedule_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      pack_active_generation: {
        Row: {
          active_generation_id: string
          org_id: string
          pack_id: string
          updated_at: string | null
        }
        Insert: {
          active_generation_id: string
          org_id: string
          pack_id: string
          updated_at?: string | null
        }
        Update: {
          active_generation_id?: string
          org_id?: string
          pack_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pack_doc_blocks: {
        Row: {
          block_order: number
          block_type: string
          created_at: string
          doc_id: string
          id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          block_order: number
          block_type: string
          created_at?: string
          doc_id: string
          id?: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          block_order?: number
          block_type?: string
          created_at?: string
          doc_id?: string
          id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_doc_blocks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "pack_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_doc_edges: {
        Row: {
          edge_type: string
          from_doc_id: string
          to_doc_id: string
        }
        Insert: {
          edge_type?: string
          from_doc_id: string
          to_doc_id: string
        }
        Update: {
          edge_type?: string
          from_doc_id?: string
          to_doc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_doc_edges_from_doc_id_fkey"
            columns: ["from_doc_id"]
            isOneToOne: false
            referencedRelation: "pack_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_doc_edges_to_doc_id_fkey"
            columns: ["to_doc_id"]
            isOneToOne: false
            referencedRelation: "pack_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_doc_progress: {
        Row: {
          checklist_state: Json
          completed_at: string | null
          doc_id: string
          id: string
          last_viewed_at: string | null
          notes: string | null
          pack_id: string
          status: string
          user_id: string
        }
        Insert: {
          checklist_state?: Json
          completed_at?: string | null
          doc_id: string
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          pack_id: string
          status?: string
          user_id: string
        }
        Update: {
          checklist_state?: Json
          completed_at?: string | null
          doc_id?: string
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          pack_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_doc_progress_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "pack_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_doc_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_docs: {
        Row: {
          category: string | null
          content_plain: string
          content_render: string | null
          created_at: string
          created_by: string
          format: string
          id: string
          owner_user_id: string | null
          pack_id: string
          slug: string
          source_path: string | null
          source_type: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          category?: string | null
          content_plain: string
          content_render?: string | null
          created_at?: string
          created_by: string
          format?: string
          id?: string
          owner_user_id?: string | null
          pack_id: string
          slug: string
          source_path?: string | null
          source_type?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string | null
          content_plain?: string
          content_render?: string | null
          created_at?: string
          created_by?: string
          format?: string
          id?: string
          owner_user_id?: string | null
          pack_id?: string
          slug?: string
          source_path?: string | null
          source_type?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pack_docs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_generation_limits: {
        Row: {
          id: string
          max_key_takeaways: number
          max_module_words: number
          max_quiz_questions: number
          pack_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          max_key_takeaways?: number
          max_module_words?: number
          max_quiz_questions?: number
          pack_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          max_key_takeaways?: number
          max_module_words?: number
          max_quiz_questions?: number
          pack_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_generation_limits_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: true
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_lifecycle_policies: {
        Row: {
          legal_hold: boolean
          pack_id: string
          retention_audit_days: number
          retention_ingestion_jobs_days: number
          retention_rag_metrics_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          legal_hold?: boolean
          pack_id: string
          retention_audit_days?: number
          retention_ingestion_jobs_days?: number
          retention_rag_metrics_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          legal_hold?: boolean
          pack_id?: string
          retention_audit_days?: number
          retention_ingestion_jobs_days?: number
          retention_rag_metrics_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_lifecycle_policies_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: true
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_members: {
        Row: {
          access_level: string
          id: string
          joined_at: string
          pack_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          id?: string
          joined_at?: string
          pack_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          id?: string
          joined_at?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_members_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_quality_daily: {
        Row: {
          avg_attempts: number
          avg_citations_found: number
          avg_strip_rate: number
          avg_total_latency_ms: number
          created_at: string
          day: string
          gate_passed: number
          gate_refused: number
          p95_total_latency_ms: number | null
          pack_id: string
          retry_requests: number
          total_requests: number
          updated_at: string
        }
        Insert: {
          avg_attempts?: number
          avg_citations_found?: number
          avg_strip_rate?: number
          avg_total_latency_ms?: number
          created_at?: string
          day: string
          gate_passed?: number
          gate_refused?: number
          p95_total_latency_ms?: number | null
          pack_id: string
          retry_requests?: number
          total_requests?: number
          updated_at?: string
        }
        Update: {
          avg_attempts?: number
          avg_citations_found?: number
          avg_strip_rate?: number
          avg_total_latency_ms?: number
          created_at?: string
          day?: string
          gate_passed?: number
          gate_refused?: number
          p95_total_latency_ms?: number | null
          pack_id?: string
          retry_requests?: number
          total_requests?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_quality_daily_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_source_credentials: {
        Row: {
          created_at: string
          credential_type: string
          id: string
          label: string | null
          pack_source_id: string
          updated_at: string
          vault_secret_id: string
        }
        Insert: {
          created_at?: string
          credential_type?: string
          id?: string
          label?: string | null
          pack_source_id: string
          updated_at?: string
          vault_secret_id: string
        }
        Update: {
          created_at?: string
          credential_type?: string
          id?: string
          label?: string | null
          pack_source_id?: string
          updated_at?: string
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_source_credentials_pack_source_id_fkey"
            columns: ["pack_source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_source_credentials_pack_source_id_fkey"
            columns: ["pack_source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_sources: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_synced_at: string | null
          pack_id: string
          short_slug: string | null
          source_config: Json | null
          source_type: string
          source_uri: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          pack_id: string
          short_slug?: string | null
          source_config?: Json | null
          source_type: string
          source_uri: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          pack_id?: string
          short_slug?: string | null
          source_config?: Json | null
          source_type?: string
          source_uri?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "pack_sources_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_tracks: {
        Row: {
          description: string | null
          id: string
          pack_id: string
          title: string
          track_key: string
        }
        Insert: {
          description?: string | null
          id?: string
          pack_id: string
          title: string
          track_key: string
        }
        Update: {
          description?: string | null
          id?: string
          pack_id?: string
          title?: string
          track_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_tracks_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          language_mode: string
          org_id: string
          pack_version: number
          roadmap_enabled: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          language_mode?: string
          org_id: string
          pack_version?: number
          roadmap_enabled?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          language_mode?: string
          org_id?: string
          pack_version?: number
          roadmap_enabled?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      path_progress: {
        Row: {
          checked_at: string | null
          id: string
          is_checked: boolean
          pack_id: string
          path_type: string
          step_id: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          id?: string
          is_checked?: boolean
          pack_id: string
          path_type: string
          step_id: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          id?: string
          is_checked?: boolean
          pack_id?: string
          path_type?: string
          step_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_visibility_preferences: {
        Row: {
          allow_direct_messages: boolean | null
          id: string
          pack_id: string
          show_my_activity: boolean | null
          show_my_progress: boolean | null
          user_id: string
        }
        Insert: {
          allow_direct_messages?: boolean | null
          id?: string
          pack_id: string
          show_my_activity?: boolean | null
          show_my_progress?: boolean | null
          user_id: string
        }
        Update: {
          allow_direct_messages?: boolean | null
          id?: string
          pack_id?: string
          show_my_activity?: boolean | null
          show_my_progress?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_visibility_preferences_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          accepted_at: string | null
          access_level: string
          created_at: string
          email: string
          id: string
          invited_by: string
          pack_id: string
        }
        Insert: {
          accepted_at?: string | null
          access_level?: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          pack_id: string
        }
        Update: {
          accepted_at?: string | null
          access_level?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          learner_user_id: string
          owner_user_id: string | null
          pack_id: string
          playlist_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          learner_user_id: string
          owner_user_id?: string | null
          pack_id: string
          playlist_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          learner_user_id?: string
          owner_user_id?: string | null
          pack_id?: string
          playlist_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_assignments_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_assignments_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_item_dependencies: {
        Row: {
          depends_on_item_id: string
          item_id: string
        }
        Insert: {
          depends_on_item_id: string
          item_id: string
        }
        Update: {
          depends_on_item_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_item_dependencies_depends_on_item_id_fkey"
            columns: ["depends_on_item_id"]
            isOneToOne: false
            referencedRelation: "playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_item_dependencies_depends_on_item_id_fkey"
            columns: ["depends_on_item_id"]
            isOneToOne: false
            referencedRelation: "view_playlist_item_state"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "playlist_item_dependencies_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_item_dependencies_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_playlist_item_state"
            referencedColumns: ["item_id"]
          },
        ]
      }
      playlist_item_progress: {
        Row: {
          assignment_id: string
          completed_at: string | null
          id: string
          item_id: string
          last_event_at: string
          learner_user_id: string
          note: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          id?: string
          item_id: string
          last_event_at?: string
          learner_user_id: string
          note?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          id?: string
          item_id?: string
          last_event_at?: string
          learner_user_id?: string
          note?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_item_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "playlist_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_item_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "view_playlist_item_state"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "playlist_item_progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_item_progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_playlist_item_state"
            referencedColumns: ["item_id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          description: string | null
          due_offset_days: number | null
          id: string
          item_type: string | null
          module_id: string | null
          pack_id: string | null
          playlist_id: string | null
          required: boolean | null
          section_id: string | null
          sort_order: number | null
          title: string | null
          unlock_offset_days: number | null
        }
        Insert: {
          description?: string | null
          due_offset_days?: number | null
          id?: string
          item_type?: string | null
          module_id?: string | null
          pack_id?: string | null
          playlist_id?: string | null
          required?: boolean | null
          section_id?: string | null
          sort_order?: number | null
          title?: string | null
          unlock_offset_days?: number | null
        }
        Update: {
          description?: string | null
          due_offset_days?: number | null
          id?: string
          item_type?: string | null
          module_id?: string | null
          pack_id?: string | null
          playlist_id?: string | null
          required?: boolean | null
          section_id?: string | null
          sort_order?: number | null
          title?: string | null
          unlock_offset_days?: number | null
        }
        Relationships: []
      }
      playlists: {
        Row: {
          created_at: string
          created_by: string
          default_start_offset_days: number
          description: string | null
          id: string
          owner_display_name: string | null
          owner_user_id: string | null
          pack_id: string
          phase: string
          required: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_start_offset_days?: number
          description?: string | null
          id?: string
          owner_display_name?: string | null
          owner_user_id?: string | null
          pack_id: string
          phase: string
          required?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_start_offset_days?: number
          description?: string | null
          id?: string
          owner_display_name?: string | null
          owner_user_id?: string | null
          pack_id?: string
          phase?: string
          required?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_correct: boolean
          module_key: string
          pack_id: string
          question_id: string
          selected_choice_id: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct: boolean
          module_key: string
          pack_id: string
          question_id: string
          selected_choice_id: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean
          module_key?: string
          pack_id?: string
          question_id?: string
          selected_choice_id?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_type: string
          id: string
          module_key: string
          pack_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          module_key: string
          pack_id: string
          question_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          module_key?: string
          pack_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_feedback_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_scores: {
        Row: {
          completed_at: string
          id: string
          module_id: string
          pack_id: string | null
          score: number
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          module_id: string
          pack_id?: string | null
          score: number
          total: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          module_id?: string
          pack_id?: string | null
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_scores_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_metrics: {
        Row: {
          agent_confidence: string | null
          attempts: number | null
          avg_relevance_score: number | null
          chunks_after_rerank: number | null
          chunks_retrieved: number | null
          citations_failed: number | null
          citations_found: number | null
          citations_verified: number | null
          claims_stripped: number | null
          claims_total: number | null
          created_at: string | null
          detective_enabled: boolean | null
          detective_time_ms: number | null
          expanded_chunks_added: number | null
          generation_latency_ms: number | null
          grounding_gate_mode: string | null
          grounding_gate_passed: boolean | null
          grounding_gate_reason: string | null
          grounding_score: number | null
          grounding_threshold_score: number | null
          grounding_threshold_strip: number | null
          id: string
          input_tokens: number | null
          kg_added_spans: number | null
          kg_definition_hits: number | null
          kg_enabled: boolean | null
          kg_reference_hits: number | null
          kg_time_ms: number | null
          model_used: string | null
          org_id: string
          output_tokens: number | null
          pack_id: string | null
          provider_used: string | null
          query: string
          request_id: string | null
          rerank_skip_reason: string | null
          rerank_skipped: boolean | null
          retrieval_hops: number | null
          retrieval_latency_ms: number | null
          retrieval_method: string | null
          snippets_resolved: number | null
          strip_rate: number | null
          symbols_extracted: number | null
          task_type: string | null
          total_latency_ms: number | null
          trace_id: string | null
          unique_files_count: number | null
          user_id: string
          verification_score: number | null
        }
        Insert: {
          agent_confidence?: string | null
          attempts?: number | null
          avg_relevance_score?: number | null
          chunks_after_rerank?: number | null
          chunks_retrieved?: number | null
          citations_failed?: number | null
          citations_found?: number | null
          citations_verified?: number | null
          claims_stripped?: number | null
          claims_total?: number | null
          created_at?: string | null
          detective_enabled?: boolean | null
          detective_time_ms?: number | null
          expanded_chunks_added?: number | null
          generation_latency_ms?: number | null
          grounding_gate_mode?: string | null
          grounding_gate_passed?: boolean | null
          grounding_gate_reason?: string | null
          grounding_score?: number | null
          grounding_threshold_score?: number | null
          grounding_threshold_strip?: number | null
          id?: string
          input_tokens?: number | null
          kg_added_spans?: number | null
          kg_definition_hits?: number | null
          kg_enabled?: boolean | null
          kg_reference_hits?: number | null
          kg_time_ms?: number | null
          model_used?: string | null
          org_id: string
          output_tokens?: number | null
          pack_id?: string | null
          provider_used?: string | null
          query: string
          request_id?: string | null
          rerank_skip_reason?: string | null
          rerank_skipped?: boolean | null
          retrieval_hops?: number | null
          retrieval_latency_ms?: number | null
          retrieval_method?: string | null
          snippets_resolved?: number | null
          strip_rate?: number | null
          symbols_extracted?: number | null
          task_type?: string | null
          total_latency_ms?: number | null
          trace_id?: string | null
          unique_files_count?: number | null
          user_id: string
          verification_score?: number | null
        }
        Update: {
          agent_confidence?: string | null
          attempts?: number | null
          avg_relevance_score?: number | null
          chunks_after_rerank?: number | null
          chunks_retrieved?: number | null
          citations_failed?: number | null
          citations_found?: number | null
          citations_verified?: number | null
          claims_stripped?: number | null
          claims_total?: number | null
          created_at?: string | null
          detective_enabled?: boolean | null
          detective_time_ms?: number | null
          expanded_chunks_added?: number | null
          generation_latency_ms?: number | null
          grounding_gate_mode?: string | null
          grounding_gate_passed?: boolean | null
          grounding_gate_reason?: string | null
          grounding_score?: number | null
          grounding_threshold_score?: number | null
          grounding_threshold_strip?: number | null
          id?: string
          input_tokens?: number | null
          kg_added_spans?: number | null
          kg_definition_hits?: number | null
          kg_enabled?: boolean | null
          kg_reference_hits?: number | null
          kg_time_ms?: number | null
          model_used?: string | null
          org_id?: string
          output_tokens?: number | null
          pack_id?: string | null
          provider_used?: string | null
          query?: string
          request_id?: string | null
          rerank_skip_reason?: string | null
          rerank_skipped?: boolean | null
          retrieval_hops?: number | null
          retrieval_latency_ms?: number | null
          retrieval_method?: string | null
          snippets_resolved?: number | null
          strip_rate?: number | null
          symbols_extracted?: number | null
          task_type?: string | null
          total_latency_ms?: number | null
          trace_id?: string | null
          unique_files_count?: number | null
          user_id?: string
          verification_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_metrics_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      reindex_progress: {
        Row: {
          chunks_processed: number | null
          chunks_total: number | null
          completed_at: string | null
          error: string | null
          error_message: string | null
          metadata: Json | null
          org_id: string
          pack_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          chunks_processed?: number | null
          chunks_total?: number | null
          completed_at?: string | null
          error?: string | null
          error_message?: string | null
          metadata?: Json | null
          org_id: string
          pack_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          chunks_processed?: number | null
          chunks_total?: number | null
          completed_at?: string | null
          error?: string | null
          error_message?: string | null
          metadata?: Json | null
          org_id?: string
          pack_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reindex_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_schedule: {
        Row: {
          id: string
          last_reviewed_at: string | null
          module_key: string
          next_review_date: string
          pack_id: string
          review_count: number
          user_id: string
        }
        Insert: {
          id?: string
          last_reviewed_at?: string | null
          module_key: string
          next_review_date?: string
          pack_id: string
          review_count?: number
          user_id: string
        }
        Update: {
          id?: string
          last_reviewed_at?: string | null
          module_key?: string
          next_review_date?: string
          pack_id?: string
          review_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_schedule_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      staleness_check_queue: {
        Row: {
          attempts: number
          error_message: string | null
          finished_at: string | null
          id: string
          pack_id: string
          processed_at: string | null
          reason: string
          requested_at: string
          source_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          pack_id: string
          processed_at?: string | null
          reason?: string
          requested_at?: string
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          pack_id?: string
          processed_at?: string | null
          reason?: string
          requested_at?: string
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staleness_check_queue_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      symbol_definitions: {
        Row: {
          chunk_id: string
          created_at: string | null
          line_end: number | null
          line_start: number | null
          pack_id: string
          path: string
          source_id: string
          symbol: string
        }
        Insert: {
          chunk_id: string
          created_at?: string | null
          line_end?: number | null
          line_start?: number | null
          pack_id: string
          path: string
          source_id: string
          symbol: string
        }
        Update: {
          chunk_id?: string
          created_at?: string | null
          line_end?: number | null
          line_start?: number | null
          pack_id?: string
          path?: string
          source_id?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbol_definitions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symbol_definitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symbol_definitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      symbol_references: {
        Row: {
          confidence: number | null
          created_at: string | null
          from_chunk_id: string
          from_line_end: number | null
          from_line_start: number | null
          from_path: string
          pack_id: string
          source_id: string
          symbol: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          from_chunk_id: string
          from_line_end?: number | null
          from_line_start?: number | null
          from_path: string
          pack_id: string
          source_id: string
          symbol: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          from_chunk_id?: string
          from_line_end?: number | null
          from_line_start?: number | null
          from_path?: string
          pack_id?: string
          source_id?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbol_references_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symbol_references_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symbol_references_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pack_sources_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          areas_of_expertise: string[] | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          github_handle: string | null
          id: string
          is_auto_detected: boolean
          name: string
          pack_id: string
          role_title: string | null
          services_owned: string[] | null
          slack_handle: string | null
        }
        Insert: {
          areas_of_expertise?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          github_handle?: string | null
          id?: string
          is_auto_detected?: boolean
          name: string
          pack_id: string
          role_title?: string | null
          services_owned?: string[] | null
          slack_handle?: string | null
        }
        Update: {
          areas_of_expertise?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          github_handle?: string | null
          id?: string
          is_auto_detected?: boolean
          name?: string
          pack_id?: string
          role_title?: string | null
          services_owned?: string[] | null
          slack_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_settings: {
        Row: {
          byok_config: Json
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          byok_config?: Json
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          byok_config?: Json
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          id: string
          is_read: boolean
          module_id: string
          pack_id: string | null
          read_at: string
          section_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_read?: boolean
          module_id: string
          pack_id?: string | null
          read_at?: string
          section_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_read?: boolean
          module_id?: string
          pack_id?: string | null
          read_at?: string
          section_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pack_sources_safe: {
        Row: {
          created_at: string | null
          id: string | null
          label: string | null
          last_synced_at: string | null
          pack_id: string | null
          source_config: Json | null
          source_type: string | null
          source_uri: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          label?: string | null
          last_synced_at?: string | null
          pack_id?: string | null
          source_config?: never
          source_type?: string | null
          source_uri?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          label?: string | null
          last_synced_at?: string | null
          pack_id?: string | null
          source_config?: never
          source_type?: string | null
          source_uri?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_sources_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_settings_masked: {
        Row: {
          byok_config: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          byok_config?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          byok_config?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      view_playlist_item_state: {
        Row: {
          assignment_id: string | null
          computed_due_date: string | null
          computed_unlock_date: string | null
          current_status: string | null
          is_blocked_by_dependency: boolean | null
          item_id: string | null
          item_type: string | null
          learner_user_id: string | null
          module_id: string | null
          playlist_id: string | null
          section_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_pending_invites: {
        Args: { _email: string; _user_id: string }
        Returns: number
      }
      award_badge_server: {
        Args: { p_badge_key: string; p_pack_id: string; p_user_id: string }
        Returns: boolean
      }
      award_xp_server: {
        Args: {
          p_amount: number
          p_pack_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      clear_byok_provider: { Args: { _provider: string }; Returns: undefined }
      definition_search_v1:
        | {
            Args: {
              p_match_count?: number
              p_org_id: string
              p_pack_id: string
              p_symbols: string[]
            }
            Returns: {
              chunk_id: string
              content: string
              entity_name: string
              entity_type: string
              id: string
              line_end: number
              line_start: number
              path: string
              score: number
              signature: string
              source_id: string
            }[]
          }
        | {
            Args: {
              p_match_count?: number
              p_module_key?: string
              p_org_id: string
              p_pack_id: string
              p_symbols: string[]
              p_track_key?: string
            }
            Returns: {
              chunk_id: string
              content: string
              entity_name: string
              entity_type: string
              id: string
              line_end: number
              line_start: number
              path: string
              score: number
              signature: string
              source_id: string
            }[]
          }
      find_definitions_v1: {
        Args: { p_limit?: number; p_pack_id: string; p_symbols: string[] }
        Returns: {
          chunk_id: string
          is_redacted: boolean
          line_end: number
          line_start: number
          path: string
          symbol: string
        }[]
      }
      find_references_v1: {
        Args: { p_limit?: number; p_pack_id: string; p_symbol: string }
        Returns: {
          chunk_id: string
          confidence: number
          is_redacted: boolean
          line_end: number
          line_start: number
          path: string
        }[]
      }
      get_cohort_pack_id: { Args: { _cohort_id: string }; Returns: string }
      get_decrypted_byok_key: {
        Args: { _provider: string; _user_id: string }
        Returns: string
      }
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      get_pack_access_level: {
        Args: { _pack_id: string; _user_id: string }
        Returns: string
      }
      get_thread_pack_id: { Args: { _thread_id: string }; Returns: string }
      has_pack_access: {
        Args: { _min_level: string; _pack_id: string; _user_id: string }
        Returns: boolean
      }
      hybrid_search_v2: {
        Args: {
          p_match_count?: number
          p_match_threshold?: number
          p_module_key?: string
          p_org_id: string
          p_pack_id: string
          p_query_embedding: string
          p_query_text: string
          p_rrf_k?: number
          p_track_key?: string
        }
        Returns: {
          chunk_id: string
          content: string
          entity_name: string
          entity_type: string
          id: string
          line_end: number
          line_start: number
          path: string
          score: number
          signature: string
          source_id: string
        }[]
      }
      hybrid_search_v2_impl: {
        Args: {
          p_match_count?: number
          p_match_threshold?: number
          p_module_key?: string
          p_org_id: string
          p_pack_id: string
          p_query_embedding?: string
          p_query_text: string
          p_track_key?: string
        }
        Returns: {
          chunk_id: string
          content: string
          entity_name: string
          entity_type: string
          id: string
          line_end: number
          line_start: number
          path: string
          score: number
          signature: string
          source_id: string
        }[]
      }
      is_cohort_member: {
        Args: { _cohort_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_pack_member: {
        Args: { _pack_id: string; _user_id: string }
        Returns: boolean
      }
      kg_expand_v1: {
        Args: {
          p_limit?: number
          p_max_per_relation?: number
          p_org_id: string
          p_pack_id: string
          p_seed_ids: string[]
          p_symbols?: string[]
        }
        Returns: {
          chunk_id: string
          content: string
          entity_name: string
          entity_type: string
          id: string
          line_end: number
          line_start: number
          path: string
          relation_symbol: string
          relation_type: string
          score: number
          signature: string
          source_id: string
        }[]
      }
      lookup_user_by_email: {
        Args: { _email: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      match_chunks_hybrid:
        | {
            Args: {
              match_count: number
              path_filter?: string
              query_embedding: string
              query_text: string
              target_pack_id: string
            }
            Returns: {
              chunk_id: string
              content: string
              end_line: number
              id: string
              metadata: Json
              path: string
              rrf_score: number
              source_id: string
              start_line: number
            }[]
          }
        | {
            Args: {
              keyword_weight?: number
              match_count: number
              path_filter?: string
              query_embedding: string
              query_text: string
              target_pack_id: string
              vector_weight?: number
            }
            Returns: {
              chunk_id: string
              content: string
              end_line: number
              id: string
              metadata: Json
              path: string
              rrf_score: number
              source_id: string
              start_line: number
            }[]
          }
      purge_source_v1: {
        Args: {
          p_actor_user_id?: string
          p_pack_id: string
          p_source_id: string
        }
        Returns: Json
      }
      rollup_pack_quality_aggregates: {
        Args: { p_day_from: string; p_day_to: string }
        Returns: undefined
      }
      run_analyze: { Args: { table_name: string }; Returns: undefined }
      save_byok_key: {
        Args: {
          _api_key: string
          _model: string
          _provider: string
          _status?: string
        }
        Returns: undefined
      }
      set_active_byok_provider: {
        Args: { _model: string; _provider: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_faq_suggestion: {
        Args: { p_pack_id: string; p_question: string }
        Returns: undefined
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

