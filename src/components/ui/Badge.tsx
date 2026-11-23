import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'neutral' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    success: 'bg-spotify-primary/15 text-spotify-primary border border-spotify-primary/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    error: 'bg-spotify-error/15 text-spotify-error border border-spotify-error/30',
    neutral: 'bg-spotify-surface text-spotify-on-surface border border-spotify-border',
    info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-1 font-bold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full transition-colors leading-none tracking-tight select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
