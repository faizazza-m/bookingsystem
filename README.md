# Faiz Reminder - Personal Deadline & Task Manager

Aplikasi pengingat tugas, agenda, dan deadline pribadi dengan antarmuka **Neo-Brutalism**, kalender interaktif, dukungan **PWA**, serta simulasi **notifikasi email**, dibangun dengan Python murni dan SQLite tanpa dependensi eksternal.

## 🚀 Fitur Unggulan
1. **Todo Checklist & Deadline**:
   - Centang tugas yang sudah selesai dengan checkbox interaktif
   - Tiga tingkat prioritas visual: 🔴 **Tinggi**, 🟡 **Sedang**, 🟢 **Rendah**
   - Penentuan tanggal dan jam deadline (WIB)
2. **Notifikasi Email (Simulasi & Outbox Log)**:
   - Kirim notifikasi pengingat tugas langsung ke email (default: `faizfaqot23@gmail.com`)
   - Modal preview pesan email sebelum dikirim
   - Riwayat log pengiriman email keluar (*Outbox*)
3. **Kalender Interaktif (Mobile-Optimized)**:
   - Tampilan visual bulanan dengan titik indikator prioritas (*event dots*)
   - Klik tanggal untuk melihat daftar tugas yang harus diselesaikan pada hari tersebut
4. **PWA (Progressive Web App)**:
   - Tombol **"Pasang App"** untuk menginstal langsung ke layar utama Android, iOS, atau Desktop
5. **Mode Terminal (CLI)**:
   - Kelola tugas dan kirim email pengingat langsung dari terminal

---

## 🛠️ Cara Menjalankan

### 1. Antarmuka Web (Rekomendasi)
```bash
python3 server.py
```
Buka browser di: **[http://localhost:8000](http://localhost:8000)**

### 2. Antarmuka Terminal (CLI)
```bash
python3 booking_system.py
```

---

## 📂 Struktur Berkas
- `server.py`: Server HTTP & REST API Python (database, reminders, email handler)
- `booking_system.py`: Program CLI interaktif
- `public/index.html`: Antarmuka web utama
- `public/styles.css`: Desain Neo-Brutalism responsif
- `public/app.js`: Logika aplikasi frontend & PWA
- `public/manifest.json`: Konfigurasi Web App Manifest PWA
- `public/sw.js`: Service worker untuk caching offline
- `public/icons/`: Ikon aplikasi PWA (192px, 512px, apple-touch, favicon)