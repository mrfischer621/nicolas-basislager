import { presetRange, zurichDay, type DayRange, type RangePreset } from './financeAggregation';

/** Zeitraeume der Berichte. */

export const RANGE_PRESETS: { value: RangePreset | 'eigen'; label: string }[] = [
  { value: 'current_month', label: 'Dieser Monat' },
  { value: 'last_month', label: 'Letzter Monat' },
  { value: 'current_year', label: 'Dieses Jahr' },
  { value: 'last_year', label: 'Letztes Jahr' },
  { value: 'last_90_days', label: '90 Tage' },
  { value: 'eigen', label: 'Eigener Zeitraum' },
];

/** Zeitraum aus der URL (zeitraum=..., bei "eigen" von/bis). Standard: dieses Jahr. */
export function rangeFromState(state: Record<string, string>): { preset: string; range: DayRange } {
  const preset = RANGE_PRESETS.some((p) => p.value === state.zeitraum) ? state.zeitraum : 'current_year';
  if (preset === 'eigen') {
    const today = zurichDay(new Date());
    return { preset, range: { from: state.von ?? `${today.slice(0, 4)}-01-01`, to: state.bis ?? today } };
  }
  return { preset, range: presetRange(preset as RangePreset) };
}
