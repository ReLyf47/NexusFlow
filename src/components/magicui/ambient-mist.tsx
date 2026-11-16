import React from 'react';
import { cn } from '@/lib/utils';

// Dreamcore haze behind the whole canvas. Decorative only: never sits behind text surfaces.
export function AmbientMist({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 overflow-hidden z-0 select-none opacity-60', className)}
    >
      <div className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full blur-[130px] bg-haze animate-dream-float" />
      <div className="absolute bottom-[5%] right-[10%] w-[550px] h-[550px] rounded-full blur-[150px] bg-haze animate-dream-float [animation-delay:4s]" />
    </div>
  );
}
