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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          description: string | null
          earned_at: string
          icon_url: string | null
          id: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          description?: string | null
          earned_at?: string
          icon_url?: string | null
          id?: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          description?: string | null
          earned_at?: string
          icon_url?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_ranking_audit: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          id: string
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          meta: Json | null
          org_id: string | null
          ref_id: string | null
          seller_id: string
          source: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
          org_id?: string | null
          ref_id?: string | null
          seller_id: string
          source?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
          org_id?: string | null
          ref_id?: string | null
          seller_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_codes: {
        Row: {
          code_hash: string
          created_at: string | null
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string | null
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string | null
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      banned_emails: {
        Row: {
          banned_at: string | null
          banned_by: string | null
          email: string
          id: string
          reason: string | null
          sanction_id: string | null
        }
        Insert: {
          banned_at?: string | null
          banned_by?: string | null
          email: string
          id?: string
          reason?: string | null
          sanction_id?: string | null
        }
        Update: {
          banned_at?: string | null
          banned_by?: string | null
          email?: string
          id?: string
          reason?: string | null
          sanction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banned_emails_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "user_sanctions"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_time_slots: {
        Row: {
          blocked_date: string
          created_at: string
          end_time: string
          external_event_id: string | null
          id: string
          reason: string | null
          seller_id: string
          source: string | null
          start_time: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          end_time: string
          external_event_id?: string | null
          id?: string
          reason?: string | null
          seller_id: string
          source?: string | null
          start_time: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          end_time?: string
          external_event_id?: string | null
          id?: string
          reason?: string | null
          seller_id?: string
          source?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_time_slots_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_time_slots_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          redirect_url: string
          seller_id: string
          state_token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          redirect_url: string
          seller_id: string
          state_token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          redirect_url?: string
          seller_id?: string
          state_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_oauth_states_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_oauth_states_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          created_at: string | null
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          attachment_content_type: string | null
          attachment_file_name: string | null
          attachment_file_size: number | null
          attachment_storage_key: string | null
          author_id: string
          body: string
          comments_count: number | null
          created_at: string
          file_scan_status: string | null
          id: string
          is_public: boolean
          pinned: boolean
          product_id: string | null
          seller_id: string | null
          title: string | null
          updated_at: string
          views_count: number | null
        }
        Insert: {
          attachment_content_type?: string | null
          attachment_file_name?: string | null
          attachment_file_size?: number | null
          attachment_storage_key?: string | null
          author_id: string
          body: string
          comments_count?: number | null
          created_at?: string
          file_scan_status?: string | null
          id?: string
          is_public?: boolean
          pinned?: boolean
          product_id?: string | null
          seller_id?: string | null
          title?: string | null
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          attachment_content_type?: string | null
          attachment_file_name?: string | null
          attachment_file_size?: number | null
          attachment_storage_key?: string | null
          author_id?: string
          body?: string
          comments_count?: number | null
          created_at?: string
          file_scan_status?: string | null
          id?: string
          is_public?: boolean
          pinned?: boolean
          product_id?: string | null
          seller_id?: string | null
          title?: string | null
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          consent_details: Json | null
          consent_given: boolean
          created_at: string | null
          id: string
          ip_address: unknown
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          consent_details?: Json | null
          consent_given: boolean
          created_at?: string | null
          id?: string
          ip_address?: unknown
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          consent_details?: Json | null
          consent_given?: boolean
          created_at?: string | null
          id?: string
          ip_address?: unknown
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      custom_banned_words: {
        Row: {
          added_by: string | null
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_regex: boolean | null
          language: string | null
          severity: string | null
          updated_at: string | null
          word: string
        }
        Insert: {
          added_by?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_regex?: boolean | null
          language?: string | null
          severity?: string | null
          updated_at?: string | null
          word: string
        }
        Update: {
          added_by?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_regex?: boolean | null
          language?: string | null
          severity?: string | null
          updated_at?: string | null
          word?: string
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          is_admin_message: boolean
          message: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          is_admin_message?: boolean
          message: string
          sender_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          is_admin_message?: boolean
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_mediation_started_at: string | null
          buyer_id: string
          created_at: string
          description: string
          dispute_deadline: string | null
          dispute_type: string | null
          id: string
          penalty_amount: number | null
          product_id: string
          purchase_id: string
          refund_authorized_at: string | null
          refund_authorized_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          seller_penalty_applied: boolean | null
          seller_responded_at: string | null
          seller_response: string | null
          seller_response_deadline: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_mediation_started_at?: string | null
          buyer_id: string
          created_at?: string
          description: string
          dispute_deadline?: string | null
          dispute_type?: string | null
          id?: string
          penalty_amount?: number | null
          product_id: string
          purchase_id: string
          refund_authorized_at?: string | null
          refund_authorized_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          seller_penalty_applied?: boolean | null
          seller_responded_at?: string | null
          seller_response?: string | null
          seller_response_deadline?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_mediation_started_at?: string | null
          buyer_id?: string
          created_at?: string
          description?: string
          dispute_deadline?: string | null
          dispute_type?: string | null
          id?: string
          penalty_amount?: number | null
          product_id?: string
          purchase_id?: string
          refund_authorized_at?: string | null
          refund_authorized_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          seller_penalty_applied?: boolean | null
          seller_responded_at?: string | null
          seller_response?: string | null
          seller_response_deadline?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_meeting_idcodenamedescriptiontitle: {
        Row: {
          buyer_id: string | null
          buyer_name: string
          created_at: string
          description: string | null
          id: string
          meeting_code: string
          scheduled_end: string
          scheduled_start: string
          seller_id: string | null
          seller_name: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          buyer_name: string
          created_at?: string
          description?: string | null
          id?: string
          meeting_code: string
          scheduled_end: string
          scheduled_start: string
          seller_id?: string | null
          seller_name: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          buyer_name?: string
          created_at?: string
          description?: string | null
          id?: string
          meeting_code?: string
          scheduled_end?: string
          scheduled_start?: string
          seller_id?: string | null
          seller_name?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      DK_meeting_idcodenamedescriptiontitle: {
        Row: {
          buyer_id: string | null
          buyer_name: string
          created_at: string
          description: string | null
          id: string
          meeting_code: string
          scheduled_end: string
          scheduled_start: string
          seller_id: string | null
          seller_name: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          buyer_name: string
          created_at?: string
          description?: string | null
          id?: string
          meeting_code: string
          scheduled_end: string
          scheduled_start: string
          seller_id?: string | null
          seller_name: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          buyer_name?: string
          created_at?: string
          description?: string | null
          id?: string
          meeting_code?: string
          scheduled_end?: string
          scheduled_start?: string
          seller_id?: string | null
          seller_name?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "DK_meeting_idcodenamedescriptiontitle_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "DK_meeting_idcodenamedescriptiontitle_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "DK_meeting_idcodenamedescriptiontitle_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "DK_meeting_idcodenamedescriptiontitle_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_meeting_storage: {
        Row: {
          ai_summary: string | null
          audio_recording_url: string | null
          created_at: string
          id: string
          meeting_id: string
          notes_buyer: string | null
          notes_seller: string | null
          transcript_url: string | null
          updated_at: string
          video_recording_url: string | null
        }
        Insert: {
          ai_summary?: string | null
          audio_recording_url?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          notes_buyer?: string | null
          notes_seller?: string | null
          transcript_url?: string | null
          updated_at?: string
          video_recording_url?: string | null
        }
        Update: {
          ai_summary?: string | null
          audio_recording_url?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          notes_buyer?: string | null
          notes_seller?: string | null
          transcript_url?: string | null
          updated_at?: string
          video_recording_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dk_meeting_storage_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "dk_meeting_idcodenamedescriptiontitle"
            referencedColumns: ["id"]
          },
        ]
      }
      DK_meeting_storage: {
        Row: {
          ai_summary: string | null
          audio_recording_url: string | null
          created_at: string
          id: string
          meeting_id: string
          notes_buyer: string | null
          notes_seller: string | null
          transcript_url: string | null
          updated_at: string
          video_recording_url: string | null
        }
        Insert: {
          ai_summary?: string | null
          audio_recording_url?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          notes_buyer?: string | null
          notes_seller?: string | null
          transcript_url?: string | null
          updated_at?: string
          video_recording_url?: string | null
        }
        Update: {
          ai_summary?: string | null
          audio_recording_url?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          notes_buyer?: string | null
          notes_seller?: string | null
          transcript_url?: string | null
          updated_at?: string
          video_recording_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "DK_meeting_storage_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "DK_meeting_idcodenamedescriptiontitle"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_meetings: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          admin_resolution_notes: string | null
          ai_action_items: Json | null
          ai_summary: string | null
          audit_log: Json | null
          buyer_email: string
          buyer_id: string | null
          buyer_name: string
          consent_recording_buyer: boolean | null
          consent_recording_seller: boolean | null
          created_at: string
          description: string | null
          dispute_reason: string | null
          dispute_status: string | null
          extended_minutes: number | null
          id: string
          is_paid: boolean | null
          meeting_code: string
          meeting_platform: string
          notes_buyer: string | null
          notes_seller: string | null
          payment_status: string | null
          price_cents: number | null
          recording_audio_url: string | null
          recording_transcript_url: string | null
          recording_video_url: string | null
          scheduled_end: string
          scheduled_start: string
          seller_id: string | null
          seller_name: string
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          admin_resolution_notes?: string | null
          ai_action_items?: Json | null
          ai_summary?: string | null
          audit_log?: Json | null
          buyer_email: string
          buyer_id?: string | null
          buyer_name: string
          consent_recording_buyer?: boolean | null
          consent_recording_seller?: boolean | null
          created_at?: string
          description?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          extended_minutes?: number | null
          id?: string
          is_paid?: boolean | null
          meeting_code: string
          meeting_platform?: string
          notes_buyer?: string | null
          notes_seller?: string | null
          payment_status?: string | null
          price_cents?: number | null
          recording_audio_url?: string | null
          recording_transcript_url?: string | null
          recording_video_url?: string | null
          scheduled_end: string
          scheduled_start: string
          seller_id?: string | null
          seller_name: string
          status?: string
          topic: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          admin_resolution_notes?: string | null
          ai_action_items?: Json | null
          ai_summary?: string | null
          audit_log?: Json | null
          buyer_email?: string
          buyer_id?: string | null
          buyer_name?: string
          consent_recording_buyer?: boolean | null
          consent_recording_seller?: boolean | null
          created_at?: string
          description?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          extended_minutes?: number | null
          id?: string
          is_paid?: boolean | null
          meeting_code?: string
          meeting_platform?: string
          notes_buyer?: string | null
          notes_seller?: string | null
          payment_status?: string | null
          price_cents?: number | null
          recording_audio_url?: string | null
          recording_transcript_url?: string | null
          recording_video_url?: string | null
          scheduled_end?: string
          scheduled_start?: string
          seller_id?: string | null
          seller_name?: string
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_meetings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dk_meetings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_meetings2: {
        Row: {
          approved_at: string
          buyer_id: string | null
          buyer_name: string
          created_at: string
          description: string
          end_time: string
          ended_at: string
          meeting_cod: string
          meeting_id: string
          seller_id: string | null
          seller_name: string
          start_time: string
          status: string
          title: string
        }
        Insert: {
          approved_at?: string
          buyer_id?: string | null
          buyer_name: string
          created_at?: string
          description: string
          end_time: string
          ended_at?: string
          meeting_cod: string
          meeting_id?: string
          seller_id?: string | null
          seller_name: string
          start_time: string
          status?: string
          title: string
        }
        Update: {
          approved_at?: string
          buyer_id?: string | null
          buyer_name?: string
          created_at?: string
          description?: string
          end_time?: string
          ended_at?: string
          meeting_cod?: string
          meeting_id?: string
          seller_id?: string | null
          seller_name?: string
          start_time?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          provider_response: Json | null
          recipient_email: string
          sent_at: string | null
          status: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          provider_response?: Json | null
          recipient_email: string
          sent_at?: string | null
          status?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          provider_response?: Json | null
          recipient_email?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_notifications: {
        Row: {
          body: string
          created_at: string
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type: string
          sent_at?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      escrow_transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          order_id: string
          performed_by: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          order_id: string
          performed_by?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          order_id?: string
          performed_by?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_events: {
        Row: {
          created_at: string
          end_datetime: string
          external_event_id: string
          id: string
          is_all_day: boolean | null
          provider: string
          seller_id: string
          start_datetime: string
          synced_at: string
          title: string | null
        }
        Insert: {
          created_at?: string
          end_datetime: string
          external_event_id: string
          id?: string
          is_all_day?: boolean | null
          provider: string
          seller_id: string
          start_datetime: string
          synced_at?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          end_datetime?: string
          external_event_id?: string
          id?: string
          is_all_day?: boolean | null
          provider?: string
          seller_id?: string
          start_datetime?: string
          synced_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          invoice_number: string
          issued_at: string
          meeting_payment_id: string | null
          meta: Json | null
          order_id: string | null
          org_id: string
          paid_at: string | null
          pdf_storage_path: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number: string
          issued_at?: string
          meeting_payment_id?: string | null
          meta?: Json | null
          order_id?: string | null
          org_id: string
          paid_at?: string | null
          pdf_storage_path?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          meeting_payment_id?: string | null
          meta?: Json | null
          order_id?: string | null
          org_id?: string
          paid_at?: string | null
          pdf_storage_path?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_meeting_payment_id_fkey"
            columns: ["meeting_payment_id"]
            isOneToOne: false
            referencedRelation: "meeting_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          content: string
          id: string
          last_updated: string | null
          page_type: string
          title: string
          updated_by: string | null
        }
        Insert: {
          content: string
          id?: string
          last_updated?: string | null
          page_type: string
          title: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          last_updated?: string | null
          page_type?: string
          title?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_time: string | null
          email: string
          id: string
          ip_address: string | null
          success: boolean | null
        }
        Insert: {
          attempt_time?: string | null
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
        }
        Update: {
          attempt_time?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      meeting_action_items: {
        Row: {
          assigned_name: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          status: string
          summary_id: string | null
          title: string
        }
        Insert: {
          assigned_name?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          status?: string
          summary_id?: string | null
          title: string
        }
        Update: {
          assigned_name?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          status?: string
          summary_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "meeting_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_analytics: {
        Row: {
          cancellations: number | null
          created_at: string
          date: string
          free_meetings: number | null
          group_meetings: number | null
          id: string
          paid_meetings: number | null
          requests_accepted: number | null
          requests_declined: number | null
          requests_received: number | null
          seller_id: string
          total_duration_minutes: number | null
          total_meetings: number | null
          total_revenue: number | null
          updated_at: string
        }
        Insert: {
          cancellations?: number | null
          created_at?: string
          date: string
          free_meetings?: number | null
          group_meetings?: number | null
          id?: string
          paid_meetings?: number | null
          requests_accepted?: number | null
          requests_declined?: number | null
          requests_received?: number | null
          seller_id: string
          total_duration_minutes?: number | null
          total_meetings?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Update: {
          cancellations?: number | null
          created_at?: string
          date?: string
          free_meetings?: number | null
          group_meetings?: number | null
          id?: string
          paid_meetings?: number | null
          requests_accepted?: number | null
          requests_declined?: number | null
          requests_received?: number | null
          seller_id?: string
          total_duration_minutes?: number | null
          total_meetings?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      meeting_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          meeting_id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          meeting_id: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          meeting_id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_audit_logs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_cancellations: {
        Row: {
          cancellation_reason: string
          cancelled_by: string
          created_at: string
          id: string
          meeting_id: string | null
          meeting_request_id: string | null
          refund_amount: number | null
          refund_processed_at: string | null
          refund_status: string | null
          stripe_refund_id: string | null
        }
        Insert: {
          cancellation_reason: string
          cancelled_by: string
          created_at?: string
          id?: string
          meeting_id?: string | null
          meeting_request_id?: string | null
          refund_amount?: number | null
          refund_processed_at?: string | null
          refund_status?: string | null
          stripe_refund_id?: string | null
        }
        Update: {
          cancellation_reason?: string
          cancelled_by?: string
          created_at?: string
          id?: string
          meeting_id?: string | null
          meeting_request_id?: string | null
          refund_amount?: number | null
          refund_processed_at?: string | null
          refund_status?: string | null
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_cancellations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_cancellations_meeting_request_id_fkey"
            columns: ["meeting_request_id"]
            isOneToOne: false
            referencedRelation: "meeting_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          room_id: string
          sender_id: string
          sender_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          room_id: string
          sender_id: string
          sender_name: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          room_id?: string
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_consent_audit: {
        Row: {
          buyer_recording: boolean | null
          buyer_summary: boolean | null
          buyer_transcript: boolean | null
          created_at: string | null
          effective_recording: boolean | null
          effective_summary: boolean | null
          effective_transcript: boolean | null
          id: string
          locked_at: string
          locked_by: string | null
          meeting_id: string | null
          seller_recording: boolean | null
          seller_summary: boolean | null
          seller_transcript: boolean | null
        }
        Insert: {
          buyer_recording?: boolean | null
          buyer_summary?: boolean | null
          buyer_transcript?: boolean | null
          created_at?: string | null
          effective_recording?: boolean | null
          effective_summary?: boolean | null
          effective_transcript?: boolean | null
          id?: string
          locked_at?: string
          locked_by?: string | null
          meeting_id?: string | null
          seller_recording?: boolean | null
          seller_summary?: boolean | null
          seller_transcript?: boolean | null
        }
        Update: {
          buyer_recording?: boolean | null
          buyer_summary?: boolean | null
          buyer_transcript?: boolean | null
          created_at?: string | null
          effective_recording?: boolean | null
          effective_summary?: boolean | null
          effective_transcript?: boolean | null
          id?: string
          locked_at?: string
          locked_by?: string | null
          meeting_id?: string | null
          seller_recording?: boolean | null
          seller_summary?: boolean | null
          seller_transcript?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_consent_audit_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_extensions: {
        Row: {
          created_at: string | null
          extended_by: string
          extension_cost: number | null
          extension_minutes: number
          id: string
          invoice_id: string | null
          invoiced: boolean | null
          invoiced_at: string | null
          is_paid_meeting: boolean | null
          meeting_id: string
          new_duration: number
          original_duration: number
        }
        Insert: {
          created_at?: string | null
          extended_by: string
          extension_cost?: number | null
          extension_minutes: number
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          invoiced_at?: string | null
          is_paid_meeting?: boolean | null
          meeting_id: string
          new_duration: number
          original_duration: number
        }
        Update: {
          created_at?: string | null
          extended_by?: string
          extension_cost?: number | null
          extension_minutes?: number
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          invoiced_at?: string | null
          is_paid_meeting?: boolean | null
          meeting_id?: string
          new_duration?: number
          original_duration?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_extensions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          invitee_email: string
          invitee_user_id: string | null
          inviter_id: string
          meeting_id: string
          message: string | null
          participant_role: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invitee_email: string
          invitee_user_id?: string | null
          inviter_id: string
          meeting_id: string
          message?: string | null
          participant_role?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invitee_email?: string
          invitee_user_id?: string | null
          inviter_id?: string
          meeting_id?: string
          message?: string | null
          participant_role?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_invites_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_join_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          ip_address: string
          meeting_id: string | null
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          ip_address: string
          meeting_id?: string | null
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          id?: string
          ip_address?: string
          meeting_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_join_attempts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          meeting_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          meeting_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          meeting_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participant_settings: {
        Row: {
          allow_guest_invites: boolean
          created_at: string
          id: string
          max_buyer_team: number
          max_participants: number
          max_seller_team: number
          meeting_id: string
          screen_share_allowed_roles: string[] | null
          updated_at: string
        }
        Insert: {
          allow_guest_invites?: boolean
          created_at?: string
          id?: string
          max_buyer_team?: number
          max_participants?: number
          max_seller_team?: number
          meeting_id: string
          screen_share_allowed_roles?: string[] | null
          updated_at?: string
        }
        Update: {
          allow_guest_invites?: boolean
          created_at?: string
          id?: string
          max_buyer_team?: number
          max_participants?: number
          max_seller_team?: number
          meeting_id?: string
          screen_share_allowed_roles?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participant_settings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          accepted_at: string | null
          attended: boolean | null
          consent_locked: boolean | null
          consent_locked_at: string | null
          consent_recording: boolean | null
          consent_summary: boolean | null
          consent_transcript: boolean | null
          created_at: string
          declined_at: string | null
          email: string | null
          id: string
          invite_status: string | null
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          left_at: string | null
          meeting_id: string
          participant_role: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          attended?: boolean | null
          consent_locked?: boolean | null
          consent_locked_at?: string | null
          consent_recording?: boolean | null
          consent_summary?: boolean | null
          consent_transcript?: boolean | null
          created_at?: string
          declined_at?: string | null
          email?: string | null
          id?: string
          invite_status?: string | null
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          left_at?: string | null
          meeting_id: string
          participant_role?: string | null
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          attended?: boolean | null
          consent_locked?: boolean | null
          consent_locked_at?: string | null
          consent_recording?: boolean | null
          consent_summary?: boolean | null
          consent_transcript?: boolean | null
          created_at?: string
          declined_at?: string | null
          email?: string | null
          id?: string
          invite_status?: string | null
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          left_at?: string | null
          meeting_id?: string
          participant_role?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_payments: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          id: string
          meeting_id: string | null
          meeting_request_id: string | null
          organization_id: string | null
          platform_fee: number
          refund_reason: string | null
          refunded_at: string | null
          seller_earnings: number
          seller_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          currency?: string
          id?: string
          meeting_id?: string | null
          meeting_request_id?: string | null
          organization_id?: string | null
          platform_fee: number
          refund_reason?: string | null
          refunded_at?: string | null
          seller_earnings: number
          seller_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          id?: string
          meeting_id?: string | null
          meeting_request_id?: string | null
          organization_id?: string | null
          platform_fee?: number
          refund_reason?: string | null
          refunded_at?: string | null
          seller_earnings?: number
          seller_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_payments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_payments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_payments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_payments_meeting_request_id_fkey"
            columns: ["meeting_request_id"]
            isOneToOne: false
            referencedRelation: "meeting_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_payments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_payments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_preferences: {
        Row: {
          consent_locked: boolean | null
          consent_locked_at: string | null
          created_at: string | null
          id: string
          meeting_id: string
          updated_at: string | null
          user_id: string
          wants_recording: boolean | null
          wants_summary: boolean | null
          wants_transcript: boolean | null
        }
        Insert: {
          consent_locked?: boolean | null
          consent_locked_at?: string | null
          created_at?: string | null
          id?: string
          meeting_id: string
          updated_at?: string | null
          user_id: string
          wants_recording?: boolean | null
          wants_summary?: boolean | null
          wants_transcript?: boolean | null
        }
        Update: {
          consent_locked?: boolean | null
          consent_locked_at?: string | null
          created_at?: string | null
          id?: string
          meeting_id?: string
          updated_at?: string | null
          user_id?: string
          wants_recording?: boolean | null
          wants_summary?: boolean | null
          wants_transcript?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_preferences_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_processing_jobs: {
        Row: {
          created_at: string | null
          id: string
          last_error: string | null
          meeting_id: string
          processing_completed_at: string | null
          processing_started_at: string | null
          recording_started_at: string | null
          recording_stopped_at: string | null
          status: string | null
          summary_generated_at: string | null
          transcript_generated_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_error?: string | null
          meeting_id: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          status?: string | null
          summary_generated_at?: string | null
          transcript_generated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_error?: string | null
          meeting_id?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          status?: string | null
          summary_generated_at?: string | null
          transcript_generated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_processing_jobs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          meeting_id: string
          processed_at: string | null
          room_id: string | null
          status: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          meeting_id: string
          processed_at?: string | null
          room_id?: string | null
          status?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          meeting_id?: string
          processed_at?: string | null
          room_id?: string | null
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reminders: {
        Row: {
          created_at: string
          email_sent: boolean | null
          id: string
          meeting_id: string
          notification_sent: boolean | null
          recipient_id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean | null
          id?: string
          meeting_id: string
          notification_sent?: boolean | null
          recipient_id: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean | null
          id?: string
          meeting_id?: string
          notification_sent?: boolean | null
          recipient_id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reminders_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_requests: {
        Row: {
          buyer_id: string
          buyer_message: string | null
          buyer_timezone: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consent_to_contact: boolean | null
          contact_description: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_topic: string | null
          created_at: string
          declined_reason: string | null
          id: string
          is_open_request: boolean | null
          meeting_method: string | null
          meeting_type_id: string | null
          organization_id: string | null
          paid_at: string | null
          payment_status: string | null
          requested_date: string
          requested_time: string
          requires_payment: boolean | null
          seller_id: string
          seller_proposed_date: string | null
          seller_proposed_method: string | null
          seller_proposed_time: string | null
          seller_set_price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_message?: string | null
          buyer_timezone: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          consent_to_contact?: boolean | null
          contact_description?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_topic?: string | null
          created_at?: string
          declined_reason?: string | null
          id?: string
          is_open_request?: boolean | null
          meeting_method?: string | null
          meeting_type_id?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          requested_date: string
          requested_time: string
          requires_payment?: boolean | null
          seller_id: string
          seller_proposed_date?: string | null
          seller_proposed_method?: string | null
          seller_proposed_time?: string | null
          seller_set_price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_message?: string | null
          buyer_timezone?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          consent_to_contact?: boolean | null
          contact_description?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_topic?: string | null
          created_at?: string
          declined_reason?: string | null
          id?: string
          is_open_request?: boolean | null
          meeting_method?: string | null
          meeting_type_id?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          requested_date?: string
          requested_time?: string
          requires_payment?: boolean | null
          seller_id?: string
          seller_proposed_date?: string | null
          seller_proposed_method?: string | null
          seller_proposed_time?: string | null
          seller_set_price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_retention: {
        Row: {
          created_at: string
          delete_at: string | null
          meeting_id: string
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delete_at?: string | null
          meeting_id: string
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delete_at?: string | null
          meeting_id?: string
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_retention_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_room_participants: {
        Row: {
          display_name: string
          id: string
          is_muted: boolean | null
          is_screen_sharing: boolean | null
          is_video_on: boolean | null
          joined_at: string | null
          left_at: string | null
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          is_muted?: boolean | null
          is_screen_sharing?: boolean | null
          is_video_on?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          is_muted?: boolean | null
          is_screen_sharing?: boolean | null
          is_video_on?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          ai_summary_enabled: boolean | null
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          join_slug: string | null
          meeting_id: string | null
          recording_enabled: boolean | null
          room_code: string
          started_at: string | null
          status: string
          transcription_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          ai_summary_enabled?: boolean | null
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          join_slug?: string | null
          meeting_id?: string | null
          recording_enabled?: boolean | null
          room_code: string
          started_at?: string | null
          status?: string
          transcription_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          ai_summary_enabled?: boolean | null
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          join_slug?: string | null
          meeting_id?: string | null
          recording_enabled?: boolean | null
          room_code?: string
          started_at?: string | null
          status?: string
          transcription_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rooms_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_slot_holds: {
        Row: {
          created_at: string
          duration_minutes: number
          expires_at: string
          held_by_email: string | null
          held_by_user_id: string | null
          id: string
          meeting_type_id: string | null
          seller_id: string
          slot_date: string
          slot_time: string
          stripe_checkout_session_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          expires_at: string
          held_by_email?: string | null
          held_by_user_id?: string | null
          id?: string
          meeting_type_id?: string | null
          seller_id: string
          slot_date: string
          slot_time: string
          stripe_checkout_session_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          expires_at?: string
          held_by_email?: string | null
          held_by_user_id?: string | null
          id?: string
          meeting_type_id?: string | null
          seller_id?: string
          slot_date?: string
          slot_time?: string
          stripe_checkout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_slot_holds_held_by_user_id_fkey"
            columns: ["held_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_holds_held_by_user_id_fkey"
            columns: ["held_by_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_holds_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_holds_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_holds_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summaries: {
        Row: {
          created_at: string
          id: string
          key_points: Json | null
          meeting_id: string
          next_steps: Json | null
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_points?: Json | null
          meeting_id: string
          next_steps?: Json | null
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          key_points?: Json | null
          meeting_id?: string
          next_steps?: Json | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_summaries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_transcripts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_live: boolean | null
          language: string | null
          meeting_id: string
          room_id: string | null
          speaker_id: string | null
          speaker_name: string | null
          timestamp_ms: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_live?: boolean | null
          language?: string | null
          meeting_id: string
          room_id?: string | null
          speaker_id?: string | null
          speaker_name?: string | null
          timestamp_ms?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_live?: boolean | null
          language?: string | null
          meeting_id?: string
          room_id?: string | null
          speaker_id?: string | null
          speaker_name?: string | null
          timestamp_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_transcripts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_types: {
        Row: {
          allowed_platforms: string[] | null
          created_at: string
          currency: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          is_group: boolean
          is_paid: boolean
          is_public: boolean | null
          max_participants: number | null
          name: string
          price: number | null
          price_cents: number | null
          seller_id: string
          stripe_required: boolean | null
          updated_at: string
        }
        Insert: {
          allowed_platforms?: string[] | null
          created_at?: string
          currency?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_paid?: boolean
          is_public?: boolean | null
          max_participants?: number | null
          name: string
          price?: number | null
          price_cents?: number | null
          seller_id: string
          stripe_required?: boolean | null
          updated_at?: string
        }
        Update: {
          allowed_platforms?: string[] | null
          created_at?: string
          currency?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_paid?: boolean
          is_public?: boolean | null
          max_participants?: number | null
          name?: string
          price?: number | null
          price_cents?: number | null
          seller_id?: string
          stripe_required?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_types_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_types_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_user_assets: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          status: string
          storage_path: string | null
          text_content: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          status?: string
          storage_path?: string | null
          text_content?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          status?: string
          storage_path?: string | null
          text_content?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_user_assets_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          delivered_at: string | null
          delivery_deadline: string | null
          delivery_status: string | null
          duration_minutes: number
          id: string
          join_notification_sent_at: string | null
          meeting_code: string | null
          meeting_code_expires_at: string | null
          meeting_date: string
          meeting_link: string | null
          meeting_platform: string | null
          meeting_platform_type: string | null
          meeting_time: string
          meeting_type_id: string
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_status: string | null
          refund_processed_at: string | null
          refund_status: string | null
          reminder_1h_sent: boolean | null
          reminder_24h_sent: boolean | null
          request_id: string | null
          requires_payment: boolean | null
          room_id: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_deadline?: string | null
          delivery_status?: string | null
          duration_minutes: number
          id?: string
          join_notification_sent_at?: string | null
          meeting_code?: string | null
          meeting_code_expires_at?: string | null
          meeting_date: string
          meeting_link?: string | null
          meeting_platform?: string | null
          meeting_platform_type?: string | null
          meeting_time: string
          meeting_type_id: string
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          refund_processed_at?: string | null
          refund_status?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          request_id?: string | null
          requires_payment?: boolean | null
          room_id?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_deadline?: string | null
          delivery_status?: string | null
          duration_minutes?: number
          id?: string
          join_notification_sent_at?: string | null
          meeting_code?: string | null
          meeting_code_expires_at?: string | null
          meeting_date?: string
          meeting_link?: string | null
          meeting_platform?: string | null
          meeting_platform_type?: string | null
          meeting_time?: string
          meeting_type_id?: string
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          refund_processed_at?: string | null
          refund_status?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          request_id?: string | null
          requires_payment?: boolean | null
          room_id?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "meeting_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_caption: string | null
          attachment_storage_key: string | null
          content: string
          created_at: string | null
          deleted_by_recipient: boolean | null
          deleted_by_sender: boolean | null
          edited_at: string | null
          id: string
          is_read: boolean | null
          order_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          thread_id: string | null
          updated_at: string | null
        }
        Insert: {
          attachment_caption?: string | null
          attachment_storage_key?: string | null
          content: string
          created_at?: string | null
          deleted_by_recipient?: boolean | null
          deleted_by_sender?: boolean | null
          edited_at?: string | null
          id?: string
          is_read?: boolean | null
          order_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attachment_caption?: string | null
          attachment_storage_key?: string | null
          content?: string
          created_at?: string | null
          deleted_by_recipient?: boolean | null
          deleted_by_sender?: boolean | null
          edited_at?: string | null
          id?: string
          is_read?: boolean | null
          order_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          moderator_id: string | null
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          moderator_id?: string | null
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          moderator_id?: string | null
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_audit_logs_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_audit_logs_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_block_logs: {
        Row: {
          action: string | null
          content_hash: string | null
          context: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          rule: string | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          content_hash?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          rule?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          content_hash?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          rule?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      moderation_flags: {
        Row: {
          category: string | null
          content_hash: string | null
          context: string | null
          created_at: string | null
          id: string
          model_score: number | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          content_hash?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          model_score?: number | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          content_hash?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          model_score?: number | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      moderation_violations: {
        Row: {
          auto_action: string | null
          categories: string[] | null
          content_hash: string | null
          content_type: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          user_id: string
          violation_type: string
        }
        Insert: {
          auto_action?: string | null
          categories?: string[] | null
          content_hash?: string | null
          content_type: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id: string
          violation_type: string
        }
        Update: {
          auto_action?: string | null
          categories?: string[] | null
          content_hash?: string | null
          content_type?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_mentions: boolean | null
          email_messages: boolean | null
          email_orders: boolean | null
          email_payouts: boolean | null
          email_reports: boolean | null
          email_reviews: boolean | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_mentions?: boolean | null
          email_messages?: boolean | null
          email_orders?: boolean | null
          email_payouts?: boolean | null
          email_reports?: boolean | null
          email_reviews?: boolean | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_mentions?: boolean | null
          email_messages?: boolean | null
          email_orders?: boolean | null
          email_payouts?: boolean | null
          email_reports?: boolean | null
          email_reviews?: boolean | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_confirmed_at: string | null
          buyer_id: string
          created_at: string | null
          escrow_status: string | null
          held_amount: number | null
          id: string
          last_nudged_at: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_instructions: string | null
          payment_method: string | null
          platform_fee: number | null
          price: number
          product_id: string
          quantity: number
          refund_deadline: string | null
          released_at: string | null
          seller_earnings: number | null
          seller_marked_delivered_at: string | null
          seller_notified_at: string | null
          seller_nudge_count: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          buyer_confirmed_at?: string | null
          buyer_id: string
          created_at?: string | null
          escrow_status?: string | null
          held_amount?: number | null
          id?: string
          last_nudged_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_instructions?: string | null
          payment_method?: string | null
          platform_fee?: number | null
          price: number
          product_id: string
          quantity?: number
          refund_deadline?: string | null
          released_at?: string | null
          seller_earnings?: number | null
          seller_marked_delivered_at?: string | null
          seller_notified_at?: string | null
          seller_nudge_count?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          buyer_confirmed_at?: string | null
          buyer_id?: string
          created_at?: string | null
          escrow_status?: string | null
          held_amount?: number | null
          id?: string
          last_nudged_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_instructions?: string | null
          payment_method?: string | null
          platform_fee?: number | null
          price?: number
          product_id?: string
          quantity?: number
          refund_deadline?: string | null
          released_at?: string | null
          seller_earnings?: number | null
          seller_marked_delivered_at?: string | null
          seller_notified_at?: string | null
          seller_nudge_count?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          organization_id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          organization_id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          organization_id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_billing_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_email: string | null
          city: string | null
          country: string | null
          created_at: string
          currency_preference: string | null
          legal_name: string | null
          org_id: string
          postal_code: string | null
          updated_at: string
          vat_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency_preference?: string | null
          legal_name?: string | null
          org_id: string
          postal_code?: string | null
          updated_at?: string
          vat_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency_preference?: string | null
          legal_name?: string | null
          org_id?: string
          postal_code?: string | null
          updated_at?: string
          vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_billing_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string
          invitee_email: string
          organization_id: string
          responded_at: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by: string
          invitee_email: string
          organization_id: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string
          invitee_email?: string
          organization_id?: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          organization_id?: string
          role?: string
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
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          attempt_data: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          payment_id: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          attempt_data?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          payment_id?: string | null
          status: string
          user_agent?: string | null
        }
        Update: {
          attempt_data?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          payment_id?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      payment_confirmations: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          notes: string | null
          order_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          notes?: string | null
          order_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          notes?: string | null
          order_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_confirmations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_payouts: {
        Row: {
          amount: number
          arrival_date: string | null
          bank_last4: string | null
          created_at: string | null
          currency: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          seller_id: string
          status: string | null
          stripe_payout_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          arrival_date?: string | null
          bank_last4?: string | null
          created_at?: string | null
          currency?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          seller_id: string
          status?: string | null
          stripe_payout_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          arrival_date?: string | null
          bank_last4?: string | null
          created_at?: string | null
          currency?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          seller_id?: string
          status?: string | null
          stripe_payout_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          platform_amount: number | null
          platform_iban_masked: string | null
          provider: string
          provider_payment_intent_id: string | null
          provider_session_id: string | null
          seller_amount: number | null
          seller_iban_masked: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          platform_amount?: number | null
          platform_iban_masked?: string | null
          provider: string
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          seller_amount?: number | null
          seller_iban_masked?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          platform_amount?: number | null
          platform_iban_masked?: string | null
          provider?: string
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          seller_amount?: number | null
          seller_iban_masked?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          hold_status: string
          id: string
          method: string
          order_id: string
          provider_payment_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          hold_status?: string
          id?: string
          method?: string
          order_id: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          hold_status?: string
          id?: string
          method?: string
          order_id?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account_holder_name: string | null
          bank_country: string | null
          created_at: string | null
          details_encrypted: string | null
          iban: string | null
          id: string
          paypal_email_encrypted: string | null
          seller_id: string
          status: string
          stripe_account_id: string | null
          type: string
          updated_at: string | null
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          account_holder_name?: string | null
          bank_country?: string | null
          created_at?: string | null
          details_encrypted?: string | null
          iban?: string | null
          id?: string
          paypal_email_encrypted?: string | null
          seller_id: string
          status?: string
          stripe_account_id?: string | null
          type: string
          updated_at?: string | null
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          account_holder_name?: string | null
          bank_country?: string | null
          created_at?: string | null
          details_encrypted?: string | null
          iban?: string | null
          id?: string
          paypal_email_encrypted?: string | null
          seller_id?: string
          status?: string
          stripe_account_id?: string | null
          type?: string
          updated_at?: string | null
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string | null
          currency: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          initiated_at: string | null
          payout_method_id: string | null
          provider_payout_id: string | null
          rejection_reason: string | null
          requires_approval: boolean | null
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          payout_method_id?: string | null
          provider_payout_id?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean | null
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          payout_method_id?: string | null
          provider_payout_id?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_balances: {
        Row: {
          available_balance: number
          currency: string
          held_balance: number
          id: string
          updated_at: string | null
        }
        Insert: {
          available_balance?: number
          currency?: string
          held_balance?: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          available_balance?: number
          currency?: string
          held_balance?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_ledger_entries: {
        Row: {
          amount: number
          currency: string
          description: string | null
          id: string
          source_id: string | null
          source_type: string | null
          timestamp: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          currency?: string
          description?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          timestamp?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          currency?: string
          description?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          timestamp?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_payment_settings: {
        Row: {
          admin_account_holder: string | null
          admin_iban_encrypted: string | null
          admin_iban_masked: string | null
          card_payments_globally_enabled: boolean | null
          created_at: string | null
          id: string
          platform_fee_percentage: number | null
          provider: string
          provider_mode: string
          updated_at: string | null
        }
        Insert: {
          admin_account_holder?: string | null
          admin_iban_encrypted?: string | null
          admin_iban_masked?: string | null
          card_payments_globally_enabled?: boolean | null
          created_at?: string | null
          id?: string
          platform_fee_percentage?: number | null
          provider?: string
          provider_mode?: string
          updated_at?: string | null
        }
        Update: {
          admin_account_holder?: string | null
          admin_iban_encrypted?: string | null
          admin_iban_masked?: string | null
          card_payments_globally_enabled?: boolean | null
          created_at?: string | null
          id?: string
          platform_fee_percentage?: number | null
          provider?: string
          provider_mode?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          rule_type: string
          rules: Json
          title: string
          updated_at: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rule_type: string
          rules?: Json
          title: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rule_type?: string
          rules?: Json
          title?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      platform_statistics: {
        Row: {
          created_at: string | null
          daily_orders: number | null
          daily_revenue: number | null
          daily_sales: number | null
          id: string
          monthly_revenue: number | null
          monthly_sales: number | null
          stat_date: string
          top_categories: Json | null
          total_products: number | null
          total_sellers: number | null
          trending_products: Json | null
          weekly_revenue: number | null
          weekly_sales: number | null
        }
        Insert: {
          created_at?: string | null
          daily_orders?: number | null
          daily_revenue?: number | null
          daily_sales?: number | null
          id?: string
          monthly_revenue?: number | null
          monthly_sales?: number | null
          stat_date?: string
          top_categories?: Json | null
          total_products?: number | null
          total_sellers?: number | null
          trending_products?: Json | null
          weekly_revenue?: number | null
          weekly_sales?: number | null
        }
        Update: {
          created_at?: string | null
          daily_orders?: number | null
          daily_revenue?: number | null
          daily_sales?: number | null
          id?: string
          monthly_revenue?: number | null
          monthly_sales?: number | null
          stat_date?: string
          top_categories?: Json | null
          total_products?: number | null
          total_sellers?: number | null
          trending_products?: Json | null
          weekly_revenue?: number | null
          weekly_sales?: number | null
        }
        Relationships: []
      }
      portfolio_products: {
        Row: {
          category: string
          completed_date: string
          created_at: string
          currency: string
          customer_anonymous: boolean | null
          customer_name: string | null
          description: string
          external_url: string | null
          id: string
          images: string[] | null
          is_public: boolean
          price_display_mode: string | null
          price_paid: number
          price_range_max: number | null
          price_range_min: number | null
          product_id: string | null
          seller_id: string
          show_seller_name: boolean
          tags: string[] | null
          time_spent_hours: number | null
          title: string
          updated_at: string
          videos: string[] | null
          website_links: Json | null
        }
        Insert: {
          category: string
          completed_date: string
          created_at?: string
          currency?: string
          customer_anonymous?: boolean | null
          customer_name?: string | null
          description: string
          external_url?: string | null
          id?: string
          images?: string[] | null
          is_public?: boolean
          price_display_mode?: string | null
          price_paid?: number
          price_range_max?: number | null
          price_range_min?: number | null
          product_id?: string | null
          seller_id: string
          show_seller_name?: boolean
          tags?: string[] | null
          time_spent_hours?: number | null
          title: string
          updated_at?: string
          videos?: string[] | null
          website_links?: Json | null
        }
        Update: {
          category?: string
          completed_date?: string
          created_at?: string
          currency?: string
          customer_anonymous?: boolean | null
          customer_name?: string | null
          description?: string
          external_url?: string | null
          id?: string
          images?: string[] | null
          is_public?: boolean
          price_display_mode?: string | null
          price_paid?: number
          price_range_max?: number | null
          price_range_min?: number | null
          product_id?: string | null
          seller_id?: string
          show_seller_name?: boolean
          tags?: string[] | null
          time_spent_hours?: number | null
          title?: string
          updated_at?: string
          videos?: string[] | null
          website_links?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string | null
          id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          moderation_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          moderation_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          moderation_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_auth_sessions: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown
          token: string
          user_id: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          token: string
          user_id: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      product_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          product_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          product_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          product_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_analytics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_delivery_logs: {
        Row: {
          action: string
          buyer_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          product_id: string | null
          seller_id: string | null
        }
        Insert: {
          action: string
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          product_id?: string | null
          seller_id?: string | null
        }
        Update: {
          action?: string
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          product_id?: string | null
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_delivery_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_delivery_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_faq: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          product_id: string
          question: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          product_id: string
          question: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          product_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_faq_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_payment_options: {
        Row: {
          balance_enabled: boolean | null
          card_enabled: boolean | null
          created_at: string | null
          id: string
          invoice_enabled: boolean | null
          other_options: Json | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          balance_enabled?: boolean | null
          card_enabled?: boolean | null
          created_at?: string | null
          id?: string
          invoice_enabled?: boolean | null
          other_options?: Json | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          balance_enabled?: boolean | null
          card_enabled?: boolean | null
          created_at?: string | null
          id?: string
          invoice_enabled?: boolean | null
          other_options?: Json | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_payment_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_rankings: {
        Row: {
          id: string
          last_calculated_at: string | null
          lifetime_revenue: number | null
          lifetime_sales: number | null
          product_id: string
          ranking_position: number | null
          recent_7day_revenue: number | null
          recent_7day_sales: number | null
          trending_score: number | null
        }
        Insert: {
          id?: string
          last_calculated_at?: string | null
          lifetime_revenue?: number | null
          lifetime_sales?: number | null
          product_id: string
          ranking_position?: number | null
          recent_7day_revenue?: number | null
          recent_7day_sales?: number | null
          trending_score?: number | null
        }
        Update: {
          id?: string
          last_calculated_at?: string | null
          lifetime_revenue?: number | null
          lifetime_sales?: number | null
          product_id?: string
          ranking_position?: number | null
          recent_7day_revenue?: number | null
          recent_7day_sales?: number | null
          trending_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_rankings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          access_details: string | null
          admin_notes: string | null
          admin_rejection_reason: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          available: boolean | null
          available_quantity: number | null
          average_rating: number | null
          category_id: string | null
          created_at: string
          delivery_mode: string | null
          demo_url: string | null
          description: string | null
          estimated_delivery: string | null
          faqs: Json | null
          features: string[] | null
          file_hash: string | null
          file_mime: string | null
          file_scan_report: Json | null
          file_scan_status: string | null
          file_size_bytes: number | null
          file_storage_key: string | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          is_file_scanned: boolean | null
          is_published: boolean | null
          is_subscription: boolean | null
          last_sale_at: string | null
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: string | null
          moderator_id: string | null
          payment_methods: Json | null
          price: number
          pricing_model: string
          problem_solved: string | null
          product_type: string
          product_version: string | null
          production_cost: number | null
          purpose: string | null
          ranking_override: number | null
          ratings_count: number | null
          recent_7day_sales: number | null
          refund_policy: string | null
          return_allowed: boolean | null
          return_conditions: string | null
          return_fee_enabled: boolean | null
          return_fee_percentage: number | null
          return_window_days: number | null
          reviews_count: number | null
          seller_accepted_terms: boolean | null
          seller_id: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          subscription_status: string | null
          tags: string[] | null
          target_audience: string | null
          title: string
          total_revenue: number | null
          total_sales: number | null
          trending_score: number | null
          updated_at: string
          value_proposition: string | null
          verified_reviews_count: number | null
          video_url: string | null
        }
        Insert: {
          access_details?: string | null
          admin_notes?: string | null
          admin_rejection_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available?: boolean | null
          available_quantity?: number | null
          average_rating?: number | null
          category_id?: string | null
          created_at?: string
          delivery_mode?: string | null
          demo_url?: string | null
          description?: string | null
          estimated_delivery?: string | null
          faqs?: Json | null
          features?: string[] | null
          file_hash?: string | null
          file_mime?: string | null
          file_scan_report?: Json | null
          file_scan_status?: string | null
          file_size_bytes?: number | null
          file_storage_key?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          is_file_scanned?: boolean | null
          is_published?: boolean | null
          is_subscription?: boolean | null
          last_sale_at?: string | null
          moderated_at?: string | null
          moderation_notes?: string | null
          moderation_status?: string | null
          moderator_id?: string | null
          payment_methods?: Json | null
          price: number
          pricing_model: string
          problem_solved?: string | null
          product_type: string
          product_version?: string | null
          production_cost?: number | null
          purpose?: string | null
          ranking_override?: number | null
          ratings_count?: number | null
          recent_7day_sales?: number | null
          refund_policy?: string | null
          return_allowed?: boolean | null
          return_conditions?: string | null
          return_fee_enabled?: boolean | null
          return_fee_percentage?: number | null
          return_window_days?: number | null
          reviews_count?: number | null
          seller_accepted_terms?: boolean | null
          seller_id: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subscription_status?: string | null
          tags?: string[] | null
          target_audience?: string | null
          title: string
          total_revenue?: number | null
          total_sales?: number | null
          trending_score?: number | null
          updated_at?: string
          value_proposition?: string | null
          verified_reviews_count?: number | null
          video_url?: string | null
        }
        Update: {
          access_details?: string | null
          admin_notes?: string | null
          admin_rejection_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available?: boolean | null
          available_quantity?: number | null
          average_rating?: number | null
          category_id?: string | null
          created_at?: string
          delivery_mode?: string | null
          demo_url?: string | null
          description?: string | null
          estimated_delivery?: string | null
          faqs?: Json | null
          features?: string[] | null
          file_hash?: string | null
          file_mime?: string | null
          file_scan_report?: Json | null
          file_scan_status?: string | null
          file_size_bytes?: number | null
          file_storage_key?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          is_file_scanned?: boolean | null
          is_published?: boolean | null
          is_subscription?: boolean | null
          last_sale_at?: string | null
          moderated_at?: string | null
          moderation_notes?: string | null
          moderation_status?: string | null
          moderator_id?: string | null
          payment_methods?: Json | null
          price?: number
          pricing_model?: string
          problem_solved?: string | null
          product_type?: string
          product_version?: string | null
          production_cost?: number | null
          purpose?: string | null
          ranking_override?: number | null
          ratings_count?: number | null
          recent_7day_sales?: number | null
          refund_policy?: string | null
          return_allowed?: boolean | null
          return_conditions?: string | null
          return_fee_enabled?: boolean | null
          return_fee_percentage?: number | null
          return_window_days?: number | null
          reviews_count?: number | null
          seller_accepted_terms?: boolean | null
          seller_id?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subscription_status?: string | null
          tags?: string[] | null
          target_audience?: string | null
          title?: string
          total_revenue?: number | null
          total_sales?: number | null
          trending_score?: number | null
          updated_at?: string
          value_proposition?: string | null
          verified_reviews_count?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_verified_at: string | null
          avatar_position_x: number | null
          avatar_position_y: number | null
          avatar_url: string | null
          avatar_zoom: number | null
          balance_limit: number | null
          ban_expires_at: string | null
          banned_at: string | null
          banned_by: string | null
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          creator_name: string | null
          deleted_at: string | null
          email_verification_sent_at: string | null
          email_verification_token: string | null
          email_verified: boolean | null
          email_verified_at: string | null
          expanded_bio: string | null
          full_name: string | null
          id: string
          is_2fa_enabled: boolean | null
          is_age_verified: boolean | null
          is_banned: boolean | null
          is_deleted: boolean | null
          kyc_documents: string | null
          kyc_status: string | null
          kyc_verified_at: string | null
          paypal_email: string | null
          paypal_email_verified: string | null
          paypal_link: string | null
          recovery_codes_encrypted: string[] | null
          seller_application_date: string | null
          seller_application_status: string | null
          seller_badge: string | null
          seller_rejection_reason: string | null
          seller_verification_status: string | null
          seller_verified: boolean | null
          seller_verified_at: string | null
          stripe_account_id: string | null
          stripe_account_status: string | null
          stripe_onboarding_complete: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          timezone: string | null
          totp_enabled_at: string | null
          totp_secret_encrypted: string | null
          two_fa_secret: string | null
          updated_at: string
          username: string | null
          verification_documents: string | null
          website_url: string | null
          withdrawal_requires_approval: boolean | null
        }
        Insert: {
          age_verified_at?: string | null
          avatar_position_x?: number | null
          avatar_position_y?: number | null
          avatar_url?: string | null
          avatar_zoom?: number | null
          balance_limit?: number | null
          ban_expires_at?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          creator_name?: string | null
          deleted_at?: string | null
          email_verification_sent_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          expanded_bio?: string | null
          full_name?: string | null
          id: string
          is_2fa_enabled?: boolean | null
          is_age_verified?: boolean | null
          is_banned?: boolean | null
          is_deleted?: boolean | null
          kyc_documents?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          paypal_email?: string | null
          paypal_email_verified?: string | null
          paypal_link?: string | null
          recovery_codes_encrypted?: string[] | null
          seller_application_date?: string | null
          seller_application_status?: string | null
          seller_badge?: string | null
          seller_rejection_reason?: string | null
          seller_verification_status?: string | null
          seller_verified?: boolean | null
          seller_verified_at?: string | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_onboarding_complete?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          timezone?: string | null
          totp_enabled_at?: string | null
          totp_secret_encrypted?: string | null
          two_fa_secret?: string | null
          updated_at?: string
          username?: string | null
          verification_documents?: string | null
          website_url?: string | null
          withdrawal_requires_approval?: boolean | null
        }
        Update: {
          age_verified_at?: string | null
          avatar_position_x?: number | null
          avatar_position_y?: number | null
          avatar_url?: string | null
          avatar_zoom?: number | null
          balance_limit?: number | null
          ban_expires_at?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          creator_name?: string | null
          deleted_at?: string | null
          email_verification_sent_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          expanded_bio?: string | null
          full_name?: string | null
          id?: string
          is_2fa_enabled?: boolean | null
          is_age_verified?: boolean | null
          is_banned?: boolean | null
          is_deleted?: boolean | null
          kyc_documents?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          paypal_email?: string | null
          paypal_email_verified?: string | null
          paypal_link?: string | null
          recovery_codes_encrypted?: string[] | null
          seller_application_date?: string | null
          seller_application_status?: string | null
          seller_badge?: string | null
          seller_rejection_reason?: string | null
          seller_verification_status?: string | null
          seller_verified?: boolean | null
          seller_verified_at?: string | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_onboarding_complete?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          timezone?: string | null
          totp_enabled_at?: string | null
          totp_secret_encrypted?: string | null
          two_fa_secret?: string | null
          updated_at?: string
          username?: string | null
          verification_documents?: string | null
          website_url?: string | null
          withdrawal_requires_approval?: boolean | null
        }
        Relationships: []
      }
      public_booking_audit_logs: {
        Row: {
          action: string
          created_at: string
          email: string | null
          id: string
          ip_address: unknown
          meta: Json | null
          seller_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: unknown
          meta?: Json | null
          seller_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: unknown
          meta?: Json | null
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_audit_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_audit_logs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      public_booking_rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
          identifier_type: string
          seller_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          identifier_type: string
          seller_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_rate_limits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_rate_limits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      public_booking_tokens: {
        Row: {
          created_at: string
          description: string | null
          email: string
          expires_at: string
          id: string
          ip_address: unknown
          meeting_method: string | null
          meeting_type_id: string
          name: string
          phone: string | null
          requested_date: string
          requested_time: string
          seller_id: string
          timezone: string
          token: string
          topic: string | null
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          email: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          meeting_method?: string | null
          meeting_type_id: string
          name: string
          phone?: string | null
          requested_date: string
          requested_time: string
          seller_id: string
          timezone: string
          token: string
          topic?: string | null
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          meeting_method?: string | null
          meeting_type_id?: string
          name?: string
          phone?: string | null
          requested_date?: string
          requested_time?: string
          seller_id?: string
          timezone?: string
          token?: string
          topic?: string | null
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_tokens_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_tokens_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_tokens_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      public_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string | null
          id: string
          product_id: string
          seller_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string | null
          id?: string
          product_id: string
          seller_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          seller_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_count: number | null
          action_type: string
          created_at: string | null
          id: string
          user_id: string
          window_start: string | null
        }
        Insert: {
          action_count?: number | null
          action_type: string
          created_at?: string | null
          id?: string
          user_id: string
          window_start?: string | null
        }
        Update: {
          action_count?: number | null
          action_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          id: string
          payment_id: string
          provider_refund_id: string | null
          reason: string | null
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          payment_id: string
          provider_refund_id?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          payment_id?: string
          provider_refund_id?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          target_user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          target_user_id: string
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_notes: string | null
          comment: string | null
          created_at: string | null
          flag_reason: string | null
          flagged: boolean | null
          id: string
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          reviewed_by_admin: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          comment?: string | null
          created_at?: string | null
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          reviewed_by_admin?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          comment?: string | null
          created_at?: string | null
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          reviewed_by_admin?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sanction_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          sanction_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          sanction_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          sanction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sanction_audit_logs_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "user_sanctions"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          column_name: string | null
          created_at: string | null
          dry_run: boolean | null
          error_message: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          sql_applied: string | null
          success: boolean | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          column_name?: string | null
          created_at?: string | null
          dry_run?: boolean | null
          error_message?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          sql_applied?: string | null
          success?: boolean | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          column_name?: string | null
          created_at?: string | null
          dry_run?: boolean | null
          error_message?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          sql_applied?: string | null
          success?: boolean | null
          table_name?: string | null
        }
        Relationships: []
      }
      seller_achievements: {
        Row: {
          achievement_description: string | null
          achievement_name: string
          created_at: string | null
          id: string
          sales_count: number
          seller_id: string
          unlocked_at: string | null
        }
        Insert: {
          achievement_description?: string | null
          achievement_name: string
          created_at?: string | null
          id?: string
          sales_count: number
          seller_id: string
          unlocked_at?: string | null
        }
        Update: {
          achievement_description?: string | null
          achievement_name?: string
          created_at?: string | null
          id?: string
          sales_count?: number
          seller_id?: string
          unlocked_at?: string | null
        }
        Relationships: []
      }
      seller_analytics_daily: {
        Row: {
          created_at: string | null
          date: string
          id: string
          orders_count: number | null
          products_clicked: number | null
          products_viewed: number | null
          revenue: number | null
          seller_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          orders_count?: number | null
          products_clicked?: number | null
          products_viewed?: number | null
          revenue?: number | null
          seller_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          orders_count?: number | null
          products_clicked?: number | null
          products_viewed?: number | null
          revenue?: number | null
          seller_id?: string
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          applied_at: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          creator_name: string
          first_name: string
          id: string
          last_name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          creator_name: string
          first_name: string
          id?: string
          last_name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          creator_name?: string
          first_name?: string
          id?: string
          last_name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          seller_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_available?: boolean
          seller_id: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          seller_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_availability_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_availability_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_balances: {
        Row: {
          available_balance: number
          currency: string
          held_balance: number
          pending_balance: number
          seller_id: string
          updated_at: string | null
        }
        Insert: {
          available_balance?: number
          currency?: string
          held_balance?: number
          pending_balance?: number
          seller_id: string
          updated_at?: string | null
        }
        Update: {
          available_balance?: number
          currency?: string
          held_balance?: number
          pending_balance?: number
          seller_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      seller_calendar_events: {
        Row: {
          color: string
          created_at: string
          description: string | null
          end_date: string
          end_time: string
          id: string
          participant_emails: string[] | null
          recurrence: string | null
          recurrence_end_date: string | null
          seller_id: string
          start_date: string
          start_time: string
          title: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          end_date: string
          end_time: string
          id?: string
          participant_emails?: string[] | null
          recurrence?: string | null
          recurrence_end_date?: string | null
          seller_id: string
          start_date: string
          start_time: string
          title: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          end_date?: string
          end_time?: string
          id?: string
          participant_emails?: string[] | null
          recurrence?: string | null
          recurrence_end_date?: string | null
          seller_id?: string
          start_date?: string
          start_time?: string
          title?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_calendar_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_calendar_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_followers: {
        Row: {
          created_at: string | null
          follower_id: string
          id: string
          seller_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          id?: string
          seller_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          id?: string
          seller_id?: string
        }
        Relationships: []
      }
      seller_guarantees: {
        Row: {
          accepted_at: string
          created_at: string
          guarantee_type: string
          id: string
          ip_address: unknown
          is_active: boolean
          seller_id: string
          terms_version: number
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          guarantee_type?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean
          seller_id: string
          terms_version?: number
        }
        Update: {
          accepted_at?: string
          created_at?: string
          guarantee_type?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean
          seller_id?: string
          terms_version?: number
        }
        Relationships: []
      }
      seller_meeting_configs: {
        Row: {
          ai_summary_default_enabled: boolean | null
          booking_mode: string
          break_minutes: number | null
          calendar_sync_enabled: boolean | null
          calendar_sync_google: boolean | null
          calendar_sync_outlook: boolean | null
          calendar_visibility: string | null
          cancellation_deadline_hours: number | null
          cancellation_policy: string | null
          created_at: string
          google_calendar_connected: boolean | null
          google_calendar_email: string | null
          google_calendar_refresh_token_encrypted: string | null
          google_calendar_token_encrypted: string | null
          google_meet_enabled: boolean | null
          id: string
          max_meetings_per_day: number | null
          meeting_pitch: string | null
          meetings_enabled: boolean
          outlook_calendar_connected: boolean | null
          outlook_calendar_email: string | null
          outlook_calendar_refresh_token_encrypted: string | null
          outlook_calendar_token_encrypted: string | null
          preferred_platform: string | null
          public_booking_enabled: boolean | null
          public_booking_slug: string | null
          recording_default_enabled: boolean | null
          refund_policy: string | null
          seller_id: string
          teams_link: string | null
          timezone: string
          transcription_default_enabled: boolean | null
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          ai_summary_default_enabled?: boolean | null
          booking_mode?: string
          break_minutes?: number | null
          calendar_sync_enabled?: boolean | null
          calendar_sync_google?: boolean | null
          calendar_sync_outlook?: boolean | null
          calendar_visibility?: string | null
          cancellation_deadline_hours?: number | null
          cancellation_policy?: string | null
          created_at?: string
          google_calendar_connected?: boolean | null
          google_calendar_email?: string | null
          google_calendar_refresh_token_encrypted?: string | null
          google_calendar_token_encrypted?: string | null
          google_meet_enabled?: boolean | null
          id?: string
          max_meetings_per_day?: number | null
          meeting_pitch?: string | null
          meetings_enabled?: boolean
          outlook_calendar_connected?: boolean | null
          outlook_calendar_email?: string | null
          outlook_calendar_refresh_token_encrypted?: string | null
          outlook_calendar_token_encrypted?: string | null
          preferred_platform?: string | null
          public_booking_enabled?: boolean | null
          public_booking_slug?: string | null
          recording_default_enabled?: boolean | null
          refund_policy?: string | null
          seller_id: string
          teams_link?: string | null
          timezone?: string
          transcription_default_enabled?: boolean | null
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          ai_summary_default_enabled?: boolean | null
          booking_mode?: string
          break_minutes?: number | null
          calendar_sync_enabled?: boolean | null
          calendar_sync_google?: boolean | null
          calendar_sync_outlook?: boolean | null
          calendar_visibility?: string | null
          cancellation_deadline_hours?: number | null
          cancellation_policy?: string | null
          created_at?: string
          google_calendar_connected?: boolean | null
          google_calendar_email?: string | null
          google_calendar_refresh_token_encrypted?: string | null
          google_calendar_token_encrypted?: string | null
          google_meet_enabled?: boolean | null
          id?: string
          max_meetings_per_day?: number | null
          meeting_pitch?: string | null
          meetings_enabled?: boolean
          outlook_calendar_connected?: boolean | null
          outlook_calendar_email?: string | null
          outlook_calendar_refresh_token_encrypted?: string | null
          outlook_calendar_token_encrypted?: string | null
          preferred_platform?: string | null
          public_booking_enabled?: boolean | null
          public_booking_slug?: string | null
          recording_default_enabled?: boolean | null
          refund_policy?: string | null
          seller_id?: string
          teams_link?: string | null
          timezone?: string
          transcription_default_enabled?: boolean | null
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_meeting_configs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_meeting_configs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payment_configs: {
        Row: {
          account_holder_name_encrypted: string | null
          bank_name: string | null
          card_payments_enabled: boolean | null
          charges_enabled: boolean | null
          created_at: string | null
          iban_active: boolean | null
          iban_encrypted: string | null
          iban_masked: string | null
          id: string
          onboarding_completed_at: string | null
          payouts_enabled: boolean | null
          seller_id: string
          stripe_account_created_at: string | null
          stripe_account_id: string | null
          stripe_onboarding_status: string | null
          updated_at: string | null
        }
        Insert: {
          account_holder_name_encrypted?: string | null
          bank_name?: string | null
          card_payments_enabled?: boolean | null
          charges_enabled?: boolean | null
          created_at?: string | null
          iban_active?: boolean | null
          iban_encrypted?: string | null
          iban_masked?: string | null
          id?: string
          onboarding_completed_at?: string | null
          payouts_enabled?: boolean | null
          seller_id: string
          stripe_account_created_at?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_holder_name_encrypted?: string | null
          bank_name?: string | null
          card_payments_enabled?: boolean | null
          charges_enabled?: boolean | null
          created_at?: string | null
          iban_active?: boolean | null
          iban_encrypted?: string | null
          iban_masked?: string | null
          id?: string
          onboarding_completed_at?: string | null
          payouts_enabled?: boolean | null
          seller_id?: string
          stripe_account_created_at?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seller_rankings: {
        Row: {
          average_rating: number | null
          dispute_rate: number | null
          id: string
          last_calculated_at: string | null
          on_time_rate: number | null
          ranking_position: number | null
          seller_id: string
          total_products: number | null
          total_revenue: number | null
          total_sales: number | null
        }
        Insert: {
          average_rating?: number | null
          dispute_rate?: number | null
          id?: string
          last_calculated_at?: string | null
          on_time_rate?: number | null
          ranking_position?: number | null
          seller_id: string
          total_products?: number | null
          total_revenue?: number | null
          total_sales?: number | null
        }
        Update: {
          average_rating?: number | null
          dispute_rate?: number | null
          id?: string
          last_calculated_at?: string | null
          on_time_rate?: number | null
          ranking_position?: number | null
          seller_id?: string
          total_products?: number | null
          total_revenue?: number | null
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_rankings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_rankings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_terms: {
        Row: {
          content: string
          id: number
          is_active: boolean | null
          published_at: string | null
          version: string
        }
        Insert: {
          content: string
          id?: number
          is_active?: boolean | null
          published_at?: string | null
          version: string
        }
        Update: {
          content?: string
          id?: number
          is_active?: boolean | null
          published_at?: string | null
          version?: string
        }
        Relationships: []
      }
      seller_terms_acceptances: {
        Row: {
          accepted_at: string | null
          id: string
          ip_address: unknown
          seller_id: string
          terms_id: number
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          ip_address?: unknown
          seller_id: string
          terms_id: number
        }
        Update: {
          accepted_at?: string | null
          id?: string
          ip_address?: unknown
          seller_id?: string
          terms_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_terms_acceptances_terms_id_fkey"
            columns: ["terms_id"]
            isOneToOne: false
            referencedRelation: "seller_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_data_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          session_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          session_type?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          session_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sold_products: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          currency: string | null
          description: string
          id: string
          image_url: string | null
          image_url_2: string | null
          is_public: boolean
          linked_meeting_id: string | null
          price_paid: number
          seller_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          description: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_public?: boolean
          linked_meeting_id?: string | null
          price_paid: number
          seller_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          description?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_public?: boolean
          linked_meeting_id?: string | null
          price_paid?: number
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sold_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sold_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sold_products_linked_meeting_id_fkey"
            columns: ["linked_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sold_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sold_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_sanitized_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      spam_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          original_message_id: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          original_message_id?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          original_message_id?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spam_messages_original_message_id_fkey"
            columns: ["original_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          seller_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          seller_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          seller_id?: string | null
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          billing_reason: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          paid_at: string | null
          platform_fee: number | null
          seller_earnings: number | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          paid_at?: string | null
          platform_fee?: number | null
          seller_earnings?: number | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          paid_at?: string | null
          platform_fee?: number | null
          seller_earnings?: number | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          product_id: string
          seller_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          product_id: string
          seller_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          product_id?: string
          seller_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      test_meetings: {
        Row: {
          created_at: string | null
          id: string
          meeting_code: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_code: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_code?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_ip_addresses: {
        Row: {
          first_seen: string
          id: string
          ip_address: unknown
          is_trusted: boolean | null
          last_seen: string
          user_id: string
        }
        Insert: {
          first_seen?: string
          id?: string
          ip_address: unknown
          is_trusted?: boolean | null
          last_seen?: string
          user_id: string
        }
        Update: {
          first_seen?: string
          id?: string
          ip_address?: unknown
          is_trusted?: boolean | null
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_balances: {
        Row: {
          available_balance: number
          currency: string
          held_balance: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_balance?: number
          currency?: string
          held_balance?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_balance?: number
          currency?: string
          held_balance?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          banned_at: string | null
          banned_by: string
          id: string
          is_active: boolean | null
          reason: string
          unbanned_at: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string | null
          banned_by: string
          id?: string
          is_active?: boolean | null
          reason: string
          unbanned_at?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string | null
          banned_by?: string
          id?: string
          is_active?: boolean | null
          reason?: string
          unbanned_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      user_followers: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invite_code: string
          invitee_email: string | null
          invitee_id: string | null
          inviter_id: string
          metadata: Json | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invite_code: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id: string
          metadata?: Json | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invite_code?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id?: string
          metadata?: Json | null
          status?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          message_notifications: boolean | null
          order_notifications: boolean | null
          push_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          message_notifications?: boolean | null
          order_notifications?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          message_notifications?: boolean | null
          order_notifications?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen: string | null
          online: boolean | null
          typing_in_thread: string | null
          user_id: string
        }
        Insert: {
          last_seen?: string | null
          online?: boolean | null
          typing_in_thread?: string | null
          user_id: string
        }
        Update: {
          last_seen?: string | null
          online?: boolean | null
          typing_in_thread?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_typing_in_thread_fkey"
            columns: ["typing_in_thread"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
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
      user_rules_acceptance: {
        Row: {
          accepted_at: string | null
          id: string
          ip_address: unknown
          rule_type: string
          rules_version: number
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          ip_address?: unknown
          rule_type: string
          rules_version?: number
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          ip_address?: unknown
          rule_type?: string
          rules_version?: number
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sanctions: {
        Row: {
          actor_id: string | null
          created_at: string | null
          ends_at: string | null
          id: string
          reason: string
          revoked: boolean | null
          revoked_at: string | null
          revoked_by: string | null
          sanction_type: string
          starts_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          reason: string
          revoked?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
          sanction_type: string
          starts_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          reason?: string
          revoked?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
          sanction_type?: string
          starts_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string | null
          id: string
          message_privacy: string | null
          sidebar_layout: string | null
          theme_color: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_privacy?: string | null
          sidebar_layout?: string | null
          theme_color?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_privacy?: string | null
          sidebar_layout?: string | null
          theme_color?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          attempts: number
          code: string
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number
          code?: string
          code_hash: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number
          code?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles_sanitized: {
        Row: {
          avatar_url: string | null
          bio: string | null
          id: string | null
          username: string | null
        }
        Relationships: []
      }
      public_profiles_sanitized_safe: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          creator_name: string | null
          full_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          creator_name?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          creator_name?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      secure_profiles: {
        Row: {
          age_verified_at: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          creator_name: string | null
          expanded_bio: string | null
          full_name: string | null
          id: string | null
          is_2fa_enabled: boolean | null
          is_age_verified: boolean | null
          kyc_status: string | null
          seller_application_status: string | null
          seller_verification_status: string | null
          terms_accepted: boolean | null
          updated_at: string | null
          username: string | null
          website_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_approve_payout: {
        Args: { _admin_id: string; _payout_id: string }
        Returns: undefined
      }
      append_dk_meeting_audit: {
        Args: {
          p_actor_id?: string
          p_details?: Json
          p_event: string
          p_meeting_id: string
        }
        Returns: undefined
      }
      calculate_escrow_split: {
        Args: { _order_amount: number }
        Returns: {
          platform_amount: number
          seller_amount: number
        }[]
      }
      calculate_meeting_effective_consent: {
        Args: { p_meeting_id: string }
        Returns: Json
      }
      calculate_trending_score: {
        Args: {
          _avg_rating: number
          _is_featured: boolean
          _recent_sales: number
          _total_sales: number
        }
        Returns: number
      }
      can_access_product_file: {
        Args: { _order_id?: string; _product_id: string; _user_id: string }
        Returns: boolean
      }
      can_invite_to_meeting: {
        Args: {
          p_inviter_id: string
          p_meeting_id: string
          p_target_role: string
        }
        Returns: boolean
      }
      can_join_meeting: {
        Args: { p_meeting_id: string; p_user_id: string }
        Returns: Json
      }
      can_message_user: {
        Args: { recipient_user_id: string; sender_user_id: string }
        Returns: boolean
      }
      check_public_booking_rate_limit: {
        Args: {
          p_identifier: string
          p_identifier_type: string
          p_max_requests?: number
          p_seller_id?: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max: number
          p_minutes: number
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_expired_meeting_holds: { Args: never; Returns: undefined }
      cleanup_expired_pre_auth_sessions: { Args: never; Returns: undefined }
      cleanup_expired_reauth_sessions: { Args: never; Returns: undefined }
      cleanup_expired_verification_codes: { Args: never; Returns: undefined }
      count_recent_blocks: { Args: { p_user_id: string }; Returns: number }
      decrypt_payout_data: { Args: { encrypted_text: string }; Returns: string }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string }
        Returns: string
      }
      encrypt_payout_data: { Args: { data_text: string }; Returns: string }
      encrypt_sensitive_data: { Args: { data_value: string }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_meeting_code: { Args: never; Returns: string }
      get_available_meeting_slots: {
        Args: {
          p_date: string
          p_duration_minutes?: number
          p_seller_id: string
        }
        Returns: {
          is_available: boolean
          slot_time: string
        }[]
      }
      get_current_rules_version: {
        Args: { _rule_type: string }
        Returns: number
      }
      get_current_user_id: { Args: never; Returns: string }
      get_meeting_by_code: {
        Args: { p_meeting_code: string; p_meeting_id: string }
        Returns: {
          buyer_name: string
          description: string
          id: string
          meeting_code: string
          scheduled_end: string
          scheduled_start: string
          seller_name: string
          status: string
          title: string
        }[]
      }
      get_payout_methods_secure: {
        Args: { method_seller_id?: string }
        Returns: {
          account_holder_name: string
          bank_country: string
          created_at: string
          details_encrypted: string
          iban: string
          id: string
          paypal_email_encrypted: string
          seller_id: string
          status: string
          stripe_account_id: string
          type: string
          updated_at: string
          verification_method: string
          verified_at: string
        }[]
      }
      get_profile_secure: {
        Args: { profile_user_id?: string }
        Returns: {
          age_verified_at: string
          avatar_url: string
          balance_limit: number
          bank_account_holder: string
          bank_name: string
          banner_url: string
          bio: string
          country: string
          created_at: string
          creator_name: string
          expanded_bio: string
          full_name: string
          iban_for_withdrawal: string
          id: string
          is_2fa_enabled: boolean
          is_age_verified: boolean
          kyc_documents: string
          kyc_status: string
          kyc_verified_at: string
          paypal_email: string
          paypal_email_verified: string
          paypal_link: string
          seller_application_date: string
          seller_application_status: string
          seller_rejection_reason: string
          seller_verification_status: string
          stripe_account_id: string
          stripe_account_status: string
          stripe_onboarding_complete: string
          terms_accepted: boolean
          terms_accepted_at: string
          two_fa_secret: string
          updated_at: string
          username: string
          verification_documents: string
          website_url: string
          withdrawal_requires_approval: boolean
        }[]
      }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          banner_url: string
          bio: string
          country: string
          created_at: string
          creator_name: string
          full_name: string
          id: string
          is_age_verified: boolean
          seller_application_status: string
          username: string
          website_url: string
        }[]
      }
      get_public_profiles_sanitized: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          id: string
          username: string
        }[]
      }
      get_public_seller_booking_info: {
        Args: { p_username: string }
        Returns: {
          avatar_url: string
          full_name: string
          meeting_pitch: string
          public_booking_enabled: boolean
          seller_id: string
          timezone: string
          username: string
        }[]
      }
      get_secure_profiles: {
        Args: never
        Returns: {
          age_verified_at: string
          avatar_url: string
          banner_url: string
          bio: string
          country: string
          created_at: string
          creator_name: string
          expanded_bio: string
          full_name: string
          id: string
          is_2fa_enabled: boolean
          is_age_verified: boolean
          kyc_status: string
          seller_application_status: string
          seller_verification_status: string
          terms_accepted: boolean
          updated_at: string
          username: string
          website_url: string
        }[]
      }
      get_seller_analytics: {
        Args: { _end_date?: string; _seller_id: string; _start_date?: string }
        Returns: {
          total_clicks: number
          total_products: number
          total_purchases: number
          total_revenue: number
          total_views: number
        }[]
      }
      get_seller_analytics_daily: {
        Args: {
          p_end_date?: string
          p_seller_id: string
          p_start_date?: string
        }
        Returns: {
          confirmed: number
          date: string
          page_views: number
          paid: number
          requests: number
          revenue_gross: number
        }[]
      }
      get_seller_analytics_summary: {
        Args: {
          p_end_date?: string
          p_seller_id: string
          p_source?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_seller_top_meeting_types: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_seller_id: string
          p_start_date?: string
        }
        Returns: {
          bookings: number
          meeting_type_id: string
          meeting_type_name: string
          revenue: number
        }[]
      }
      has_accepted_rules: {
        Args: { _rule_type: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_reauth_session: { Args: { _user_id: string }; Returns: boolean }
      is_blocked: {
        Args: { blocked_user_id: string; blocker_user_id: string }
        Returns: boolean
      }
      is_card_payments_allowed: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      is_email_banned: { Args: { p_email: string }; Returns: boolean }
      is_meeting_participant: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_meeting_slot_available: {
        Args: {
          p_date: string
          p_duration_minutes: number
          p_seller_id: string
          p_time: string
        }
        Returns: boolean
      }
      is_meeting_slot_held: {
        Args: {
          p_date: string
          p_duration_minutes: number
          p_seller_id: string
          p_time: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_thread_participant: {
        Args: { p_thread_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_banned: { Args: { p_user_id: string }; Returns: boolean }
      log_login_attempt: {
        Args: { _email: string; _ip_address?: string; _success: boolean }
        Returns: undefined
      }
      log_payment_audit: {
        Args: {
          p_action: string
          p_ip_address?: string
          p_new_data?: Json
          p_old_data?: Json
          p_target_id: string
          p_target_table: string
        }
        Returns: string
      }
      log_payout_access: {
        Args: {
          _action: string
          _ip_address?: unknown
          _payout_method_id: string
        }
        Returns: undefined
      }
      update_platform_balance: {
        Args: {
          _amount: number
          _description: string
          _operation: string
          _source_id: string
          _source_type: string
        }
        Returns: undefined
      }
      update_product_rankings: { Args: never; Returns: undefined }
      update_seller_balance: {
        Args: {
          _amount: number
          _balance_type: string
          _description: string
          _operation: string
          _seller_id: string
          _source_id: string
          _source_type: string
        }
        Returns: undefined
      }
      update_seller_dispute_rate: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      update_seller_rankings: { Args: never; Returns: undefined }
      update_user_balance:
        | {
            Args: {
              _amount: number
              _balance_type: string
              _description: string
              _operation: string
              _source_id: string
              _source_type: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _amount: number
              _description: string
              _operation: string
              _source_id: string
              _source_type: string
              _user_id: string
            }
            Returns: undefined
          }
    }
    Enums: {
      analytics_event_type:
        | "BOOKING_PAGE_VIEW"
        | "MEETING_REQUEST_CREATED"
        | "MEETING_CONFIRMED"
        | "MEETING_PAID"
        | "MEETING_CANCELED"
        | "MEETING_COMPLETED"
        | "PRODUCT_VIEW"
        | "PRODUCT_PURCHASED"
      analytics_source: "public" | "internal"
      app_role: "admin" | "seller" | "buyer"
      invoice_status: "issued" | "paid" | "void" | "refunded"
      meeting_invite_status:
        | "invited"
        | "accepted"
        | "declined"
        | "joined"
        | "left"
      meeting_participant_role:
        | "seller_owner"
        | "seller_team"
        | "buyer_owner"
        | "buyer_team"
        | "guest"
      organization_role: "owner" | "admin" | "member"
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
      analytics_event_type: [
        "BOOKING_PAGE_VIEW",
        "MEETING_REQUEST_CREATED",
        "MEETING_CONFIRMED",
        "MEETING_PAID",
        "MEETING_CANCELED",
        "MEETING_COMPLETED",
        "PRODUCT_VIEW",
        "PRODUCT_PURCHASED",
      ],
      analytics_source: ["public", "internal"],
      app_role: ["admin", "seller", "buyer"],
      invoice_status: ["issued", "paid", "void", "refunded"],
      meeting_invite_status: [
        "invited",
        "accepted",
        "declined",
        "joined",
        "left",
      ],
      meeting_participant_role: [
        "seller_owner",
        "seller_team",
        "buyer_owner",
        "buyer_team",
        "guest",
      ],
      organization_role: ["owner", "admin", "member"],
    },
  },
} as const
