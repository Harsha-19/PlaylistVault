import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'neutral' | 'surface' | 'interactive';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'surface', children, ...props }, ref) => {
    const variantStyles = {
      neutral: 'bg-spotify-neutral border border-spotify-border/40 text-spotify-on-surface',
      surface: 'bg-spotify-surface border border-spotify-border/60 text-spotify-on-surface',
      interactive:
        'bg-spotify-surface border border-spotify-border/60 text-spotify-on-surface hover:bg-spotify-surface-highlight transition-all duration-200 cursor-pointer group hover:border-spotify-border',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-md p-4 transition-colors', variantStyles[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
