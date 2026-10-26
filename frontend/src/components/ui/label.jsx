import * as React from 'react';
import { cn } from '../../utils/cn';

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-xs font-semibold uppercase tracking-wider text-slate-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none block mb-2',
      className
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
