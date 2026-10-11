import type { QuoteStatus } from '../lib/supabase';

/**
 * Checks whether a quote can be edited based on its status.
 * Only confirmed quotes ('bestaetigt') cannot be edited because they have
 * already been converted to an invoice.
 *
 * @param status - The quote status to check
 * @returns true if the quote can be edited, false otherwise
 */
export function canEditQuote(status: QuoteStatus): boolean {
  return status !== 'bestaetigt';
}

/**
 * Checks whether a warning should be shown when editing a quote.
 * A warning is appropriate when the quote has already been sent to the customer
 * or has been accepted/rejected.
 *
 * @param status - The quote status to check
 * @returns true if a warning should be displayed, false otherwise
 */
export function shouldWarnOnEdit(status: QuoteStatus): boolean {
  return status === 'versendet' || status === 'akzeptiert' || status === 'abgelehnt' || status === 'ueberfallig';
}

/**
 * Gets a user-friendly message for why a quote cannot be edited.
 *
 * @param status - The quote status
 * @returns A German message explaining why editing is not allowed
 */
export function getEditBlockedReason(status: QuoteStatus): string {
  if (status === 'bestaetigt') {
    return 'Umgewandelte Offerten lassen sich nicht mehr bearbeiten (Rechnung erstellt).';
  }
  return '';
}

/**
 * Gets a warning message for editing a quote that's already with the customer.
 *
 * @param status - The quote status
 * @returns A German warning message, or empty string if no warning needed
 */
export function getEditWarningMessage(status: QuoteStatus): string {
  if (status === 'versendet') {
    return 'Diese Offerte ist bereits versendet.';
  }
  if (status === 'akzeptiert') {
    return 'Diese Offerte ist bereits akzeptiert.';
  }
  if (status === 'abgelehnt') {
    return 'Diese Offerte wurde abgelehnt.';
  }
  if (status === 'ueberfallig') {
    return 'Diese Offerte ist abgelaufen.';
  }
  return '';
}
