import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-4 relative z-10">
      <div className="max-w-md w-full border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] p-6 space-y-4">
        <div className="font-mono text-xs font-bold text-ink-pink">// ERROR_404</div>
        <h1 className="font-display font-black text-2xl uppercase text-[var(--text-main)]">Tidak ditemukan</h1>
        <p className="text-sm text-[var(--text-sub)]">Halaman ini tidak ada, atau Anda bukan anggota workspace tersebut.</p>
        <Link href="/" className="inline-block font-mono text-xs font-bold underline underline-offset-4 text-[var(--text-main)]">
          ← KEMBALI_KE_WORKSPACE
        </Link>
      </div>
    </main>
  );
}
