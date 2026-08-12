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
      categories: {
        Row: {
          color: string | null
          company_id: string
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_tax_relevant: boolean | null
          name: string
          sort_order: number | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_tax_relevant?: boolean | null
          name: string
          sort_order?: number | null
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_tax_relevant?: boolean | null
          name?: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line1: string | null
          alternativ_name: string | null
          bank_name: string | null
          city: string | null
          country: string | null
          created_at: string
          default_vat_rate: number
          email: string | null
          house_number: string | null
          iban: string | null
          id: string
          invoice_footer_text: string | null
          invoice_intro_text: string | null
          logo_url: string | null
          name: string
          phone: string | null
          product_categories: Json | null
          qr_creditor_name: string | null
          qr_iban: string | null
          quote_footer_text: string | null
          quote_intro_text: string | null
          rechnungsname: string | null
          sender_contact_name: string | null
          street: string | null
          uid_number: string | null
          updated_at: string | null
          vat_enabled: boolean
          vat_number: string | null
          vat_registered: boolean | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          alternativ_name?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_vat_rate?: number
          email?: string | null
          house_number?: string | null
          iban?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_intro_text?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          product_categories?: Json | null
          qr_creditor_name?: string | null
          qr_iban?: string | null
          quote_footer_text?: string | null
          quote_intro_text?: string | null
          rechnungsname?: string | null
          sender_contact_name?: string | null
          street?: string | null
          uid_number?: string | null
          updated_at?: string | null
          vat_enabled?: boolean
          vat_number?: string | null
          vat_registered?: boolean | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          alternativ_name?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_vat_rate?: number
          email?: string | null
          house_number?: string | null
          iban?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_intro_text?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          product_categories?: Json | null
          qr_creditor_name?: string | null
          qr_iban?: string | null
          quote_footer_text?: string | null
          quote_intro_text?: string | null
          rechnungsname?: string | null
          sender_contact_name?: string | null
          street?: string | null
          uid_number?: string | null
          updated_at?: string | null
          vat_enabled?: boolean
          vat_number?: string | null
          vat_registered?: boolean | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          created_at: string | null
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          alternate_billing_address: string | null
          city: string | null
          co: string | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string | null
          department: string | null
          email: string | null
          hourly_rate: number | null
          house_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          street: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          alternate_billing_address?: string | null
          city?: string | null
          co?: string | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          hourly_rate?: number | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          street?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          alternate_billing_address?: string | null
          city?: string | null
          co?: string | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          hourly_rate?: number | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          street?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          company_id: string
          created_at: string | null
          date: string
          description: string
          id: string
        }
        Insert: {
          amount: number
          category?: string | null
          company_id: string
          created_at?: string | null
          date: string
          description: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          discount_percent: number | null
          id: string
          invoice_id: string
          quantity: number
          total: number
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          description: string
          discount_percent?: number | null
          id?: string
          invoice_id: string
          quantity?: number
          total: number
          unit_price: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          description?: string
          discount_percent?: number | null
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          footer_text: string | null
          id: string
          introduction_text: string | null
          invoice_number: string
          issue_date: string
          paid_at: string | null
          project_id: string | null
          status: string | null
          subtotal: number
          title: string | null
          total: number
          total_discount_percent: number | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_id: string
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          footer_text?: string | null
          id?: string
          introduction_text?: string | null
          invoice_number: string
          issue_date: string
          paid_at?: string | null
          project_id?: string | null
          status?: string | null
          subtotal: number
          title?: string | null
          total: number
          total_discount_percent?: number | null
          vat_amount: number
          vat_rate?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          footer_text?: string | null
          id?: string
          introduction_text?: string | null
          invoice_number?: string
          issue_date?: string
          paid_at?: string | null
          project_id?: string | null
          status?: string | null
          subtotal?: number
          title?: string | null
          total?: number
          total_discount_percent?: number | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          company_id: string
          created_at: string
          existing_customer_id: string | null
          expected_value: number | null
          id: string
          is_lost: boolean
          last_contact_at: string
          next_action_date: string | null
          notes: string | null
          prospect_info: Json | null
          stage_id: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          existing_customer_id?: string | null
          expected_value?: number | null
          id?: string
          is_lost?: boolean
          last_contact_at?: string
          next_action_date?: string | null
          notes?: string | null
          prospect_info?: Json | null
          stage_id: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          existing_customer_id?: string | null
          expected_value?: number | null
          id?: string
          is_lost?: boolean
          last_contact_at?: string
          next_action_date?: string | null
          notes?: string | null
          prospect_info?: Json | null
          stage_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          unit: string
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          unit: string
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          unit?: string
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          last_active_company_id: string | null
          logo_url: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_active_company_id?: string | null
          logo_url?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_company_id?: string | null
          logo_url?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_last_active_company_id_fkey"
            columns: ["last_active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          company_id: string
          created_at: string | null
          customer_id: string
          description: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          name: string
          status: string | null
        }
        Insert: {
          budget?: number | null
          company_id: string
          created_at?: string | null
          customer_id: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name: string
          status?: string | null
        }
        Update: {
          budget?: number | null
          company_id?: string
          created_at?: string | null
          customer_id?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          id: string
          quantity: number | null
          quote_id: string
          sort_order: number | null
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          quantity?: number | null
          quote_id: string
          sort_order?: number | null
          total: number
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          quantity?: number | null
          quote_id?: string
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string
          converted_at: string | null
          converted_to_invoice_id: string | null
          created_at: string | null
          customer_id: string
          discount_type: string | null
          discount_value: number | null
          id: string
          intro_text: string | null
          issue_date: string
          opportunity_id: string | null
          outro_text: string | null
          project_id: string | null
          quote_number: string
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
          valid_until: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          company_id: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string | null
          customer_id: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          intro_text?: string | null
          issue_date: string
          opportunity_id?: string | null
          outro_text?: string | null
          project_id?: string | null
          quote_number: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          valid_until: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          company_id?: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string | null
          customer_id?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          intro_text?: string | null
          issue_date?: string
          opportunity_id?: string | null
          outro_text?: string | null
          project_id?: string | null
          quote_number?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          valid_until?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          company_id: string
          created_at: string | null
          date: string
          description: string | null
          hours: number
          id: string
          invoice_id: string | null
          invoiced: boolean | null
          manual_status: string | null
          project_id: string
          rate: number
          snapshot_source: string
        }
        Insert: {
          billable?: boolean
          company_id: string
          created_at?: string | null
          date: string
          description?: string | null
          hours: number
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          manual_status?: string | null
          project_id: string
          rate?: number
          snapshot_source: string
        }
        Update: {
          billable?: boolean
          company_id?: string
          created_at?: string | null
          date?: string
          description?: string | null
          hours?: number
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          manual_status?: string | null
          project_id?: string
          rate?: number
          snapshot_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          billable: boolean | null
          category: string | null
          company_id: string
          created_at: string | null
          customer_id: string | null
          date: string
          description: string | null
          document_url: string | null
          id: string
          invoice_id: string | null
          project_id: string | null
          receipt_url: string | null
          tags: string[] | null
          transaction_number: string | null
          type: string
        }
        Insert: {
          amount: number
          billable?: boolean | null
          category?: string | null
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          date: string
          description?: string | null
          document_url?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          receipt_url?: string | null
          tags?: string[] | null
          transaction_number?: string | null
          type: string
        }
        Update: {
          amount?: number
          billable?: boolean | null
          category?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          date?: string
          description?: string | null
          document_url?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          receipt_url?: string | null
          tags?: string[] | null
          transaction_number?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      year_end_closings: {
        Row: {
          company_id: string
          created_at: string
          data: Json
          final_profit: number | null
          id: string
          locked_at: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          data?: Json
          final_profit?: number | null
          id?: string
          locked_at?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          data?: Json
          final_profit?: number | null
          id?: string
          locked_at?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "year_end_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_time_entries_with_status: {
        Row: {
          billable: boolean | null
          company_id: string | null
          created_at: string | null
          date: string | null
          derived_status: string | null
          description: string | null
          hours: number | null
          id: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: string | null
          invoiced: boolean | null
          is_manual_status: boolean | null
          manual_status: string | null
          project_id: string | null
          rate: number | null
          snapshot_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      convert_prospect_to_customer: {
        Args: { opportunity_id_param: string }
        Returns: string
      }
      create_company_with_admin: {
        Args: {
          p_city: string
          p_house_number: string
          p_name: string
          p_street: string
          p_zip_code: string
        }
        Returns: {
          bank_name: string
          city: string
          created_at: string
          house_number: string
          iban: string
          id: string
          logo_url: string
          name: string
          qr_iban: string
          street: string
          uid_number: string
          vat_number: string
          vat_registered: boolean
          zip_code: string
        }[]
      }
      generate_transaction_number: {
        Args: { p_company_id: string; p_type: string }
        Returns: string
      }
      get_project_open_hours: {
        Args: { p_project_id: string }
        Returns: number
      }
      get_user_companies: {
        Args: never
        Returns: {
          alternativ_name: string
          bank_name: string
          city: string
          company_id: string
          company_name: string
          country: string
          created_at: string
          default_vat_rate: number
          email: string
          house_number: string
          iban: string
          invoice_footer_text: string
          invoice_intro_text: string
          is_active: boolean
          logo_url: string
          phone: string
          product_categories: Json
          qr_creditor_name: string
          qr_iban: string
          quote_footer_text: string
          quote_intro_text: string
          rechnungsname: string
          role: string
          sender_contact_name: string
          street: string
          uid_number: string
          vat_enabled: boolean
          vat_number: string
          vat_registered: boolean
          website: string
          zip_code: string
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      resolve_hourly_rate: {
        Args: { p_default_rate?: number; p_project_id: string }
        Returns: {
          rate: number
          source: string
        }[]
      }
      set_active_company: { Args: { company_id: string }; Returns: undefined }
    }
    Enums: {
      category_type: "income" | "expense"
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
      category_type: ["income", "expense"],
    },
  },
} as const
