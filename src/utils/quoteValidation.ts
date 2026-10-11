/**
 * Quote Validation Utility
 *
 * Validates quote data before PDF generation to prevent crashes
 * caused by missing master data (company/customer information).
 *
 * Note: Unlike invoices, quotes do NOT require IBAN validation
 * as they don't include QR-Bill payment sections.
 */

import type { Quote, Customer, Company } from '../lib/supabase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that all required data for Quote PDF generation is present.
 *
 * Checks:
 * - Company information (name, address) - NO IBAN check
 * - Customer information (name, address)
 * - Quote items (at least one valid item)
 *
 * @param quote - The quote to validate
 * @param company - The company issuing the quote
 * @param customer - The customer receiving the quote
 * @returns Validation result with list of errors (if any)
 */
export function validateQuoteData(
  quote: Quote | { items?: Array<{ description?: string }> },
  company: Company,
  customer: Customer
): ValidationResult {
  const errors: string[] = [];

  // ============================================================================
  // Company Validation (NO IBAN required for quotes)
  // ============================================================================

  if (!company.name?.trim()) {
    errors.push('Firmenname fehlt in den Einstellungen.');
  }

  if (!company.street?.trim()) {
    errors.push('Strasse fehlt im Firmenprofil. Ergänze die Adresse unter Einstellungen › Unternehmen.');
  }

  if (!company.zip_code?.trim()) {
    errors.push('PLZ fehlt im Firmenprofil. Ergänze die Adresse unter Einstellungen › Unternehmen.');
  }

  if (!company.city?.trim()) {
    errors.push('Ort fehlt im Firmenprofil. Ergänze die Adresse unter Einstellungen › Unternehmen.');
  }

  // ============================================================================
  // Customer Validation
  // ============================================================================

  if (!customer.name?.trim()) {
    errors.push('Name der Firma fehlt.');
  }

  if (!customer.street?.trim()) {
    errors.push('Adresse der Firma unvollständig: Strasse fehlt.');
  }

  if (!customer.zip_code?.trim()) {
    errors.push('Adresse der Firma unvollständig: PLZ fehlt.');
  }

  if (!customer.city?.trim()) {
    errors.push('Adresse der Firma unvollständig: Ort fehlt.');
  }

  // ============================================================================
  // Quote Items Validation
  // ============================================================================

  const items = 'items' in quote ? quote.items : [];

  if (!items || items.length === 0) {
    errors.push('Die Offerte hat keine Positionen.');
  } else {
    // Check for empty descriptions
    const hasEmptyDescription = items.some(
      (item) => !item.description?.trim()
    );

    if (hasEmptyDescription) {
      errors.push('Mindestens eine Position hat keine Beschreibung.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Quick validation for company profile completeness for quotes.
 * Less strict than invoice validation (no IBAN required).
 *
 * @param company - The company to validate
 * @returns Validation result with list of missing fields
 */
export function validateCompanyProfileForQuote(company: Company): ValidationResult {
  const errors: string[] = [];

  if (!company.name?.trim()) {
    errors.push('Firmenname');
  }

  if (!company.street?.trim()) {
    errors.push('Strasse');
  }

  if (!company.zip_code?.trim()) {
    errors.push('PLZ');
  }

  if (!company.city?.trim()) {
    errors.push('Ort');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0
      ? [`Fehlende Pflichtfelder für die Offerte: ${errors.join(', ')}`]
      : [],
  };
}
