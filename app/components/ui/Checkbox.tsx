import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { classNames } from '~/utils/classNames';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={classNames(
      'peer h-4 w-4 shrink-0 rounded-sm border transition-colors',
      'bg-transparent dark:bg-transparent',
      'border-zinc-400 dark:border-[#2a2a25]',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-[#ff7a1a] focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0a0a09]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-[#ff7a1a] dark:data-[state=checked]:bg-[#ff7a1a]',
      'data-[state=checked]:border-[#ff7a1a] dark:data-[state=checked]:border-[#ff7a1a]',
      'data-[state=checked]:text-[#0a0a09] dark:data-[state=checked]:text-[#0a0a09]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
