import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', icon, rightElement, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-4 text-spotify-on-surface pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full h-12 rounded-full bg-spotify-surface text-spotify-secondary text-sm px-4 py-2 placeholder:text-spotify-on-surface border border-transparent transition-colors duration-150',
            'focus:outline-none focus:border-spotify-secondary focus:ring-1 focus:ring-spotify-secondary',
            'hover:bg-spotify-surface-highlight',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            icon ? 'pl-11' : 'pl-4',
            rightElement ? 'pr-11' : 'pr-4',
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center justify-center">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
