import sqlite3
from datetime import datetime

def init_db():
    conn = sqlite3.connect('bookings.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            service TEXT NOT NULL,
            booking_date TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def add_booking(name, service, date):
    conn = sqlite3.connect('bookings.db')
    cursor = conn.cursor()
    cursor.execute('INSERT INTO bookings (customer_name, service, booking_date) VALUES (?, ?, ?)',
                   (name, service, date))
    conn.commit()
    conn.close()
    print(f"\nBooking berhasil dibuat untuk {name}!")

def view_bookings():
    conn = sqlite3.connect('bookings.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM bookings')
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("\nBelum ada data booking.")
        return

    print("\n--- Daftar Booking ---")
    print(f"{'ID':<4} | {'Nama':<20} | {'Layanan':<15} | {'Tanggal':<12}")
    print("-" * 55)
    for row in rows:
        print(f"{row[0]:<4} | {row[1]:<20} | {row[2]:<15} | {row[3]:<12}")

def cancel_booking(booking_id):
    conn = sqlite3.connect('bookings.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM bookings WHERE id = ?', (booking_id,))
    if cursor.rowcount > 0:
        print(f"\nBooking ID {booking_id} berhasil dibatalkan.")
    else:
        print("\nID booking tidak ditemukan.")
    conn.commit()
    conn.close()

def main():
    init_db()
    while True:
        print("\n=== Sistem Booking Sederhana ===")
        print("1. Tambah Booking")
        print("2. Lihat Semua Booking")
        print("3. Batalkan Booking")
        print("4. Keluar")

        choice = input("Pilih menu (1-4): ")

        if choice == '1':
            name = input("Masukkan Nama Pelanggan: ")
            service = input("Masukkan Layanan: ")
            date = input("Masukkan Tanggal (YYYY-MM-DD): ")
            add_booking(name, service, date)
        elif choice == '2':
            view_bookings()
        elif choice == '3':
            try:
                bid = int(input("Masukkan ID Booking yang ingin dibatalkan: "))
                cancel_booking(bid)
            except ValueError:
                print("\nMohon masukkan angka untuk ID.")
        elif choice == '4':
            print("Terima kasih! Program selesai.")
            break
        else:
            print("\nPilihan tidak valid.")

if __name__ == "__main__":
    main()
