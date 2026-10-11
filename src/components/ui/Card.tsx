import type { ReactNode, HTMLAttributes, FC } from 'react';

/** Weisse Karte: radius-card (24 px), shadow-card, ohne Rand. */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, action }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

const CardContent: FC<CardContentProps> = ({ children, className = '', ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
);

type CardComponent = FC<CardProps> & {
  Header: typeof CardHeader;
  Content: typeof CardContent;
};

const paddingClasses = { none: '', sm: 'p-4', md: 'p-5 md:p-7', lg: 'p-8' };

const CardBase: FC<CardProps> = ({ children, padding = 'md', hover = false, className = '', ...props }) => (
  <div
    className={`card ${hover ? 'transition-shadow duration-fast hover:shadow-md' : ''} ${paddingClasses[padding]} ${className}`.trim()}
    {...props}
  >
    {children}
  </div>
);

export const Card = CardBase as CardComponent;
Card.Header = CardHeader;
Card.Content = CardContent;
