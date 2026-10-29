import * as React from 'react';
import { cn } from '../../utils/cn';

const Button = React.forwardRef(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      type = 'button',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

    const variants = {
      default:
        'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 shadow-blue-600/20 hover:shadow-md hover:shadow-blue-600/30',
      destructive:
        'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 shadow-red-600/20',
      outline:
        'border border-slate-200 bg-white text-slate-900 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
      secondary:
        'bg-slate-100 text-slate-800 shadow-xs hover:bg-slate-200 active:bg-slate-300',
      ghost:
        'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      link:
        'text-blue-600 underline-offset-4 hover:underline p-0 h-auto font-medium',
    };

    const sizes = {
      default: 'h-11 px-5 py-2.5',
      sm: 'h-9 rounded-md px-3 text-xs',
      lg: 'h-12 rounded-xl px-8 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
