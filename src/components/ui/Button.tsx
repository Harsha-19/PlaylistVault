import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spotify-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-spotify-neutral disabled:opacity-50 disabled:pointer-events-none select-none';

    // Exact variants from spotify.com-design.md
    const variantStyles = {
      // button-primary: bg #ffffff, text #000000, hover #1ed760
      primary:
        'bg-spotify-secondary text-spotify-overlay hover:bg-spotify-primary hover:scale-[1.03] active:scale-[0.98]',
      // button-secondary: transparent, border #7c7c7c, text #ffffff, hover #242424
      secondary:
        'bg-transparent text-spotify-secondary border border-spotify-tertiary hover:border-spotify-secondary hover:bg-spotify-surface hover:scale-[1.02] active:scale-[0.98]',
      // button-tertiary: transparent, text #b3b3b3, hover #ffffff
      tertiary:
        'bg-transparent text-spotify-on-surface hover:text-spotify-secondary p-0 h-auto font-normal hover:underline',
      // button-danger: #ff4d4f
      danger:
        'bg-spotify-error text-spotify-secondary hover:bg-opacity-90 hover:scale-[1.02] active:scale-[0.98]',
    };

    const sizeStyles = {
      default: 'h-12 px-8 py-2 rounded-full text-sm',
      sm: 'h-9 px-4 py-1.5 rounded-full text-xs',
      lg: 'h-14 px-10 py-3 rounded-full text-base',
      icon: 'h-10 w-10 p-0 rounded-full',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          variant !== 'tertiary' ? sizeStyles[size] : '',
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
