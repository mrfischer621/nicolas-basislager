import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
import { logoPath, validateLogoFile } from './logoUpload';

describe('validateLogoFile', () => {
  it('akzeptiert PNG, JPG und SVG bis 2 MB', () => {
    expect(validateLogoFile({ name: 'a.png', type: 'image/png', size: 1000 })).toBeNull();
    expect(validateLogoFile({ name: 'a.jpg', type: 'image/jpeg', size: 2 * 1024 * 1024 })).toBeNull();
    expect(validateLogoFile({ name: 'a.svg', type: 'image/svg+xml', size: 500 })).toBeNull();
    expect(validateLogoFile({ name: 'a.svg', type: '', size: 500 })).toBeNull();
  });

  it('lehnt andere Formate und zu grosse Dateien ab', () => {
    expect(validateLogoFile({ name: 'a.gif', type: 'image/gif', size: 10 })).toMatch(/PNG, JPG oder SVG/);
    expect(validateLogoFile({ name: 'a.png', type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
  });
});

describe('logoPath', () => {
  it('legt das Logo unter {company_id}/logo.{ext} ab', () => {
    expect(logoPath('f303644a', 'image/png')).toBe('f303644a/logo.png');
    expect(logoPath('f303644a', 'image/jpeg')).toBe('f303644a/logo.jpg');
  });
});
