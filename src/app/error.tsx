'use client';

import { Database, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// SDD 7 "Offline / Database Reconnect": no fake fallback data, an honest retry instead
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex-1 flex items-center justify-center p-4 relative z-10">
      <div className="max-w-md w-full border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] p-6 space-y-4">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink-pink">
          <Database className="w-4 h-4" /> MARIADB_POOL // ERROR
        </div>
        <h1 className="font-display font-black text-2xl uppercase text-[var(--text-main)]">Server tidak dapat memuat data</h1>
        <p className="text-sm text-[var(--text-sub)]">
          Biasanya database MariaDB belum berjalan. Jalankan <code className="font-mono">docker compose up -d</code> lalu coba lagi.
        </p>
        <Button variant="holographic" onClick={reset}>
          <RotateCcw className="w-4 h-4" /> COBA_LAGI
        </Button>
      </div>
    </main>
  );
}
