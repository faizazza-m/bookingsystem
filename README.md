# Sistem Booking Modern & Ringan

Aplikasi manajemen booking dan reservasi dengan antarmuka web modern (Glassmorphism UI) serta antarmuka CLI terminal, menggunakan Python dan SQLite tanpa dependensi eksternal.

## Teknologi
- **Python 3** (standar library murni, tanpa `pip install`)
- **SQLite** (database lokal otomatis di file `bookings.db`)
- **Modern Vanilla Web** (HTML5 Semantic, CSS3 Glassmorphism & Custom Properties, Vanilla JavaScript ES6+)

---

## Cara Menjalankan

### 1. Antarmuka Web (Rekomendasi)
Jalankan server lokal bawaan:
```bash
python3 server.py
```
Buka peramban (browser) di: **[http://localhost:8000](http://localhost:8000)**

### 2. Antarmuka Terminal (CLI)
Jika ingin menggunakan mode teks interaktif di terminal:
```bash
python3 booking_system.py
```

---

## Fitur Unggulan Antarmuka Web
1. **Dasbor Statistik & KPI**:
   - Total Booking
   - Booking Hari Ini
   - Booking Mendatang / Aktif
   - Layanan Paling Populer
2. **Pencarian & Penyortiran Real-Time**:
   - Cari instan berdasarkan nama pelanggan atau layanan
   - Urutkan berdasarkan data terbaru, tanggal terdekat, tanggal terjauh, atau nama A-Z
3. **Pilihan Tampilan Fleksibel**:
   - *Table View*: Tampilan tabel profesional lengkap dengan status badge interaktif
   - *Grid Card View*: Tampilan kartu visual dengan inisial avatar dinamis
4. **Formulir Interaktif (Modal)**:
   - Quick pills pilihan kategori layanan
   - Shortcut tanggal ("Hari Ini", "Besok", "+7 Hari")
   - Validasi formulir otomatis
5. **Tema Gelap & Terang**:
   - Dilengkapi tema *Dark Mode* default yang elegan dan toggle *Light Mode* yang tersimpan di browser
6. **Sinkronisasi Data**:
   - Data yang dibuat melalui Web maupun CLI tersimpan di database yang sama (`bookings.db`)

---

## Struktur Database
Tabel `bookings`:
- `id` (INTEGER, Primary Key AUTOINCREMENT)
- `customer_name` (TEXT)
- `service` (TEXT)
- `booking_date` (TEXT, format `YYYY-MM-DD`)