import type { ReactNode, HTMLAttributes, FC } from 'react';

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

/**
 * Card.Header - Title section with optional action
 */
const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, action }) => {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-lg font-semibold text-text-primary tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};

/**
 * Card.Content - Body content wrapper
 */
const CardContent: FC<CardContentProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};

/**
 * Card - Swiss Modern Container Component
 *
 * Usage:
 * <Card>
 *   <Card.Header title="Übersicht" action={<button>...</button>} />
 *   <Card.Content>...</Card.Content>
 * </Card>
 */
type CardComponent = FC<CardProps> & {
  Header: typeof CardHeader;
  Content: typeof CardContent;
};

const CardBase: FC<CardProps> = ({ children, padding = 'md', hover = false, className = '', ...props }) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        bg-surface
        border border-surface-border
        rounded-xl
        shadow-sm
        ${hover ? 'transition-shadow duration-200 hover:shadow-hover' : ''}
        ${paddingClasses[padding]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </div>
  );
};

// Create compound component
export const Card = CardBase as CardComponent;
Card.Header = CardHeader;
Card.Content = CardContent;
