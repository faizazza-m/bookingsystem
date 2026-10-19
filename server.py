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
    
    # Tabel reminders
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

    # Tabel log email (simulasi atau riil)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS email_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reminder_id INTEGER,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE SET NULL
        )
    ''')

    # Migrasi data lama dari tabel bookings (jika ada dan reminders kosong)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='bookings'")
    has_old_bookings = cursor.fetchone() is not None
    if has_old_bookings:
        cursor.execute("SELECT COUNT(*) as count FROM reminders")
        reminders_count = cursor.fetchone()['count']
        if reminders_count == 0:
            cursor.execute("SELECT customer_name, service, booking_date FROM bookings")
            old_rows = cursor.fetchall()
            for r in old_rows:
                cursor.execute(
                    '''INSERT INTO reminders (title, priority, deadline_date, notes) 
                       VALUES (?, ?, ?, ?)''',
                    (f"{r['customer_name']} - {r['service']}", 'Sedang', r['booking_date'], 'Data migrasi dari booking')
                )

    conn.commit()
    conn.close()

class ReminderRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_json(self, data, status_code=200):
        response_body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(response_body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Support both /api/reminders and /api/bookings for backward compatibility
        if path in ('/api/reminders', '/api/bookings'):
            self.handle_get_reminders(query_params)
            return
        elif path == '/api/stats':
            self.handle_get_stats()
            return
        elif path == '/api/email-logs':
            self.handle_get_email_logs()
            return
        
        # Serve static files from PUBLIC_DIR
        super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path in ('/api/reminders', '/api/bookings'):
            self.handle_create_reminder()
            return
        elif path.startswith('/api/reminders/') and path.endswith('/send-email'):
            parts = path.strip('/').split('/')
            try:
                reminder_id = int(parts[2])
                self.handle_send_email(reminder_id)
                return
            except ValueError:
                self._send_json({'error': 'ID reminder tidak valid'}, 400)
                return

        self._send_json({'error': 'Not found'}, 404)

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        parts = path.strip('/').split('/')
        # e.g. /api/reminders/<id>/toggle
        if len(parts) == 4 and parts[0] == 'api' and parts[1] == 'reminders' and parts[3] == 'toggle':
            try:
                reminder_id = int(parts[2])
                self.handle_toggle_completed(reminder_id)
                return
            except ValueError:
                self._send_json({'error': 'ID reminder harus berupa angka'}, 400)
                return
        self._send_json({'error': 'Not found'}, 404)

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        parts = parsed_url.path.strip('/').split('/')
        # e.g. /api/reminders/<id> or /api/bookings/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] in ('reminders', 'bookings'):
            try:
                reminder_id = int(parts[2])
                self.handle_delete_reminder(reminder_id)
                return
            except ValueError:
                self._send_json({'error': 'ID harus berupa angka'}, 400)
                return
        self._send_json({'error': 'Not found'}, 404)

    def handle_get_reminders(self, query_params):
        search = query_params.get('search', [''])[0].strip()
        sort_by = query_params.get('sort', ['id_desc'])[0]
        filter_status = query_params.get('status', ['all'])[0]
        filter_priority = query_params.get('priority', ['all'])[0]

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = 'SELECT id, title, priority, deadline_date, deadline_time, notes, is_completed, created_at FROM reminders WHERE 1=1'
        params = []

        if search:
            sql += ' AND (title LIKE ? OR notes LIKE ? OR deadline_date LIKE ?)'
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param])

        if filter_status == 'pending':
            sql += ' AND is_completed = 0'
        elif filter_status == 'completed':
            sql += ' AND is_completed = 1'

        if filter_priority in ('Tinggi', 'Sedang', 'Rendah'):
            sql += ' AND priority = ?'
            params.append(filter_priority)

        if sort_by == 'date_asc':
            sql += ' ORDER BY deadline_date ASC, deadline_time ASC, id ASC'
        elif sort_by == 'date_desc':
            sql += ' ORDER BY deadline_date DESC, deadline_time DESC, id DESC'
        elif sort_by == 'priority':
            sql += " ORDER BY CASE priority WHEN 'Tinggi' THEN 1 WHEN 'Sedang' THEN 2 WHEN 'Rendah' THEN 3 ELSE 4 END, deadline_date ASC"
        elif sort_by == 'title_asc':
            sql += ' ORDER BY title COLLATE NOCASE ASC'
        else:
            sql += ' ORDER BY is_completed ASC, deadline_date ASC, id DESC'

        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()

        reminders = [
            {
                'id': row['id'],
                'title': row['title'],
                'priority': row['priority'],
                'deadline_date': row['deadline_date'],
                'deadline_time': row['deadline_time'] or '09:00',
                'notes': row['notes'] or '',
                'is_completed': bool(row['is_completed']),
                'created_at': row['created_at'],
                # Backward compatibility keys for frontend
                'customer_name': row['title'],
                'service': row['priority'],
                'booking_date': row['deadline_date']
            }
            for row in rows
        ]
        self._send_json({'success': True, 'data': reminders, 'total': len(reminders)})

    def handle_get_stats(self):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) as total FROM reminders')
        total = cursor.fetchone()['total']

        today_str = date.today().isoformat()
        cursor.execute('SELECT COUNT(*) as today_count FROM reminders WHERE deadline_date = ? AND is_completed = 0', (today_str,))
        today_count = cursor.fetchone()['today_count']

        cursor.execute("SELECT COUNT(*) as high_priority FROM reminders WHERE priority = 'Tinggi' AND is_completed = 0")
        high_priority = cursor.fetchone()['high_priority']

        cursor.execute('SELECT COUNT(*) as completed_count FROM reminders WHERE is_completed = 1')
        completed_count = cursor.fetchone()['completed_count']

        conn.close()

        self._send_json({
            'success': True,
            'stats': {
                'total': total,
                'today': today_count,
                'high_priority': high_priority,
                'completed': completed_count,
                # compatibility
                'upcoming': high_priority,
                'top_service': f"{completed_count} Selesai",
                'today_date': today_str
            }
        })

    def handle_create_reminder(self):
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

        title = str(data.get('title') or data.get('customer_name') or '').strip()
        priority = str(data.get('priority') or data.get('service') or 'Sedang').strip()
        deadline_date = str(data.get('deadline_date') or data.get('booking_date') or '').strip()
        deadline_time = str(data.get('deadline_time') or '09:00').strip()
        notes = str(data.get('notes') or '').strip()

        if not title:
            self._send_json({'error': 'Judul tugas / pengingat wajib diisi'}, 400)
            return
        if not deadline_date:
            self._send_json({'error': 'Tanggal deadline wajib diisi'}, 400)
            return

        # Normalisasi priority jika input dari sistem lama
        if priority not in ('Tinggi', 'Sedang', 'Rendah'):
            priority = 'Sedang'

        # Validasi format tanggal YYYY-MM-DD
        try:
            datetime.strptime(deadline_date, '%Y-%m-%d')
        except ValueError:
            self._send_json({'error': 'Format tanggal harus YYYY-MM-DD'}, 400)
            return

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO reminders (title, priority, deadline_date, deadline_time, notes, is_completed) 
               VALUES (?, ?, ?, ?, ?, 0)''',
            (title, priority, deadline_date, deadline_time, notes)
        )
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()

        self._send_json({
            'success': True,
            'message': f'Pengingat "{title}" berhasil ditambahkan!',
            'data': {
                'id': new_id,
                'title': title,
                'priority': priority,
                'deadline_date': deadline_date,
                'deadline_time': deadline_time,
                'notes': notes,
                'is_completed': False
            }
        }, 201)

    def handle_toggle_completed(self, reminder_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT is_completed, title FROM reminders WHERE id = ?', (reminder_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            self._send_json({'error': 'Pengingat tidak ditemukan'}, 404)
            return

        new_status = 0 if row['is_completed'] == 1 else 1
        cursor.execute('UPDATE reminders SET is_completed = ? WHERE id = ?', (new_status, reminder_id))
        conn.commit()
        conn.close()

        status_text = 'selesai' if new_status == 1 else 'aktif kembali'
        self._send_json({
            'success': True,
            'is_completed': bool(new_status),
            'message': f'Tugas "{row["title"]}" ditandai {status_text}'
        })

    def handle_delete_reminder(self, reminder_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM reminders WHERE id = ?', (reminder_id,))
        affected = cursor.rowcount
        conn.commit()
        conn.close()

        if affected > 0:
            self._send_json({'success': True, 'message': f'Pengingat #{reminder_id} berhasil dihapus'})
        else:
            self._send_json({'error': f'Pengingat #{reminder_id} tidak ditemukan'}, 404)

    def handle_send_email(self, reminder_id):
        content_length = int(self.headers.get('Content-Length', 0))
        recipient = 'azzafazzam13@gmail.com'
        if content_length > 0:
            try:
                body = self.rfile.read(content_length).decode('utf-8')
                data = json.loads(body)
                if data.get('recipient'):
                    recipient = str(data['recipient']).strip()
            except Exception:
                pass

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reminders WHERE id = ?', (reminder_id,))
        reminder = cursor.fetchone()

        if not reminder:
            conn.close()
            self._send_json({'error': 'Pengingat tidak ditemukan'}, 404)
            return

        subject = f"🔔 [Pengingat Deadline: {reminder['priority']}] {reminder['title']}"
        body_content = (
            f"Halo Faiz!\n\n"
            f"Ini adalah pengingat untuk tugas/agenda pribadi Anda:\n"
            f"-----------------------------------------\n"
            f"📌 Judul Tugas  : {reminder['title']}\n"
            f"⚡ Prioritas    : {reminder['priority']}\n"
            f"📅 Tanggal      : {reminder['deadline_date']}\n"
            f"⏰ Waktu/Jam    : {reminder['deadline_time'] or '-'}\n"
            f"📝 Catatan      : {reminder['notes'] or '-'}\n"
            f"-----------------------------------------\n"
            f"Semangat menyelesaikan tugasnya!\n\n"
            f"-- Dikirim otomatis oleh Faiz Personal Reminder (Simulasi Notifikasi)"
        )

        # Simpan ke tabel email_logs sebagai simulasi terkirim
        cursor.execute(
            '''INSERT INTO email_logs (reminder_id, recipient, subject, body, status) 
               VALUES (?, ?, ?, ?, ?)''',
            (reminder_id, recipient, subject, body_content, 'TERKIRIM (SIMULASI)')
        )
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()

        self._send_json({
            'success': True,
            'message': f'Email pengingat berhasil dikirim (simulasi) ke {recipient}!',
            'email_details': {
                'log_id': log_id,
                'recipient': recipient,
                'subject': subject,
                'body': body_content,
                'sent_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
        })

    def handle_get_email_logs(self):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM email_logs ORDER BY id DESC LIMIT 20')
        rows = cursor.fetchall()
        conn.close()

        logs = [
            {
                'id': r['id'],
                'reminder_id': r['reminder_id'],
                'recipient': r['recipient'],
                'subject': r['subject'],
                'body': r['body'],
                'status': r['status'],
                'sent_at': r['sent_at']
            }
            for r in rows
        ]
        self._send_json({'success': True, 'logs': logs})

def run(port=8000):
    init_db()
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    server_address = ('', port)
    
    class ReusableThreadingServer(http.server.ThreadingHTTPServer):
        allow_reuse_address = True

    httpd = ReusableThreadingServer(server_address, ReminderRequestHandler)
    print(f"✨ Server Faiz Personal Reminder aktif di http://localhost:{port}")
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
