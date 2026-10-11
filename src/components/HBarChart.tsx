import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatChfDisplay } from '../utils/money';
import { useThemeColors } from '../hooks/useThemeColors';

/**
 * Liegende Balken fuer Rangfolgen (pro Kunde, pro Kategorie, pro Tag).
 * Eine Farbe pro Diagramm: Es geht um Groessen, nicht um Identitaet.
 */
export default function HBarChart<T extends object>({
  data,
  labelKey,
  valueKey = 'amount' as keyof T & string,
  color = 'cta',
  label,
}: {
  data: T[];
  labelKey: keyof T & string;
  valueKey?: keyof T & string;
  color?: 'cta' | 'fg';
  label: string;
}) {
  const c = useThemeColors();
  const height = Math.max(160, data.length * 36 + 40);
  return (
    <figure aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={c.line} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatChfDisplay(v, { decimals: 0 }).replace('CHF ', '')}
            tick={{ fill: c['fg-muted'], fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey={labelKey}
            width={140}
            tick={{ fill: c.fg, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: c.line }}
          />
          <Tooltip
            cursor={{ fill: c['accent-subtle'] }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-lg bg-surface px-3 py-2 text-sm shadow-lg ring-1 ring-line">
                  <p className="font-display font-bold text-fg">{String((payload[0].payload as T)[labelKey])}</p>
                  <p className="tabular-nums text-fg">{formatChfDisplay(Number(payload[0].value))}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey={valueKey} fill={c[color]} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
