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
      access_requests: {
        Row: {
          id: string
          email: string
          display_name: string
          requested_role: 'owner' | 'cast' | 'driver'
          status: string
          requested_at: string
          approved_by: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          email: string
          display_name: string
          requested_role?: 'owner' | 'cast' | 'driver'
          status?: string
          requested_at?: string
          approved_by?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          requested_role?: 'owner' | 'cast' | 'driver'
          status?: string
          requested_at?: string
          approved_by?: string | null
          approved_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          email: string
          display_name: string
          role: 'owner' | 'cast' | 'driver'
          created_at: string
        }
        Insert: {
          email: string
          display_name: string
          role?: 'owner' | 'cast' | 'driver'
          created_at?: string
        }
        Update: {
          email?: string
          display_name?: string
          role?: 'owner' | 'cast' | 'driver'
          created_at?: string
        }
        Relationships: []
      }
      register_sessions: {
        Row: {
          id: string
          biz_date: string
          status: string
          open_photo_url: string | null
          close_photo_url: string | null
          close_amount: number | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          biz_date: string
          status: string
          open_photo_url?: string | null
          close_photo_url?: string | null
          close_amount?: number | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          biz_date?: string
          status?: string
          open_photo_url?: string | null
          close_photo_url?: string | null
          close_amount?: number | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          biz_date: string
          payment_method: string
          amount: number
          memo: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          biz_date: string
          payment_method: string
          amount: number
          memo?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          biz_date?: string
          payment_method?: string
          amount?: number
          memo?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      attendances: {
        Row: {
          id: string
          user_id: string
          start_time: string
          end_time: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_time: string
          end_time?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_time?: string
          end_time?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: 'owner' | 'cast' | 'driver'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type AppRole = Database['public']['Enums']['app_role']
export type AccessRequest = Database['public']['Tables']['access_requests']['Row']
export type UserRole = Database['public']['Tables']['user_roles']['Row']
export type RegisterSession = Database['public']['Tables']['register_sessions']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Attendance = Database['public']['Tables']['attendances']['Row']