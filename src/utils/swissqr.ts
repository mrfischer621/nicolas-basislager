/**
 * Swiss QR-Bill Generator - SPS 2025 v2.3 Implementation
 *
 * This implementation uses Address Type 'S' (Structured) exclusively.
 *
 * Address Type 'S' (Structured) format:
 * - Name (max 70 chars)
 * - Street (max 70 chars) - mandatory
 * - House Number (max 16 chars) - optional
 * - Postal Code (max 16 chars) - mandatory
 * - City (max 35 chars) - mandatory
 * - Country (2 chars ISO code) - mandatory
 *
 * Security: All text is sanitized to Latin-1 subset allowed by SIX/SPS.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface QRAddress {
  name: string;
  street: string;           // Mandatory: Street name
  houseNumber?: string;     // Optional: Building number
  postalCode: string;       // Mandatory: ZIP/Postal code
  city: string;             // Mandatory: City name
  country: string;          // Mandatory: ISO country code (e.g., "CH")
}

export interface SwissQRBillData {
  creditor: {
    account: string;        // IBAN (21 chars for Swiss IBAN)
    address: QRAddress;
  };
  debtor?: {
    address: QRAddress;
  };
  amount?: number;
  currency?: string;        // CHF or EUR
  reference?: string;       // QR reference (27 digits) or SCOR reference (RF...)
  message?: string;         // Additional information (unstructured message)
}

type ReferenceType = 'QRR' | 'SCOR' | 'NON';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Latin-1 character set allowed by SIX/SPS (Swiss Payment Standards).
 * This is a subset of ISO-8859-1 that excludes certain control characters.
 *
 * Allowed ranges:
 * - 0x20-0x7E: Basic ASCII printable characters
 * - 0xA0-0xFF: Extended Latin-1 characters
 *
 * Explicitly excluded:
 * - 0x00-0x1F: Control characters (including line breaks)
 * - 0x7F-0x9F: Additional control characters
 */
const isAllowedLatinChar = (charCode: number): boolean => {
  return (charCode >= 0x20 && charCode <= 0x7E) || (charCode >= 0xA0 && charCode <= 0xFF);
};

/**
 * Clean and sanitize input string:
 * 1. Remove line breaks (\r\n, \n, \r)
 * 2. Replace non-Latin-1 characters with space
 * 3. Trim whitespace
 *
 * This prevents QR format corruption and ensures SPS compliance.
 */
function clean(input: string): string {
  if (!input) return '';

  // Step 1: Remove all line breaks
  let cleaned = input.replace(/[\r\n]/g, ' ');

  // Step 2: Replace non-Latin-1 characters with space
  cleaned = cleaned
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      return isAllowedLatinChar(code) ? char : ' ';
    })
    .join('');

  // Step 3: Collapse multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Truncate string to max length after cleaning
 */
function truncate(input: string, maxLength: number): string {
  const cleaned = clean(input);
  return cleaned.substring(0, maxLength);
}

// ============================================================================
// SWISS QR BILL CLASS
// ============================================================================

export class SwissQRBill {
  private data: SwissQRBillData;
  private referenceType: ReferenceType;

  constructor(data: SwissQRBillData) {
    this.data = {
      ...data,
      currency: data.currency || 'CHF',
    };

    // Determine reference type and validate
    this.referenceType = this.determineReferenceType();
    this.validate();
  }

  // ==========================================================================
  // VALIDATION METHODS
  // ==========================================================================

  /**
   * Validates Swiss IBAN format (21 characters)
   */
  private validateIBAN(iban: string): void {
    const cleanIban = iban.replace(/\s/g, '');

    if (!cleanIban.startsWith('CH')) {
      throw new Error('IBAN muss mit "CH" beginnen (Schweizer IBAN erforderlich)');
    }

    if (cleanIban.length !== 21) {
      throw new Error('Schweizer IBAN muss 21 Zeichen lang sein (ohne Leerzeichen)');
    }

    // IBAN check digit validation (mod 97)
    const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
    const numericIban = rearranged.replace(/[A-Z]/g, (char) =>
      (char.charCodeAt(0) - 55).toString()
    );

    let remainder = '';
    for (let i = 0; i < numericIban.length; i++) {
      remainder += numericIban[i];
      if (remainder.length > 9) {
        remainder = (parseInt(remainder) % 97).toString();
      }
    }

    if (parseInt(remainder) % 97 !== 1) {
      throw new Error('IBAN Prüfziffer ist ungültig');
    }
  }

