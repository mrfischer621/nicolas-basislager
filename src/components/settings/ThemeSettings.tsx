import { useState } from 'react';
import { SegmentedControl } from '../ui';
import { getThemePreference, setThemePreference, type ThemePreference } from '../../utils/theme';
import { SettingsSection } from './SettingsSection';

/** Darstellung pro Geraet: hell ist Standard, dunkel nur auf Wunsch. */
export function ThemeSettings() {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference);
  return (
    <SettingsSection title="Darstellung" description="Standard ist hell, unabhängig vom Betriebssystem. «Dunkel» gilt nur für dieses Gerät.">
      <SegmentedControl
        label="Darstellung"
        options={[
          { value: 'light' as ThemePreference, label: 'Hell' },
          { value: 'dark' as ThemePreference, label: 'Dunkel' },
        ]}
        value={pref}
        onChange={(v) => {
          setPref(v);
          setThemePreference(v);
        }}
      />
    </SettingsSection>
  );
}
