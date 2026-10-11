import type { Invoice } from '../lib/supabase';

/**
 * Invoice status type (extracted for reuse)
 */
export type InvoiceStatus = Invoice['status'];

/**
 * Checks whether an invoice can be edited based on its status.
 * Only paid invoices ('bezahlt') cannot be edited due to accounting relevance.
 *
 * @param status - The invoice status to check
 * @returns true if the invoice can be edited, false otherwise
 */
export function canEditInvoice(status: InvoiceStatus): boolean {
  return status !== 'bezahlt';
}

/**
 * Checks whether a warning should be shown when editing an invoice.
 * A warning is appropriate when the invoice has already been sent to the customer.
 *
 * @param status - The invoice status to check
 * @returns true if a warning should be displayed, false otherwise
 */
export function shouldWarnOnEdit(status: InvoiceStatus): boolean {
  return status === 'versendet' || status === 'überfällig';
}

/**
 * Gets a user-friendly message for why an invoice cannot be edited.
 *
 * @param status - The invoice status
 * @returns A German message explaining why editing is not allowed
 */
export function getEditBlockedReason(status: InvoiceStatus): string {
  if (status === 'bezahlt') {
    return 'Bezahlte Rechnungen können nicht mehr bearbeitet werden.';
  }
  return '';
}

/**
 * Gets a warning message for editing an invoice that's already with the customer.
 *
 * @param status - The invoice status
 * @returns A German warning message, or empty string if no warning needed
 */
export function getEditWarningMessage(status: InvoiceStatus): string {
  if (status === 'versendet') {
    return 'Diese Rechnung ist bereits versendet.';
  }
  if (status === 'überfällig') {
    return 'Diese Rechnung ist bereits versendet und überfällig.';
  }
  return '';
}