  /**
   * Check if IBAN is a QR-IBAN (IID in range 30000-31999)
   */
  private isQRIBAN(iban: string): boolean {
    const cleanIban = iban.replace(/\s/g, '');
    const iid = parseInt(cleanIban.substring(4, 9));
    return iid >= 30000 && iid <= 31999;
  }

  /**
   * Validates QR reference (27 digits with mod 10 check digit)
   */
  private validateQRReference(reference: string): void {
    const cleanRef = reference.replace(/\s/g, '');

    if (cleanRef.length !== 27) {
      throw new Error('QR-Referenz muss genau 27 Ziffern haben');
    }

    if (!/^\d+$/.test(cleanRef)) {
      throw new Error('QR-Referenz darf nur Ziffern enthalten');
    }

    // Validate check digit (Modulo 10, recursive)
    const referenceWithoutCheck = cleanRef.slice(0, 26);
    const checkDigit = parseInt(cleanRef[26]);
    const calculatedCheck = this.calculateMod10CheckDigit(referenceWithoutCheck);

    if (checkDigit !== calculatedCheck) {
      throw new Error('QR-Referenz Prüfziffer ist ungültig');
    }
  }

  /**
   * Calculate Modulo 10 recursive check digit
   */
  private calculateMod10CheckDigit(reference: string): number {
    const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
    let carry = 0;

    for (let i = 0; i < reference.length; i++) {
      carry = table[(carry + parseInt(reference[i])) % 10];
    }

    return (10 - carry) % 10;
  }

  /**
   * Validates SCOR reference (ISO 11649 format: RF + 2 check digits + max 21 chars)
   */
  private validateSCORReference(reference: string): void {
    const cleanRef = reference.replace(/\s/g, '');

    if (!cleanRef.startsWith('RF')) {
      throw new Error('SCOR-Referenz muss mit "RF" beginnen');
    }

    if (cleanRef.length < 5 || cleanRef.length > 25) {
      throw new Error('SCOR-Referenz muss zwischen 5 und 25 Zeichen lang sein');
    }

    // Validate check digits (mod 97)
    const rearranged = cleanRef.slice(4) + cleanRef.slice(0, 4);
    const numericRef = rearranged.replace(/[A-Z]/g, (char) =>
      (char.charCodeAt(0) - 55).toString()
    );

    let remainder = '';
    for (let i = 0; i < numericRef.length; i++) {
      remainder += numericRef[i];
      if (remainder.length > 9) {
        remainder = (parseInt(remainder) % 97).toString();
      }
    }

    if (parseInt(remainder) % 97 !== 1) {
      throw new Error('SCOR-Referenz Prüfziffer ist ungültig');
    }
  }

  /**
   * Determine reference type based on IBAN and reference format.
   *
   * CRITICAL VALIDATION RULES (SPS 2025 v2.3):
   * - QR-IBAN MUST be used WITH QRR reference
   * - QR-IBAN MUST NOT be used without QRR reference
   * - Normal IBAN MUST NOT be used WITH QRR reference
   * - Normal IBAN can be used with SCOR or no reference
   */
  private determineReferenceType(): ReferenceType {
    const { account } = this.data.creditor;
    const { reference } = this.data;
    const isQR = this.isQRIBAN(account);

    // No reference provided
    if (!reference) {
      if (isQR) {
        throw new Error(
          'QR-IBAN erfordert eine QR-Referenz (27 Ziffern). ' +
          'Verwenden Sie eine normale IBAN wenn Sie keine Referenz benötigen.'
        );
      }
      return 'NON';
    }

    const cleanRef = reference.replace(/\s/g, '');

    // Check if it's a QR reference (27 digits)
    if (/^\d{27}$/.test(cleanRef)) {
      if (!isQR) {
        throw new Error(
          'QR-Referenz (27 Ziffern) kann nur mit QR-IBAN verwendet werden. ' +
          'Verwenden Sie eine SCOR-Referenz (RF...) oder entfernen Sie die Referenz.'
        );
      }
      return 'QRR';
    }

    // Check if it's a SCOR reference (starts with RF)
    if (cleanRef.startsWith('RF')) {
      if (isQR) {
        throw new Error(
          'SCOR-Referenz (RF...) kann nicht mit QR-IBAN verwendet werden. ' +
          'Verwenden Sie eine QR-Referenz (27 Ziffern) oder eine normale IBAN.'
        );
      }
      return 'SCOR';
    }

    // Invalid reference format
    throw new Error(
      'Referenz muss entweder QR-Referenz (27 Ziffern) oder SCOR-Referenz (RF...) sein'
    );
  }

