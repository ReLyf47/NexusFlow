import React from 'react';
import { cn } from '@/lib/utils';

interface ShimmerBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

// Y2K liquid-chrome sticker with a holographic sheen, tilted -1.5deg off the grid (Clash Pair 5)
export function ShimmerBadge({ children, className, ...props }: ShimmerBadgeProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold border-2.5 border-[var(--border-hard)] bg-chrome text-[#0A0A0C] dark:text-white shadow-[3px_3px_0px_var(--border-hard)] select-none',
        'after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] after:animate-holo-sheen',
        'hover:rotate-0 rotate-[-1.5deg] transition-transform duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
