import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] text-[var(--text-main)] transition-all duration-150',
  {
    variants: {
      variant: {
        // 1. Interactive Brutal Frame (Hovers & Offsets)
        brutal:
          'shadow-[var(--solid-shadow)] hover:shadow-[var(--solid-shadow-lg)] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px]',
        
        // 2. Brutal Frame with Dreamcore Ambient Pastel Haze Aura
        haze:
          'shadow-[var(--dream-aura-shadow)] relative',
        
        // 3. Structural Fixed Panel (No hover movement)
        panel:
          'shadow-[var(--solid-shadow)]',
        
        // 4. Elevated Surface
        elevated:
          'bg-[var(--bg-surface-elevated)] shadow-[var(--solid-shadow-sm)]',
      },
    },
    defaultVariants: {
      variant: 'brutal',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-between p-4 border-b-2 border-[var(--border-hard)]', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-display font-black text-sm uppercase tracking-wide leading-none', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-3 border-t-2 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)]', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter, cardVariants };