  /**
   * Validate address fields for Address Type 'S' (Structured)
   */
  private validateAddress(address: QRAddress, label: string): void {
    // Name is mandatory
    if (!address.name || address.name.trim().length === 0) {
      throw new Error(`${label}: Name ist erforderlich`);
    }
    if (clean(address.name).length > 70) {
      throw new Error(`${label}: Name darf max. 70 Zeichen lang sein`);
    }

    // Street is mandatory for Address Type 'S'
    if (!address.street || address.street.trim().length === 0) {
      throw new Error(`${label}: Strasse ist erforderlich`);
    }
    if (clean(address.street).length > 70) {
      throw new Error(`${label}: Strasse darf max. 70 Zeichen lang sein`);
    }

    // House number is optional but has length limit
    if (address.houseNumber && clean(address.houseNumber).length > 16) {
      throw new Error(`${label}: Hausnummer darf max. 16 Zeichen lang sein`);
    }

    // Postal code is mandatory
    if (!address.postalCode || address.postalCode.trim().length === 0) {
      throw new Error(`${label}: Postleitzahl ist erforderlich`);
    }
    if (clean(address.postalCode).length > 16) {
      throw new Error(`${label}: Postleitzahl darf max. 16 Zeichen lang sein`);
    }

    // City is mandatory
    if (!address.city || address.city.trim().length === 0) {
      throw new Error(`${label}: Ort ist erforderlich`);
    }
    if (clean(address.city).length > 35) {
      throw new Error(`${label}: Ort darf max. 35 Zeichen lang sein`);
    }

    // Country is mandatory and must be 2-char ISO code
    if (!address.country || address.country.length !== 2) {
      throw new Error(`${label}: Ländercode muss ein 2-Zeichen ISO-Code sein (z.B. "CH")`);
    }
  }

  /**
   * Validate all data
   */
  private validate(): void {
    const { creditor, debtor, amount, currency, reference } = this.data;

    // Validate creditor
    if (!creditor.account) {
      throw new Error('Creditor IBAN ist erforderlich');
    }
    this.validateIBAN(creditor.account);
    this.validateAddress(creditor.address, 'Creditor');

    // Validate amount (optional, but if provided must be valid)
    if (amount !== undefined) {
      if (amount < 0.01 || amount > 999999999.99) {
        throw new Error('Betrag muss zwischen 0.01 und 999\'999\'999.99 sein');
      }
    }

    // Validate currency
    if (currency !== 'CHF' && currency !== 'EUR') {
      throw new Error('Währung muss CHF oder EUR sein');
    }

    // Validate reference based on type
    if (reference) {
      if (this.referenceType === 'QRR') {
        this.validateQRReference(reference);
      } else if (this.referenceType === 'SCOR') {
        this.validateSCORReference(reference);
      }
    }

    // Validate debtor if provided
    if (debtor && debtor.address) {
      this.validateAddress(debtor.address, 'Debtor');
    }

    // Validate message length
    if (this.data.message && clean(this.data.message).length > 140) {
      throw new Error('Nachricht darf max. 140 Zeichen lang sein');
    }
  }

  // ==========================================================================
  // QR CODE GENERATION
  // ==========================================================================

