'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Escape to close, Tab trapped inside, focus restored on close
function useModalBehaviour(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose, ref]);
}

export function Dialog({
  open,
  onClose,
  labelledBy,
  className,
  align = 'center',
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  align?: 'center' | 'top';
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useModalBehaviour(open, onClose, ref);
  if (!open) return null;
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto',
        align === 'top' ? 'items-start pt-[10vh]' : 'items-center'
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={cn('w-full', className)}>
        {children}
      </div>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  side,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  label: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useModalBehaviour(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'absolute top-0 bottom-0 w-[86vw] max-w-sm bg-[var(--bg-surface)] border-[var(--border-hard)] flex flex-col overflow-hidden',
          side === 'left' ? 'left-0 border-r-3' : 'right-0 border-l-3'
        )}
      >
        <button
          onClick={onClose}
          aria-label="Tutup panel"
          className="absolute top-2.5 right-2.5 z-10 p-1.5 border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] text-[var(--text-main)]"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
