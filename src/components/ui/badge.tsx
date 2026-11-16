import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider select-none transition-all duration-150 whitespace-nowrap',
  {
    variants: {
      variant: {
        // 1. Dreamcore Pill (Soft round contrasting with hard 2px border)
        dream:
          'rounded-full px-2.5 py-0.5 border-2 border-[var(--border-hard)] shadow-[2px_2px_0px_var(--border-hard)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)]',

        // 2. Y2K Chrome Metallic Sticker (Tilted Clash)
        y2k: 'px-2.5 py-0.5 border-2 border-[var(--border-hard)] shadow-[2.5px_2.5px_0px_var(--border-hard)] bg-chrome text-[#0A0A0C] dark:text-white rotate-[-1.5deg] hover:rotate-0',

        // 3. Sharp Neo-Brutalist Stamp
        brutal: 'px-2 py-0.5 border-2 border-[var(--border-hard)] bg-[var(--border-hard)] text-[var(--bg-surface)] font-extrabold',

        // 4. Live / Success Indicator
        live: 'rounded-full px-2.5 py-0.5 border-2 border-[var(--border-hard)] bg-accent-mint text-[#0A0A0C] shadow-[1.5px_1.5px_0px_var(--border-hard)]',

        // 5. Urgent / Warning Indicator
        urgent: 'rounded-full px-2.5 py-0.5 border-2 border-[var(--border-hard)] bg-accent-yellow text-[#0A0A0C] shadow-[1.5px_1.5px_0px_var(--border-hard)]',

        // 6. Cyber Cyan Indicator
        cyan: 'rounded-full px-2.5 py-0.5 border-2 border-[var(--border-hard)] bg-accent-cyan text-[#0A0A0C] shadow-[1.5px_1.5px_0px_var(--border-hard)]',

        // 7. Hazard pink (errors, overdue)
        hazard: 'rounded-full px-2.5 py-0.5 border-2 border-[var(--border-hard)] bg-accent-pink text-[#0A0A0C] shadow-[1.5px_1.5px_0px_var(--border-hard)]',
      },
    },
    defaultVariants: {
      variant: 'dream',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