  /**
   * Generate the Swiss Payment Code (SPC) string.
   * Returns 31 elements separated by \r\n, ending with EPD (no trailing line break).
   *
   * Format according to Swiss Payment Standards 2025 v2.3
   * Using Address Type 'S' (Structured) exclusively.
   */
  public toString(): string {
    const { creditor, debtor, amount, currency, reference, message } = this.data;

    // Clean IBAN (remove spaces)
    const cleanIban = creditor.account.replace(/\s/g, '');

    // Build SPC data array (must be exactly 31 lines)
    const lines: string[] = [
      'SPC',                                                    // 1. QRType
      '0200',                                                   // 2. Version (v2.0)
      '1',                                                      // 3. Coding (1 = UTF-8)
      cleanIban,                                                // 4. IBAN
      'S',                                                      // 5. Creditor Address Type (S = Structured)
      truncate(creditor.address.name, 70),                     // 6. Creditor Name
      truncate(creditor.address.street, 70),                   // 7. Creditor Street
      truncate(creditor.address.houseNumber || '', 16),        // 8. Creditor House Number
      truncate(creditor.address.postalCode, 16),               // 9. Creditor Postal Code
      truncate(creditor.address.city, 35),                     // 10. Creditor City
      creditor.address.country.toUpperCase(),                  // 11. Creditor Country
      '',                                                       // 12. Ultimate Creditor Address Type (empty)
      '',                                                       // 13. Ultimate Creditor Name (empty)
      '',                                                       // 14. Ultimate Creditor Street (empty)
      '',                                                       // 15. Ultimate Creditor House Number (empty)
      '',                                                       // 16. Ultimate Creditor Postal Code (empty)
      '',                                                       // 17. Ultimate Creditor City (empty)
      '',                                                       // 18. Ultimate Creditor Country (empty)
      amount ? amount.toFixed(2) : '',                         // 19. Amount (empty if not specified)
      currency || 'CHF',                                        // 20. Currency
    ];

    // Zahlungspflichtiger (optionale Datengruppe). Ohne Zahlungspflichtigen
    // bleibt auch der Adress-Typ leer (IG 2.3: Status «D»).
    if (debtor && debtor.address && debtor.address.name) {
      lines.push(
        'S',                                                    // 21. Debtor Address Type (S = Structured)
        truncate(debtor.address.name, 70),                     // 22. Debtor Name
        truncate(debtor.address.street, 70),                   // 23. Debtor Street
        truncate(debtor.address.houseNumber || '', 16),        // 24. Debtor House Number
        truncate(debtor.address.postalCode, 16),               // 25. Debtor Postal Code
        truncate(debtor.address.city, 35),                     // 26. Debtor City
        debtor.address.country.toUpperCase()                   // 27. Debtor Country
      );
    } else {
      lines.push('', '', '', '', '', '', '');                  // 21.-27. leer
    }

    // Add reference
    lines.push(this.referenceType);                            // 28. Reference Type (QRR, SCOR, NON)
    lines.push(reference ? reference.replace(/\s/g, '') : ''); // 29. Reference

    // Add additional information
    lines.push(message ? truncate(message, 140) : '');         // 30. Unstructured Message
    lines.push('EPD');                                          // 31. Trailer (End Payment Data)

    // Rechnungsinformationen und alternative Verfahren (Status «A») werden
    // nicht verwendet und deshalb weggelassen. Nach dem letzten Element folgt
    // keine Zeilenschaltung (IG 2.3, Kap. 4.1.4).
    if (lines.length !== 31) {
      console.warn(`SPC sollte 31 Elemente haben, hat aber ${lines.length}`);
    }

    // Join with \r\n as specified in SPS 2025
    return lines.join('\r\n');
  }

  /**
   * Get the reference type (QRR, SCOR, or NON)
   */
  public getReferenceType(): ReferenceType {
    return this.referenceType;
  }

  // ==========================================================================
  // STATIC HELPER METHODS
  // ==========================================================================

  /**
   * Generate QR reference with check digit (27 digits total).
   * Uses Modulo 10 recursive algorithm.
   *
   * @param input - Any string containing digits (e.g., invoice number)
   * @returns 27-digit QR reference with check digit
   */
  public static generateQRReference(input: string): string {
    // Extract only digits from input
    const digits = input.replace(/\D/g, '');

    // Pad to 26 digits
    const paddedRef = digits.padStart(26, '0');

    // Calculate check digit using Modulo 10 recursive algorithm
    const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
    let carry = 0;

    for (let i = 0; i < paddedRef.length; i++) {
      carry = table[(carry + parseInt(paddedRef[i])) % 10];
    }

    const checkDigit = ((10 - carry) % 10).toString();
    return paddedRef + checkDigit;
  }

  /**
   * Format IBAN with spaces (every 4 characters).
   * Example: CH9300762011623852957 → CH93 0076 2011 6238 5295 7
   *
   * @param iban - IBAN without spaces
   * @returns Formatted IBAN with spaces
   */
  public static formatIBAN(iban: string): string {
    const cleanIban = iban.replace(/\s/g, '');
    return cleanIban.replace(/(.{4})/g, '$1 ').trim();
  }

  /**
   * Check if IBAN is a QR-IBAN (IID in range 30000-31999).
   * QR-IBANs require QR references (27 digits).
   * Normal IBANs cannot use QR references.
   *
   * @param iban - IBAN to check (with or without spaces)
   * @returns true if QR-IBAN, false otherwise
   */
  public static isQRIBAN(iban: string): boolean {
    const cleanIban = iban.replace(/\s/g, '');
    if (cleanIban.length !== 21 || !cleanIban.startsWith('CH')) {
      return false;
    }
    const iid = parseInt(cleanIban.substring(4, 9));
    return iid >= 30000 && iid <= 31999;
  }
}
