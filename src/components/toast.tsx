'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ActionResult } from '@/lib/domain';
import { cn } from '@/lib/utils';

type Toast = { id: number; kind: 'success' | 'error'; message: string };

const ToastContext = React.createContext<(kind: Toast['kind'], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 z-[60] flex flex-col gap-2 max-w-[calc(100vw-1.5rem)] sm:max-w-sm" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'border-3 border-[#0A0A0C] text-[#0A0A0C] font-mono font-bold text-xs px-4 py-3 flex items-start gap-2 shadow-[4px_4px_0px_#0A0A0C]',
              t.kind === 'success' ? 'bg-accent-mint' : 'bg-accent-yellow'
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => React.useContext(ToastContext);

// Unwraps an ActionResult: shows a toast on failure and sends expired sessions to /login.
export function useRun() {
  const toast = useToast();
  const router = useRouter();
  return React.useCallback(
    async <T,>(pending: Promise<ActionResult<T>>, success?: string): Promise<T | null> => {
      let res: ActionResult<T>;
      try {
        res = await pending;
      } catch {
        toast('error', 'Koneksi ke server terputus. Coba lagi.');
        return null;
      }
      if (res.ok) {
        if (success) toast('success', success);
        return res.data;
      }
      toast('error', res.error.message);
      if (res.error.status === 401) router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return null;
    },
    [toast, router]
  );
}
