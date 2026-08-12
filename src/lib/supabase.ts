import { createClient } from '@supabase/supabase-js';

// User Profile (linked to auth.users)
export interface Profile {
  id: string; // auth.users.id
  email: string;
  full_name: string | null;
  last_active_company_id: string | null; // Last selected company
  created_at: string;
  updated_at: string;
  // Per-user logo/avatar (migration: 20260223_quotes_intro_outro.sql)
  logo_url?: string | null;
}

// User-Company Junction (many-to-many relationship)
export interface UserCompany {
  id: string;
  user_id: string; // auth.users.id
  company_id: string; // companies.id
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  alternativ_name: string | null; // Alternative company name / "Doing Business As"
  rechnungsname: string | null; // Display name for invoices and quotes
  logo_url: string | null;
  street: string | null;
  house_number: string | null;
  zip_code: string | null;
  city: string | null;
  iban: string | null;
  qr_iban: string | null;
  qr_creditor_name: string | null; // Personal name for QR-Bill creditor (e.g., "Nicolas Fischer")
  uid_number: string | null;
  bank_name: string | null;
  vat_number: string | null;
  vat_registered: boolean;
  vat_enabled: boolean; // VAT calculation enabled for invoices
  default_vat_rate: number; // Default VAT rate (e.g., 8.1 for Swiss standard rate)
  sender_contact_name: string | null; // Optional contact/owner name for invoice sender (Phase 3.3)
  product_categories: string[]; // Array of product category names (Phase 3.2)
  created_at: string;
  // Text templates for invoices and quotes
  invoice_intro_text: string | null;
  invoice_footer_text: string | null;
  quote_intro_text: string | null;
  quote_footer_text: string | null;
  // Contact fields (migration: 20260223_company_contact_fields.sql)
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  updated_at?: string;
}

export interface Customer {
  id: string;
  company_id: string;
  // Tab: General
  name: string;
  contact_person: string | null;
  email: string | null;
  hourly_rate: number | null;
  // Tab: Address (structured for Swiss QR-Bills)
  street: string | null;
  house_number: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  alternate_billing_address: string | null;
  // Tab: More
  co: string | null;
  department: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  customer_id: string;
  name: string;
  description: string | null;
  status: 'offen' | 'laufend' | 'abgeschlossen';
  budget: number | null;
  hourly_rate: number | null; // Project-specific rate override (Phase 4.3)
  is_active: boolean;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  company_id: string;
  project_id: string;
  date: string;
  hours: number;
  rate: number;
  snapshot_source: 'project' | 'customer' | 'default' | 'manual'; // Rate source (Phase 4.3)
  description: string | null;
  /** @deprecated Use invoice_id !== null instead */
  invoiced: boolean;
  billable: boolean; // true = verrechenbar
  invoice_id: string | null; // Reference to invoice if already invoiced
  /** Manuelle Übersteuerung des Status. null = automatisch aus invoice_id ableiten */
  manual_status: ManualTimeEntryStatus | null;
  created_at: string;
}

// Manueller Status-Override (siehe 20260812_time_entries_manual_status.sql)
export type ManualTimeEntryStatus = 'offen' | 'verrechnet';

// Extended TimeEntry with dynamic status from view_time_entries_with_status
export interface TimeEntryWithStatus extends TimeEntry {
  derived_status: 'offen' | 'verrechnet' | 'entwurf' | 'versendet' | 'bezahlt' | 'überfällig';
  /** true, wenn derived_status aus manual_status stammt */
  is_manual_status: boolean;
  invoice_number: string | null;
  invoice_status: 'entwurf' | 'versendet' | 'bezahlt' | 'überfällig' | null;
  invoice_date: string | null;
}

export interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_id: string;
  project_id: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: 'entwurf' | 'versendet' | 'bezahlt' | 'überfällig';
  paid_at: string | null;
  created_at: string;
  // Additional fields for customization
  title: string | null;
  introduction_text: string | null;
  footer_text: string | null;
  total_discount_percent: number; // Legacy field (kept for backward compatibility)
  // Discount system (Task 3.2)
  discount_type: 'percent' | 'fixed';
  discount_value: number;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  discount_percent: number;
  vat_rate: number; // VAT rate snapshot at invoice creation time
  vat_amount: number; // Calculated VAT amount for this line item
}

// Quote (Offerte/Angebot) Types
export type QuoteStatus = 'offen' | 'versendet' | 'akzeptiert' | 'abgelehnt' | 'bestaetigt' | 'ueberfallig';

