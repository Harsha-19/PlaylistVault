import React from 'react';
import { cn } from '../../lib/utils';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Chip({ className, active = false, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150 select-none',
        active
          ? 'bg-spotify-secondary text-spotify-overlay'
          : 'bg-spotify-surface text-spotify-secondary hover:bg-spotify-surface-highlight border border-transparent',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
