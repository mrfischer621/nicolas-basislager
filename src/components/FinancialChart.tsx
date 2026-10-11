import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatChfDisplay } from '../utils/money';

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

const formatCurrency = (value: number): string => formatChfDisplay(value, { decimals: 0 });

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload[0]?.value || 0;
    const expenses = payload[1]?.value || 0;
    const profit = revenue - expenses;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{payload[0]?.payload.period}</p>
        <div className="space-y-1">
          <p className="text-sm text-success-dark font-medium">
            Einnahmen: {formatCurrency(revenue)}
          </p>
          <p className="text-sm text-danger-dark font-medium">
            Ausgaben: {formatCurrency(expenses)}
          </p>
          <div className="border-t border-gray-200 pt-1 mt-1">
            <p className={`text-sm font-semibold ${profit >= 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
              {profit >= 0 ? 'Gewinn' : 'Verlust'}: {formatCurrency(Math.abs(profit))}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function FinancialChart({
  data,
  height = 300,
  showLegend = true,
}: FinancialChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#166534" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#991b1b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#991b1b" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="period"
          tick={{ fill: '#6B7280', fontSize: 12 }}
          tickLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tickFormatter={(value) => formatCurrency(value)}
          tick={{ fill: '#6B7280', fontSize: 12 }}
          tickLine={{ stroke: '#E5E7EB' }}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
            formatter={(value) => (
              <span className="text-sm text-gray-700">
                {value === 'revenue' ? 'Einnahmen' : 'Ausgaben'}
              </span>
            )}
          />
        )}
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#166534"
          strokeWidth={2}
          fill="url(#colorRevenue)"
          name="revenue"
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#991b1b"
          strokeWidth={2}
          fill="url(#colorExpenses)"
          name="expenses"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
