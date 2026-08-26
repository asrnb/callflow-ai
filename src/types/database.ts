export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      content_jobs: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          audience: string;
          tone: string;
          platform: string;
          status: Database["public"]["Enums"]["content_job_status"];
          attempts: number;
          max_attempts: number;
          model: string | null;
          error_message: string | null;
          last_error_at: string | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          duration_ms: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          audience: string;
          tone: string;
          platform: string;
          status?: Database["public"]["Enums"]["content_job_status"];
          attempts?: number;
          max_attempts?: number;
          model?: string | null;
          error_message?: string | null;
          last_error_at?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          duration_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic?: string;
          audience?: string;
          tone?: string;
          platform?: string;
          status?: Database["public"]["Enums"]["content_job_status"];
          attempts?: number;
          max_attempts?: number;
          model?: string | null;
          error_message?: string | null;
          last_error_at?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          duration_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generated_contents: {
        Row: {
          id: string;
          job_id: string;
          user_id: string;
          hook: string;
          body: string;
          alternative_hooks: string[];
          key_points: string[];
          cta: string;
          raw_response: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          user_id: string;
          hook: string;
          body: string;
          alternative_hooks: string[];
          key_points: string[];
          cta: string;
          raw_response: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          user_id?: string;
          hook?: string;
          body?: string;
          alternative_hooks?: string[];
          key_points?: string[];
          cta?: string;
          raw_response?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      job_execution_events: {
        Row: {
          id: string;
          job_id: string;
          user_id: string;
          event_type: string;
          message: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          user_id: string;
          event_type: string;
          message: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          user_id?: string;
          event_type?: string;
          message?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      content_job_status: "queued" | "processing" | "retrying" | "completed" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
