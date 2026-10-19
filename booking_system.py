import sqlite3
from datetime import datetime

DB_FILE = 'bookings.db'

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'Sedang',
            deadline_date TEXT NOT NULL,
            deadline_time TEXT DEFAULT '09:00',
            notes TEXT DEFAULT '',
            is_completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS email_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reminder_id INTEGER,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def add_reminder(title, priority, date_str, time_str, notes):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO reminders (title, priority, deadline_date, deadline_time, notes, is_completed)
           VALUES (?, ?, ?, ?, ?, 0)''',
        (title, priority, date_str, time_str, notes)
    )
    conn.commit()
    conn.close()
    print(f"\n✅ Pengingat '{title}' berhasil disimpan!")

def view_reminders():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM reminders ORDER BY is_completed ASC, deadline_date ASC')
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("\n📭 Belum ada pengingat / tugas.")
        return

    print("\n--- 📋 Daftar Pengingat & Deadline Tugas ---")
    print(f"{'ID':<4} | {'Status':<8} | {'Prioritas':<10} | {'Deadline':<18} | {'Judul Tugas':<25}")
    print("-" * 75)
    for row in rows:
        status = "[✓] Selesai" if row['is_completed'] else "[ ] Aktif"
        deadline = f"{row['deadline_date']} {row['deadline_time'] or '09:00'}"
        title = row['title'][:23] + '..' if len(row['title']) > 25 else row['title']
        print(f"{row['id']:<4} | {status:<8} | {row['priority']:<10} | {deadline:<18} | {title:<25}")

def toggle_completed(reminder_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT is_completed, title FROM reminders WHERE id = ?', (reminder_id,))
    row = cursor.fetchone()
    if not row:
        print(f"\n❌ Pengingat dengan ID {reminder_id} tidak ditemukan.")
        conn.close()
        return

    new_val = 0 if row['is_completed'] == 1 else 1
    cursor.execute('UPDATE reminders SET is_completed = ? WHERE id = ?', (new_val, reminder_id))
    conn.commit()
    conn.close()
    status_label = "SELESAI ✓" if new_val == 1 else "AKTIF KEMBALI"
    print(f"\n✅ Tugas '{row['title']}' ditandai {status_label}!")

def send_simulated_email(reminder_id, recipient="azzafazzam13@gmail.com"):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM reminders WHERE id = ?', (reminder_id,))
    row = cursor.fetchone()
    if not row:
        print(f"\n❌ Pengingat dengan ID {reminder_id} tidak ditemukan.")
        conn.close()
        return

    subject = f"🔔 [Pengingat Deadline: {row['priority']}] {row['title']}"
    body = (
        f"Halo Faiz!\n\n"
        f"Pengingat tugas pribadi Anda:\n"
        f"- Judul    : {row['title']}\n"
        f"- Prioritas: {row['priority']}\n"
        f"- Deadline : {row['deadline_date']} {row['deadline_time']}\n"
        f"- Catatan  : {row['notes']}\n"
    )
    cursor.execute(
        '''INSERT INTO email_logs (reminder_id, recipient, subject, body, status)
           VALUES (?, ?, ?, ?, ?)''',
        (reminder_id, recipient, subject, body, 'TERKIRIM (SIMULASI)')
    )
    conn.commit()
    conn.close()
    print(f"\n📧 [SIMULASI EMAIL TERKIRIM]")
    print(f"Kepada : {recipient}")
    print(f"Subjek : {subject}")
    print(f"Status : Sukses dicatat ke log email!")

def delete_reminder(reminder_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM reminders WHERE id = ?', (reminder_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()

    if affected > 0:
        print(f"\n🗑️ Pengingat ID {reminder_id} berhasil dihapus.")
    else:
        print("\n❌ ID pengingat tidak ditemukan.")

def main():
    init_db()
    while True:
        print("\n=== 🔔 Faiz Personal Reminder (CLI) ===")
        print("1. Tambah Pengingat Baru")
        print("2. Lihat Semua Pengingat")
        print("3. Tandai Selesai / Belum Selesai (Checklist)")
        print("4. Kirim Email Pengingat (Simulasi)")
        print("5. Hapus Pengingat")
        print("6. Keluar")

        choice = input("Pilih menu (1-6): ").strip()

        if choice == '1':
            title = input("Masukkan Judul Tugas/Pengingat: ").strip()
            print("Pilih Prioritas: 1. Tinggi | 2. Sedang | 3. Rendah")
            p_choice = input("Pilihan (1-3, default 2): ").strip()
            p_map = {'1': 'Tinggi', '2': 'Sedang', '3': 'Rendah'}
            priority = p_map.get(p_choice, 'Sedang')

            date_str = input("Masukkan Tanggal Deadline (YYYY-MM-DD): ").strip()
            time_str = input("Masukkan Jam (HH:MM, misal 14:00, default 09:00): ").strip() or "09:00"
            notes = input("Masukkan Catatan (opsional): ").strip()
            add_reminder(title, priority, date_str, time_str, notes)
        elif choice == '2':
            view_reminders()
        elif choice == '3':
            try:
                rid = int(input("Masukkan ID Pengingat: "))
                toggle_completed(rid)
            except ValueError:
                print("\nMohon masukkan angka untuk ID.")
        elif choice == '4':
            try:
                rid = int(input("Masukkan ID Pengingat yang ingin dikirimkan emailnya: "))
                email_target = input("Kirim ke email (tekan Enter untuk azzafazzam13@gmail.com): ").strip() or "azzafazzam13@gmail.com"
                send_simulated_email(rid, email_target)
            except ValueError:
                print("\nMohon masukkan angka untuk ID.")
        elif choice == '5':
            try:
                rid = int(input("Masukkan ID Pengingat yang ingin dihapus: "))
                delete_reminder(rid)
            except ValueError:
                print("\nMohon masukkan angka untuk ID.")
        elif choice == '6':
            print("Terima kasih Faiz! Sampai jumpa.")
            break
        else:
            print("\nPilihan tidak valid.")

if __name__ == "__main__":
    main()
