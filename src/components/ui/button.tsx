import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-mono font-bold transition-all duration-150 select-none disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ink-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]',
  {
    variants: {
      variant: {
        // 1. Neo-Brutal Frame (Default)
        default:
          'bg-[var(--bg-surface)] text-[var(--text-main)] border-2.5 border-[var(--border-hard)] shadow-[var(--solid-shadow-sm)] hover:shadow-[var(--solid-shadow)] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',

        // 2. Holographic: prism lives in the 3px frame, label stays on a solid fill (readability rule)
        holographic:
          'border-[3px] border-transparent text-[var(--bg-surface)] shadow-[var(--solid-shadow)] [background:linear-gradient(var(--border-hard),var(--border-hard))_padding-box,var(--holo-prism)_border-box] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',

        // 3. Y2K Metallic Chrome
        chrome:
          'bg-chrome text-[#0A0A0C] dark:text-white border-2.5 border-[var(--border-hard)] shadow-[3px_3px_0px_var(--border-hard)] hover:scale-[1.02] active:scale-[0.98]',

        // 4. Subtle Border Outline
        outline:
          'border-2 border-[var(--border-hard)] bg-transparent text-[var(--text-main)] hover:bg-[var(--border-hard)] hover:text-[var(--bg-surface)]',

        // 5. Destructive Hazard (black label: white on #FF1A75 fails AA)
        destructive:
          'bg-accent-pink text-[#0A0A0C] border-2.5 border-[var(--border-hard)] shadow-[var(--solid-shadow-sm)] hover:shadow-[var(--solid-shadow)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',

        // 6. Bare text action
        ghost: 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]',
      },
      size: {
        default: 'h-9 px-3.5 py-1.5',
        sm: 'h-7 px-2.5 text-[11px]',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button type={type} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
