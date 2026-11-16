'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Menu({
  label,
  trigger,
  triggerClassName,
  align = 'right',
  className,
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            'absolute top-full mt-2 z-50 min-w-[220px] border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] py-1 font-mono text-xs',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'w-full text-left px-3 py-2 font-bold text-[var(--text-main)] hover:bg-[var(--border-hard)] hover:text-[var(--bg-surface)] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2',
        className
      )}
      {...props}
    />
  );
}

export const MenuSeparator = () => <div role="separator" className="my-1 border-t-2 border-[var(--border-hard)]" />;
