# NexusFlow Mobile (Expo / React Native)

Aplikasi native Android & iOS untuk NexusFlow. Memakai REST API server Next.js yang sama
(`/api/*`, autentikasi Bearer JWT) dan sistem desain *Artistic Clash* yang sama (token warna,
font Syne · Space Grotesk · Plus Jakarta Sans · Space Mono, border brutal 3px, bayangan offset).

## Fitur
- Login / registrasi (token disimpan di Keychain/Keystore via `expo-secure-store`, refresh otomatis).
- Direktori dokumen per proyek & arsip, pembaca Markdown + `[[wikilink]]`, editor dengan autosave 3 detik,
  tag, proyek, arsip/hapus, Related Context (skor relevansi), tiket tertaut.
- Ringkasan AI dan ekstraksi action item (review → konfirmasi ke Kanban).
- Kanban 4 kolom (tab status, pindah kolom), filter "Tugas saya", form tugas lengkap.
- Pencarian terpusat (catatan / tugas / proyek).
- Akun: ganti workspace, tema Light/Dark/Sistem, anggota & role (Admin), konfigurasi LLM (Admin), logout.
- RBAC mengikuti server: Viewer melihat banner read-only dan semua kontrol ubah dinonaktifkan.

## Menjalankan
```bash
cd mobile
bun install
bun run start        # lalu buka di Expo Go / emulator (tekan a untuk Android, i untuk iOS)
```
Di layar login isi **Server NexusFlow** dengan alamat server web yang dapat dijangkau perangkat:
- Emulator Android: `http://10.0.2.2:3000`
- Simulator iOS / web: `http://localhost:3000`
- HP fisik: `http://<IP-LAN-komputer>:3000` (jalankan server dengan `bun run dev -H 0.0.0.0`)

Nilai default dapat diatur lewat `EXPO_PUBLIC_API_URL`.

## Verifikasi
```bash
bun run typecheck       # tsc
bun run test            # parser Markdown
bunx expo-doctor        # kompatibilitas dependensi SDK
bun run export:android  # bundle Hermes Android
```
Build APK/IPA: `bunx eas-cli build --platform android` (butuh akun Expo).
