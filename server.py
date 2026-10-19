import http.server
import json
import os
import sqlite3
import sys
import urllib.parse
from datetime import date, datetime

DB_FILE = 'bookings.db'
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
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

class BookingRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_json(self, data, status_code=200):
        response_body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(response_body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == '/api/bookings':
            self.handle_get_bookings(query_params)
            return
        elif path == '/api/stats':
            self.handle_get_stats()
            return
        
        # Serve static files from PUBLIC_DIR
        super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/bookings':
            self.handle_create_booking()
            return
        self._send_json({'error': 'Not found'}, 404)

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        parts = parsed_url.path.strip('/').split('/')
        # e.g. /api/bookings/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'bookings':
            try:
                booking_id = int(parts[2])
                self.handle_delete_booking(booking_id)
                return
            except ValueError:
                self._send_json({'error': 'ID booking harus berupa angka'}, 400)
                return
        self._send_json({'error': 'Not found'}, 404)

    def handle_get_bookings(self, query_params):
        search = query_params.get('search', [''])[0].strip()
        sort_by = query_params.get('sort', ['id_desc'])[0]

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = 'SELECT id, customer_name, service, booking_date FROM bookings'
        params = []

        if search:
            sql += ' WHERE customer_name LIKE ? OR service LIKE ? OR booking_date LIKE ?'
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param])

        if sort_by == 'date_asc':
            sql += ' ORDER BY booking_date ASC, id ASC'
        elif sort_by == 'date_desc':
            sql += ' ORDER BY booking_date DESC, id DESC'
        elif sort_by == 'name_asc':
            sql += ' ORDER BY customer_name COLLATE NOCASE ASC'
        else:
            sql += ' ORDER BY id DESC'

        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()

        bookings = [
            {
                'id': row['id'],
                'customer_name': row['customer_name'],
                'service': row['service'],
                'booking_date': row['booking_date']
            }
            for row in rows
        ]
        self._send_json({'success': True, 'data': bookings, 'total': len(bookings)})

    def handle_get_stats(self):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) as total FROM bookings')
        total = cursor.fetchone()['total']

        today_str = date.today().isoformat()
        cursor.execute('SELECT COUNT(*) as today_count FROM bookings WHERE booking_date = ?', (today_str,))
        today_count = cursor.fetchone()['today_count']

        cursor.execute('SELECT COUNT(*) as upcoming_count FROM bookings WHERE booking_date >= ?', (today_str,))
        upcoming_count = cursor.fetchone()['upcoming_count']

        cursor.execute('''
            SELECT service, COUNT(*) as count 
            FROM bookings 
            GROUP BY service 
            ORDER BY count DESC 
            LIMIT 1
        ''')
        top_service_row = cursor.fetchone()
        top_service = top_service_row['service'] if top_service_row else '-'

        conn.close()

        self._send_json({
            'success': True,
            'stats': {
                'total': total,
                'today': today_count,
                'upcoming': upcoming_count,
                'top_service': top_service,
                'today_date': today_str
            }
        })

    def handle_create_booking(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._send_json({'error': 'Data permintaan tidak boleh kosong'}, 400)
            return

        try:
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
        except Exception:
            self._send_json({'error': 'Format JSON tidak valid'}, 400)
            return

        customer_name = str(data.get('customer_name', '')).strip()
        service = str(data.get('service', '')).strip()
        booking_date = str(data.get('booking_date', '')).strip()

        if not customer_name:
            self._send_json({'error': 'Nama pelanggan wajib diisi'}, 400)
            return
        if not service:
            self._send_json({'error': 'Layanan wajib dipilih atau diisi'}, 400)
            return
        if not booking_date:
            self._send_json({'error': 'Tanggal booking wajib diisi'}, 400)
            return

        # Validasi format tanggal YYYY-MM-DD
        try:
            datetime.strptime(booking_date, '%Y-%m-%d')
        except ValueError:
            self._send_json({'error': 'Format tanggal harus YYYY-MM-DD'}, 400)
            return

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO bookings (customer_name, service, booking_date) VALUES (?, ?, ?)',
            (customer_name, service, booking_date)
        )
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()

        self._send_json({
            'success': True,
            'message': 'Booking berhasil ditambahkan',
            'data': {
                'id': new_id,
                'customer_name': customer_name,
                'service': service,
                'booking_date': booking_date
            }
        }, 201)

    def handle_delete_booking(self, booking_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM bookings WHERE id = ?', (booking_id,))
        affected = cursor.rowcount
        conn.commit()
        conn.close()

        if affected > 0:
            self._send_json({'success': True, 'message': f'Booking #{booking_id} berhasil dibatalkan'})
        else:
            self._send_json({'error': f'Booking dengan ID {booking_id} tidak ditemukan'}, 404)

def run(port=8000):
    init_db()
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    server_address = ('', port)
    
    # Enable socket reuse to prevent Address already in use errors on restart
    class ReusableThreadingServer(http.server.ThreadingHTTPServer):
        allow_reuse_address = True

    httpd = ReusableThreadingServer(server_address, BookingRequestHandler)
    print(f"✨ Server Sistem Booking aktif di http://localhost:{port}")
    print(f"Tekan Ctrl+C untuk menghentikan server.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
        httpd.server_close()

if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
