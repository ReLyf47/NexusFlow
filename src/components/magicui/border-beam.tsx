import React from 'react';
import { cn } from '@/lib/utils';

// Holographic prism frame (Clash Pair 1). While `active` (AI computing) the spectrum flows
// around the 3px border; otherwise it is a plain brutal border. Content keeps its solid surface.
export function BorderBeam({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'p-[3px]',
        active ? 'bg-holo bg-[length:300%_300%] animate-holo-shift' : 'bg-[var(--border-hard)]',
        className
      )}
    >
      {children}
    </div>
  );
}
