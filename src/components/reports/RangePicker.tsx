import type { DayRange } from '../../utils/financeAggregation';
import { RANGE_PRESETS } from '../../utils/reportRange';

export function RangePicker({ preset, range, onChange }: { preset: string; range: DayRange; onChange: (patch: Record<string, string | null>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label>
        <span className="sr-only">Zeitraum</span>
        <select className="input w-auto py-2" value={preset} onChange={(e) => onChange({ zeitraum: e.target.value, von: e.target.value === 'eigen' ? range.from : null, bis: e.target.value === 'eigen' ? range.to : null })}>
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {preset === 'eigen' && (
        <>
          <label className="flex items-center gap-1 text-sm text-fg-muted">
            von <input type="date" className="input w-auto py-2" value={range.from} onChange={(e) => onChange({ von: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 text-sm text-fg-muted">
            bis <input type="date" className="input w-auto py-2" value={range.to} onChange={(e) => onChange({ bis: e.target.value })} />
          </label>
        </>
      )}
    </div>
  );
}