export interface Quote {
  id: string;
  company_id: string;
  quote_number: string;
  customer_id: string;
  project_id: string | null;
  opportunity_id: string | null;
  issue_date: string;
  valid_until: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: QuoteStatus;
  converted_to_invoice_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  // Discount system (Task 3.2)
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  // Per-quote text overrides (migration: 20260223_quotes_intro_outro.sql)
  intro_text?: string | null;
  outro_text?: string | null;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface Transaction {
  id: string;
  company_id: string;
  type: 'einnahme' | 'ausgabe';
  date: string;
  amount: number;
  description: string | null;
  category: string | null;
  project_id: string | null;
  customer_id: string | null;
  invoice_id: string | null;
  document_url: string | null;
  receipt_url: string | null;
  tags: string[] | null;
  billable: boolean;
  transaction_number: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  price: number;
  unit: string;
  description: string | null;
  category: string | null; // Product category for grouping (Task 4.2)
  vat_rate: number | null; // Product-specific VAT rate (null = use company default)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Expense Account Types (Kontenplan) - Legacy, use Category instead
export interface ExpenseAccount {
  id: string;
  company_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Category Types (Buchungskategorien - Milchbüechli)
export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  company_id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string;
  is_tax_relevant: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Transaction Attachment Types (Belege)
export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  file_name: string;
  file_type: string; // application/pdf, image/jpeg, image/png
  file_size: number | null;
  file_url: string;
  uploaded_at: string;
}

// Year-End Closing Types
export interface Asset {
  name: string;
  value: number;
  depreciation_rate: number;
  amount: number;
}

export interface PrivateShare {
  category: string;
  percentage: number;
  amount: number;
}

export interface YearEndClosingData {
  assets: Asset[];
  private_shares: PrivateShare[];
  social_security_provision: number;
}

export interface YearEndClosing {
  id: string;
  company_id: string;
  year: number;
  status: 'draft' | 'locked';
  data: YearEndClosingData;
  final_profit: number;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

// Sales Pipeline Types
export interface ProspectInfo {
  name?: string;
  company?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
}

export interface PipelineStage {
  id: string;
  company_id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  company_id: string;
  existing_customer_id: string | null;
  prospect_info: ProspectInfo | null;
  title: string;
  stage_id: string;
  expected_value: number | null;
  last_contact_at: string;
  next_action_date: string | null;
  notes: string | null;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      user_companies: {
        Row: UserCompany;
        Insert: Omit<UserCompany, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserCompany, 'id' | 'created_at' | 'updated_at'>>;
      };
      companies: {
        Row: Company;
        Insert: Omit<Company, 'id' | 'created_at'>;
        Update: Partial<Omit<Company, 'id' | 'created_at'>>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at'>;
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at'>;
        Update: Partial<Omit<Project, 'id' | 'created_at'>>;
      };
      time_entries: {
        Row: TimeEntry;
        Insert: Omit<TimeEntry, 'id' | 'created_at'>;
        Update: Partial<Omit<TimeEntry, 'id' | 'created_at'>>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, 'id' | 'created_at'>;
        Update: Partial<Omit<Invoice, 'id' | 'created_at'>>;
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Omit<InvoiceItem, 'id'>;
        Update: Partial<Omit<InvoiceItem, 'id'>>;
      };
      quotes: {
        Row: Quote;
        Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Quote, 'id' | 'created_at' | 'updated_at'>>;
      };
      quote_items: {
        Row: QuoteItem;
        Insert: Omit<QuoteItem, 'id'>;
        Update: Partial<Omit<QuoteItem, 'id'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at'>;
        Update: Partial<Omit<Transaction, 'id' | 'created_at'>>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, 'id' | 'created_at'>;
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      year_end_closings: {
        Row: YearEndClosing;
        Insert: Omit<YearEndClosing, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<YearEndClosing, 'id' | 'created_at' | 'updated_at'>>;
      };
      pipeline_stages: {
        Row: PipelineStage;
        Insert: Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>>;
      };
      opportunities: {
        Row: Opportunity;
        Insert: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>>;
      };
      expense_accounts: {
        Row: ExpenseAccount;
        Insert: Omit<ExpenseAccount, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ExpenseAccount, 'id' | 'created_at' | 'updated_at'>>;
      };
      transaction_attachments: {
        Row: TransactionAttachment;
        Insert: Omit<TransactionAttachment, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<TransactionAttachment, 'id' | 'uploaded_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create client without strict typing to avoid TypeScript issues with Supabase generics
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
