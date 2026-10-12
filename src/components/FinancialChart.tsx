import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useIsMobile } from '../hooks/useMediaQuery';
import { formatChfDisplay } from '../utils/money';
import { useThemeColors } from '../hooks/useThemeColors';

/**
 * Einnahmen und Ausgaben pro Periode als gruppierte Balken.
 * Einnahmen gruen, Ausgaben rot (Erweiterung CRM). Rot und Gruen sind bei
 * Rot-Gruen-Schwaeche kaum unterscheidbar (Palettenpruefung dE 4.2), darum
 * zusaetzlich: Ausgaben schraffiert, Einnahmen links, Legende und Tooltip
 * mit Wort und Vorzeichen, Kontur in der Textvariante (3:1 auf Weiss).
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
        <dt className="flex items-center gap-1.5 text-fg-muted">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-positive-solid" />
          Einnahmen
        </dt>
        <dd className="text-right text-positive">+ {formatChfDisplay(row.revenue)}</dd>
        <dt className="flex items-center gap-1.5 text-fg-muted">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-negative-solid" />
          Ausgaben
        </dt>
        <dd className="text-right text-negative">− {formatChfDisplay(row.expenses)}</dd>
        <dt className="border-t border-line pt-0.5 text-fg-muted">{result >= 0 ? 'Gewinn' : 'Verlust'}</dt>
        <dd className={`border-t border-line pt-0.5 text-right font-semibold ${result >= 0 ? 'text-positive' : 'text-negative'}`}>
          {formatChfDisplay(Math.abs(result))}
        </dd>
      </dl>
    </div>
  );
}

export default function FinancialChart({ data, height = 300, showLegend = true }: FinancialChartProps) {
  const c = useThemeColors();
  const tick = { fill: c['fg-muted'], fontSize: 12 };
  // Handy: schmalere Achse, damit die Balken mehr Breite bekommen
  const mobile = useIsMobile();
  return (
    <figure aria-label="Einnahmen und Ausgaben pro Periode in CHF">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <defs>
            {/* Schraffur fuer Ausgaben: zweites Merkmal neben der Farbe */}
            <pattern id="ausgaben-schraffur" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={c.negative} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={c['negative-text']} strokeWidth="2.5" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke={c.line} />
          <XAxis dataKey="period" tick={tick} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={8} />
          <YAxis
            tickFormatter={axisChf}
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={mobile ? 44 : 56}
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
          <Bar dataKey="revenue" name="Einnahmen" fill={c.positive} stroke={c['positive-text']} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" name="Ausgaben" fill="url(#ausgaben-schraffur)" stroke={c['negative-text']} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
