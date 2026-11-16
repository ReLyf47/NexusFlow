import { AlertTriangle } from 'lucide-react';

interface ViewerBannerProps {
  isVisible: boolean;
  // true when the real role allows editing and only the preview lowered it
  canRestore: boolean;
  onRestore: () => void;
}

export function ViewerBanner({ isVisible, canRestore, onRestore }: ViewerBannerProps) {
  if (!isVisible) return null;
  return (
    <div
      role="status"
      className="border-b-3 border-[var(--border-hard)] bg-accent-yellow text-[#0A0A0C] px-4 py-2.5 text-xs font-mono font-bold flex items-center justify-between gap-3 z-30"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          [MODE: READ-ONLY] Anda berada dalam izin Viewer. Pengeditan catatan, pembuatan tiket tugas, dan ekstraksi AI
          dinonaktifkan.
        </span>
      </div>
      {canRestore && (
        <button onClick={onRestore} className="underline underline-offset-2 hover:no-underline shrink-0">
          [AKTIFKAN_EDITOR]
        </button>
      )}
    </div>
  );
}
