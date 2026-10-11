import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: ReactNode;
  loading?: boolean;
}

/**
 * KPICard - Swiss Modern Metric Display
 *
 * Usage:
 * <KPICard
 *   label="Einnahmen"
 *   value="CHF 12'500"
 *   trend="up"
 *   trendValue="+12%"
 * />
 */
export function KPICard({ label, value, trend, trendValue, icon, loading = false }: KPICardProps) {
  const trendColors = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-text-secondary',
  };

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  };

  const CurrentTrendIcon = trend ? TrendIcon[trend] : null;

  return (
    <div className="card p-6 hover:shadow-hover transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <p className="text-sm font-medium text-text-secondary mb-1">
            {label}
          </p>

          {/* Value */}
          <p className={`text-3xl font-bold tracking-tight ${
            trend === 'up' ? 'text-success' :
            trend === 'down' ? 'text-danger' :
            'text-text-primary'
          }`}>
            {loading ? (
              <span className="inline-block w-24 h-8 bg-sunken rounded animate-pulse" />
            ) : (
              value
            )}
          </p>

          {/* Trend Indicator */}
          {trend && trendValue && !loading && (
            <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trendColors[trend]}`}>
              {CurrentTrendIcon && <CurrentTrendIcon size={14} />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>

        {/* Icon (optional) */}
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
