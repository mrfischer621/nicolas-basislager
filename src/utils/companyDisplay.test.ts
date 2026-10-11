import { describe, it, expect } from 'vitest';
import { companyDisplayName } from './companyDisplay';

describe('companyDisplayName', () => {
  it('zeigt den Alternativnamen, sonst den Namen', () => {
    expect(companyDisplayName({ name: 'Nicolas Fischer', alternativ_name: 'Blauwasser IT' })).toBe('Blauwasser IT');
    expect(companyDisplayName({ name: 'Freiluftchuchi c/o Nicolas Fischer', alternativ_name: '' })).toBe(
      'Freiluftchuchi c/o Nicolas Fischer'
    );
    expect(companyDisplayName({ name: 'X', alternativ_name: null })).toBe('X');
    expect(companyDisplayName({ name: 'X', alternativ_name: '   ' })).toBe('X');
  });
});
