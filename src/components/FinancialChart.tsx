import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatChfDisplay } from '../utils/money';
import { useThemeColors } from '../hooks/useThemeColors';

/**
 * Einnahmen und Ausgaben pro Periode als gruppierte Balken.
 * Einnahmen in Hellblau (cta), Ausgaben in Tinte: unterscheidbar ueber
 * Helligkeit, nicht nur ueber den Farbton (geprueft fuer Farbsehschwaechen),
 * dazu Legende und Tooltip mit Text.
 */
interface FinancialChartData {
  period: string;
  revenue: number;
  expenses: number;
}

interface FinancialChartProps {
  data: FinancialChartData[];
  height?: number;
  showLegend?: boolean;
}

// Achse ohne Waehrung (steht als Einheit oben), Tausender mit Hochkomma
const axisChf = (value: number) => formatChfDisplay(value, { decimals: 0 }).replace('CHF ', '');

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: FinancialChartData }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const result = row.revenue - row.expenses;
  return (
    <div className="rounded-lg bg-surface p-3 text-sm shadow-lg ring-1 ring-line">
      <p className="mb-1 font-display font-bold text-fg">{row.period}</p>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-fg-muted">Einnahmen</dt>
        <dd className="text-right text-fg">{formatChfDisplay(row.revenue)}</dd>
        <dt className="text-fg-muted">Ausgaben</dt>
        <dd className="text-right text-fg">{formatChfDisplay(row.expenses)}</dd>
        <dt className="border-t border-line pt-0.5 text-fg-muted">{result >= 0 ? 'Gewinn' : 'Verlust'}</dt>
        <dd className="border-t border-line pt-0.5 text-right font-semibold text-fg">{formatChfDisplay(Math.abs(result))}</dd>
      </dl>
    </div>
  );
}

export default function FinancialChart({ data, height = 300, showLegend = true }: FinancialChartProps) {
  const c = useThemeColors();
  const tick = { fill: c['fg-muted'], fontSize: 12 };
  return (
    <figure aria-label="Einnahmen und Ausgaben pro Periode in CHF">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={c.line} />
          <XAxis dataKey="period" tick={tick} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={8} />
          <YAxis
            tickFormatter={axisChf}
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={56}
            label={{ value: 'CHF', position: 'top', offset: 12, fill: c['fg-muted'], fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: c['accent-subtle'] }} />
          {showLegend && (
            <Legend
              iconType="square"
              wrapperStyle={{ paddingTop: 12 }}
              formatter={(value) => <span className="text-sm text-fg">{value}</span>}
            />
          )}
          <Bar dataKey="revenue" name="Einnahmen" fill={c.cta} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" name="Ausgaben" fill={c.fg} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
