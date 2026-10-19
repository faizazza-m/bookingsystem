/**
 * Faiz Reminder - Personal Deadline & Task Manager
 * Client-side Logic (ES6+)
 */

(function () {
    'use strict';

    const MONTH_NAMES = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    // State
    const now = new Date();
    const state = {
        reminders: [],
        currentView: 'table', // 'table' | 'grid' | 'calendar'
        searchQuery: '',
        statusFilter: 'all',  // 'all' | 'pending' | 'completed'
        sortBy: 'date_asc',
        deletingId: null,
        targetEmailReminder: null,
        theme: localStorage.getItem('reminder_theme') || 'light',
        todayDateStr: now.toISOString().split('T')[0],
        calendarYear: now.getFullYear(),
        calendarMonth: now.getMonth(),
        selectedCalendarDate: now.toISOString().split('T')[0]
    };

    // DOM Elements
    const elements = {
        html: document.documentElement,
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        clockTime: document.getElementById('clock-time'),
        clockDate: document.getElementById('clock-date'),

        // Stats
        statTotal: document.getElementById('stat-total'),
        statToday: document.getElementById('stat-today'),
        statUpcoming: document.getElementById('stat-upcoming'),
        statTopService: document.getElementById('stat-top-service'),

        // Toolbar
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        statusFilterSelect: document.getElementById('status-filter-select'),
        sortSelect: document.getElementById('sort-select'),
        viewTableBtn: document.getElementById('view-table-btn'),
        viewGridBtn: document.getElementById('view-grid-btn'),
        viewCalendarBtn: document.getElementById('view-calendar-btn'),
        openAddModalBtn: document.getElementById('open-add-modal-btn'),
        openOutboxBtn: document.getElementById('open-outbox-btn'),

        // Containers
        loadingSpinner: document.getElementById('loading-spinner'),
        emptyState: document.getElementById('empty-state'),
        emptyStateDesc: document.getElementById('empty-state-desc'),
        emptyAddBtn: document.getElementById('empty-add-btn'),
        tableView: document.getElementById('table-view'),
        gridView: document.getElementById('grid-view'),
        calendarView: document.getElementById('calendar-view'),
        bookingsTbody: document.getElementById('bookings-tbody'),

        // Calendar
        calendarMonthYear: document.getElementById('calendar-month-year'),
        calendarMonthTotal: document.getElementById('calendar-month-total'),
        btnPrevMonth: document.getElementById('btn-prev-month'),
        btnNextMonth: document.getElementById('btn-next-month'),
        btnCalToday: document.getElementById('btn-cal-today'),
        calendarDaysContainer: document.getElementById('calendar-days-container'),
        calendarDayDetail: document.getElementById('calendar-day-detail'),
        selectedDateTitle: document.getElementById('selected-date-title'),
        selectedDateBookings: document.getElementById('selected-date-bookings'),
        btnAddOnDate: document.getElementById('btn-add-on-date'),

        // Add Modal & Form
        addModal: document.getElementById('add-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        cancelModalBtn: document.getElementById('cancel-modal-btn'),
        bookingForm: document.getElementById('booking-form'),
        inputCustomerName: document.getElementById('input-customer-name'), // used for Title
        inputService: document.getElementById('input-service'),             // used for Priority
        inputBookingDate: document.getElementById('input-booking-date'),   // used for Deadline Date
        inputDeadlineTime: document.getElementById('input-deadline-time'),
        inputNotes: document.getElementById('input-notes'),
        formError: document.getElementById('form-error'),
        formErrorMsg: document.getElementById('form-error-msg'),
        submitBookingBtn: document.getElementById('submit-booking-btn'),
        priorityPills: document.getElementById('priority-pills'),
        btnDateToday: document.getElementById('btn-date-today'),
        btnDateTomorrow: document.getElementById('btn-date-tomorrow'),
        btnDateNextWeek: document.getElementById('btn-date-nextweek'),

        // Email Modal
        emailModal: document.getElementById('email-modal'),
        closeEmailModalBtn: document.getElementById('close-email-modal-btn'),
        cancelEmailBtn: document.getElementById('cancel-email-btn'),
        confirmSendEmailBtn: document.getElementById('confirm-send-email-btn'),
        emailRecipientInput: document.getElementById('email-recipient-input'),
        emailPreviewSubject: document.getElementById('email-preview-subject'),
        emailPreviewBody: document.getElementById('email-preview-body'),

        // Outbox Modal
        outboxModal: document.getElementById('outbox-modal'),
        closeOutboxModalBtn: document.getElementById('close-outbox-modal-btn'),
        closeOutboxBtn: document.getElementById('close-outbox-btn'),
        emailLogsList: document.getElementById('email-logs-list'),

        // Delete Modal
        deleteModal: document.getElementById('delete-modal'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        deleteConfirmationText: document.getElementById('delete-confirmation-text'),

        // Toast
        toastContainer: document.getElementById('toast-container')
    };

    /* ==========================================================================
       Initialization
       ========================================================================== */
    function init() {
        applyTheme(state.theme);
        startClock();
        initDefaultDate();
        bindEvents();
        fetchData();
    }

    /* ==========================================================================
       Theme Management
       ========================================================================== */
    function applyTheme(theme) {
        state.theme = theme;
        elements.html.setAttribute('data-theme', theme);
        localStorage.setItem('reminder_theme', theme);
    }

    function toggleTheme() {
        const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
    }

    /* ==========================================================================
       Live Clock
       ========================================================================== */
    function startClock() {
        function updateClock() {
            const current = new Date();
            elements.clockTime.textContent = current.toLocaleTimeString('id-ID', { hour12: false });
            elements.clockDate.textContent = current.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    function initDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        elements.inputBookingDate.value = today;
    }

    /* ==========================================================================
       API Calls
       ========================================================================== */
    async function fetchData() {
        elements.loadingSpinner.style.display = 'flex';
        elements.emptyState.style.display = 'none';
        elements.tableView.style.display = 'none';
        elements.gridView.style.display = 'none';
        elements.calendarView.style.display = 'none';

        try {
            await Promise.all([fetchReminders(), fetchStats()]);
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Gagal memuat data dari server', 'error');
        } finally {
            elements.loadingSpinner.style.display = 'none';
            renderReminders();
        }
    }

    async function fetchReminders() {
        const params = new URLSearchParams({
            search: state.searchQuery,
            status: state.statusFilter,
            sort: state.sortBy
        });
        const response = await fetch(`/api/reminders?${params.toString()}`);
        if (!response.ok) throw new Error('Gagal mengambil daftar pengingat');
        const result = await response.json();
        state.reminders = result.data || [];
    }

    async function fetchStats() {
        const response = await fetch('/api/stats');
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.stats) {
            elements.statTotal.textContent = result.stats.total;
            elements.statToday.textContent = result.stats.today;
            elements.statUpcoming.textContent = result.stats.high_priority;
            elements.statTopService.textContent = result.stats.completed;
            state.todayDateStr = result.stats.today_date;
        }
    }

    async function toggleCompleted(id) {
        try {
            const response = await fetch(`/api/reminders/${id}/toggle`, { method: 'PUT' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal mengubah status tugas');
            showToast(data.message, 'success');
            await fetchData();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function submitReminder(formData) {
        setSubmitLoading(true);
        hideFormError();

        try {
            const response = await fetch('/api/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal menambahkan pengingat');
            }

            closeAddModal();
            showToast(`Pengingat "${formData.title}" berhasil disimpan!`, 'success');
            await fetchData();
        } catch (err) {
            showFormError(err.message);
        } finally {
            setSubmitLoading(false);
        }
    }

    async function deleteReminder(id) {
        try {
            elements.confirmDeleteBtn.disabled = true;
            elements.confirmDeleteBtn.textContent = 'Menghapus...';

            const response = await fetch(`/api/reminders/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal menghapus pengingat');
            }

            closeDeleteModal();
            showToast(`Pengingat #${id} berhasil dihapus`, 'success');
            await fetchData();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            elements.confirmDeleteBtn.disabled = false;
            elements.confirmDeleteBtn.textContent = 'Ya, Hapus';
        }
    }

    async function sendEmailNotification(id, recipient) {
        try {
            elements.confirmSendEmailBtn.disabled = true;
            elements.confirmSendEmailBtn.textContent = 'Mengirim...';

            const response = await fetch(`/api/reminders/${id}/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: recipient })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal mengirim email');

            closeEmailModal();
            showToast(data.message, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            elements.confirmSendEmailBtn.disabled = false;
            elements.confirmSendEmailBtn.textContent = 'Kirim Email Sekarang 🚀';
        }
    }

    async function loadEmailLogs() {
        elements.emailLogsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Memuat riwayat...</p>';
        try {
            const res = await fetch('/api/email-logs');
            const data = await res.json();
            if (!res.ok) throw new Error('Gagal memuat log email');

            if (!data.logs || data.logs.length === 0) {
                elements.emailLogsList.innerHTML = `
                    <div class="empty-day-message">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        </svg>
                        <p>Belum ada email yang dikirimkan. Coba klik tombol email 📧 pada salah satu tugas!</p>
                    </div>
                `;
                return;
            }

            elements.emailLogsList.innerHTML = '';
            data.logs.forEach(log => {
                const card = document.createElement('div');
                card.className = 'email-log-card';
                card.innerHTML = `
                    <div class="log-header">
                        <span class="log-status-badge">✓ ${escapeHtml(log.status)}</span>
                        <span style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(log.sent_at)}</span>
                    </div>
                    <div class="log-subject">${escapeHtml(log.subject)}</div>
                    <div class="log-recipient">Tujuan: <strong>${escapeHtml(log.recipient)}</strong></div>
                `;
                elements.emailLogsList.appendChild(card);
            });
        } catch (err) {
            elements.emailLogsList.innerHTML = `<p style="color: var(--neo-red); text-align: center;">${err.message}</p>`;
        }
    }

    /* ==========================================================================
       Rendering & Views
       ========================================================================== */
    function renderReminders() {
        const count = state.reminders.length;

        if (state.currentView === 'calendar') {
            elements.emptyState.style.display = 'none';
            elements.tableView.style.display = 'none';
            elements.gridView.style.display = 'none';
            elements.calendarView.style.display = 'grid';
            renderCalendar();
            return;
        }

        elements.calendarView.style.display = 'none';

        if (count === 0) {
            elements.tableView.style.display = 'none';
            elements.gridView.style.display = 'none';
            elements.emptyState.style.display = 'block';

            if (state.searchQuery || state.statusFilter !== 'all') {
                elements.emptyStateDesc.textContent = `Tidak ditemukan pengingat yang cocok dengan kriteria pencarian/filter.`;
            } else {
                elements.emptyStateDesc.textContent = 'Semua agenda bersih! Klik tombol di bawah untuk membuat pengingat deadline baru.';
            }
            return;
        }

        elements.emptyState.style.display = 'none';

        if (state.currentView === 'table') {
            elements.gridView.style.display = 'none';
            elements.tableView.style.display = 'block';
            renderTable();
        } else if (state.currentView === 'grid') {
            elements.tableView.style.display = 'none';
            elements.gridView.style.display = 'grid';
            renderGrid();
        }
    }

    function renderTable() {
        elements.bookingsTbody.innerHTML = '';

        state.reminders.forEach((item) => {
            const tr = document.createElement('tr');
            if (item.is_completed) tr.classList.add('is-completed');

            const statusInfo = getDeadlineStatus(item.deadline_date, item.is_completed);
            const priorityBadge = getPriorityBadgeHtml(item.priority);
            const formattedDate = formatIndonesianDate(item.deadline_date);

            tr.innerHTML = `
                <td style="text-align: center;">
                    <div class="todo-checkbox-wrapper">
                        <input type="checkbox" class="todo-checkbox" ${item.is_completed ? 'checked' : ''} title="Tandai selesai / belum">
                    </div>
                </td>
                <td>
                    <div class="reminder-title-cell">
                        <span class="reminder-title">${escapeHtml(item.title)}</span>
                        ${item.notes ? `<span class="reminder-notes">${escapeHtml(item.notes)}</span>` : ''}
                    </div>
                </td>
                <td>${priorityBadge}</td>
                <td>
                    <div style="font-weight: 700; font-size: 0.88rem;">${formattedDate}</div>
                    <small style="color: var(--text-muted); font-weight: 700;">⏰ ${item.deadline_time || '09:00'} WIB</small>
                </td>
                <td>
                    <span class="badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span>
                </td>
                <td style="text-align: center;">
                    <div class="table-actions-cell">
                        <button type="button" class="btn-icon-email" title="Kirim email notifikasi">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </button>
                        <button type="button" class="btn-icon-danger" title="Hapus pengingat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            `;

            // Checkbox Toggle
            const checkbox = tr.querySelector('.todo-checkbox');
            checkbox.addEventListener('change', () => toggleCompleted(item.id));

            // Email Button
            const emailBtn = tr.querySelector('.btn-icon-email');
            emailBtn.addEventListener('click', () => openEmailModal(item));

            // Delete Button
            const deleteBtn = tr.querySelector('.btn-icon-danger');
            deleteBtn.addEventListener('click', () => openDeleteModal(item.id, item.title));

            elements.bookingsTbody.appendChild(tr);
        });
    }

    function renderGrid() {
        elements.gridView.innerHTML = '';

        state.reminders.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'booking-card';
            if (item.is_completed) card.style.opacity = '0.7';

            const statusInfo = getDeadlineStatus(item.deadline_date, item.is_completed);
            const priorityBadge = getPriorityBadgeHtml(item.priority);
            const formattedDate = formatIndonesianDate(item.deadline_date);

            card.innerHTML = `
                <div class="booking-card-header">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <input type="checkbox" class="todo-checkbox" ${item.is_completed ? 'checked' : ''} title="Tandai selesai">
                        <div>
                            <div class="reminder-title" style="${item.is_completed ? 'text-decoration: line-through;' : ''}">${escapeHtml(item.title)}</div>
                            <small style="color: var(--text-muted); font-weight: 700;">#${item.id}</small>
                        </div>
                    </div>
                    ${priorityBadge}
                </div>

                <div class="booking-card-body">
                    ${item.notes ? `<div class="reminder-notes" style="background: rgba(0,0,0,0.03); padding: 0.5rem; border: 1px dashed #000; border-radius: 4px;">${escapeHtml(item.notes)}</div>` : ''}
                    <div class="card-date-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${formattedDate} • ⏰ ${item.deadline_time || '09:00'}</span>
                    </div>
                </div>

                <div class="booking-card-footer">
                    <span class="badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span>
                    <div style="display: flex; gap: 0.4rem;">
                        <button type="button" class="btn-icon-email" title="Kirim email notifikasi">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </button>
                        <button type="button" class="btn-icon-danger" title="Hapus pengingat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            card.querySelector('.todo-checkbox').addEventListener('change', () => toggleCompleted(item.id));
            card.querySelector('.btn-icon-email').addEventListener('click', () => openEmailModal(item));
            card.querySelector('.btn-icon-danger').addEventListener('click', () => openDeleteModal(item.id, item.title));

            elements.gridView.appendChild(card);
        });
    }

    /* ==========================================================================
       Interactive Calendar Logic
       ========================================================================== */
    function renderCalendar() {
        const year = state.calendarYear;
        const month = state.calendarMonth;

        elements.calendarMonthYear.textContent = `${MONTH_NAMES[month]} ${year}`;

        const remindersMap = new Map();
        let monthRemindersCount = 0;
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

        state.reminders.forEach((r) => {
            if (!remindersMap.has(r.deadline_date)) {
                remindersMap.set(r.deadline_date, []);
            }
            remindersMap.get(r.deadline_date).push(r);
            if (r.deadline_date.startsWith(currentMonthPrefix)) {
                monthRemindersCount++;
            }
        });

        elements.calendarMonthTotal.textContent = `${monthRemindersCount} tugas bulan ini`;

        const firstDayDate = new Date(year, month, 1);
        const startDayIndex = (firstDayDate.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        elements.calendarDaysContainer.innerHTML = '';

        // Prev month trailing
        for (let i = startDayIndex - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevMonthDate = new Date(year, month - 1, dayNum);
            const dateStr = formatDateString(prevMonthDate);
            appendCalendarCell(dayNum, dateStr, true, remindersMap.get(dateStr) || []);
        }

        // Current month
        for (let day = 1; day <= daysInMonth; day++) {
            const currDate = new Date(year, month, day);
            const dateStr = formatDateString(currDate);
            appendCalendarCell(day, dateStr, false, remindersMap.get(dateStr) || []);
        }

        // Next month leading
        const totalRendered = startDayIndex + daysInMonth;
        const remainingCells = (7 - (totalRendered % 7)) % 7;
        for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
            const nextMonthDate = new Date(year, month + 1, nextDay);
            const dateStr = formatDateString(nextMonthDate);
            appendCalendarCell(nextDay, dateStr, true, remindersMap.get(dateStr) || []);
        }

        renderSelectedDateDetails();
    }

    function appendCalendarCell(dayNumber, dateStr, isOtherMonth, dayReminders) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';

        if (isOtherMonth) cell.classList.add('is-other-month');
        if (dateStr === state.todayDateStr) cell.classList.add('is-today');
        if (dateStr === state.selectedCalendarDate) cell.classList.add('is-selected');

        const count = dayReminders.length;
        const countHtml = count > 0 ? `<span class="day-booking-count">${count}</span>` : '';

        let chipsHtml = '';
        let dotsHtml = '';
        if (count > 0) {
            chipsHtml = '<div class="day-bookings-list">';
            const displayList = dayReminders.slice(0, 2);
            displayList.forEach(r => {
                const dotColor = r.priority === 'Tinggi' ? 'var(--neo-red)' : (r.priority === 'Sedang' ? 'var(--neo-yellow)' : 'var(--neo-green)');
                chipsHtml += `<div class="day-chip" style="border-left-color: ${dotColor};" title="${escapeHtml(r.title)} (${escapeHtml(r.priority)})">${escapeHtml(r.title)}</div>`;
            });
            if (count > 2) {
                chipsHtml += `<div class="day-more-chip">+${count - 2} lagi</div>`;
            }
            chipsHtml += '</div>';

            dotsHtml = '<div class="day-event-dots">';
            const dotCount = Math.min(count, 3);
            for (let i = 0; i < dotCount; i++) {
                const r = dayReminders[i];
                const dotBg = r && r.priority === 'Tinggi' ? 'var(--neo-red)' : (r && r.priority === 'Sedang' ? 'var(--neo-yellow)' : 'var(--neo-green)');
                dotsHtml += `<span class="event-dot" style="background: ${dotBg};"></span>`;
            }
            dotsHtml += '</div>';
        }

        cell.innerHTML = `
            <div class="day-cell-header">
                <span class="day-number">${dayNumber}</span>
                ${countHtml}
            </div>
            ${chipsHtml}
            ${dotsHtml}
        `;

        cell.addEventListener('click', () => {
            state.selectedCalendarDate = dateStr;
            const allCells = elements.calendarDaysContainer.querySelectorAll('.calendar-day-cell');
            allCells.forEach(c => c.classList.remove('is-selected'));
            cell.classList.add('is-selected');
            renderSelectedDateDetails();

            if (window.innerWidth <= 768 && elements.calendarDayDetail) {
                elements.calendarDayDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        elements.calendarDaysContainer.appendChild(cell);
    }

    function renderSelectedDateDetails() {
        const selectedStr = state.selectedCalendarDate;
        elements.selectedDateTitle.textContent = formatIndonesianDate(selectedStr);

        const dayReminders = state.reminders.filter(r => r.deadline_date === selectedStr);
        elements.selectedDateBookings.innerHTML = '';

        if (dayReminders.length === 0) {
            elements.selectedDateBookings.innerHTML = `
                <div class="empty-day-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Tidak ada pengingat deadline pada tanggal ini.</p>
                </div>
            `;
            return;
        }

        dayReminders.forEach(item => {
            const card = document.createElement('div');
            card.className = 'detail-booking-card';

            const priorityBadge = getPriorityBadgeHtml(item.priority);

            card.innerHTML = `
                <div class="detail-booking-info">
                    <input type="checkbox" class="todo-checkbox" ${item.is_completed ? 'checked' : ''} title="Tandai selesai">
                    <div>
                        <div class="detail-booking-name" style="${item.is_completed ? 'text-decoration: line-through;' : ''}">${escapeHtml(item.title)}</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;">⏰ ${item.deadline_time || '09:00'} • ${priorityBadge}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.35rem;">
                    <button type="button" class="btn-icon-email" title="Kirim email notifikasi">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    </button>
                    <button type="button" class="btn-icon-danger" title="Hapus pengingat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            card.querySelector('.todo-checkbox').addEventListener('change', () => toggleCompleted(item.id));
            card.querySelector('.btn-icon-email').addEventListener('click', () => openEmailModal(item));
            card.querySelector('.btn-icon-danger').addEventListener('click', () => openDeleteModal(item.id, item.title));

            elements.selectedDateBookings.appendChild(card);
        });
    }

    /* ==========================================================================
       Helpers
       ========================================================================== */
    function getDeadlineStatus(deadlineDateStr, isCompleted) {
        if (isCompleted) {
            return { label: '✓ Selesai', badgeClass: 'badge-today' };
        }
        const todayStr = state.todayDateStr || new Date().toISOString().split('T')[0];
        if (deadlineDateStr === todayStr) {
            return { label: 'Hari Ini!', badgeClass: 'badge-today' };
        } else if (deadlineDateStr < todayStr) {
            return { label: 'Terlewat', badgeClass: 'badge-passed' };
        } else {
            return { label: 'Mendatang', badgeClass: 'badge-upcoming' };
        }
    }

    function getPriorityBadgeHtml(priority) {
        if (priority === 'Tinggi') {
            return '<span class="badge-priority-high">🔴 Tinggi</span>';
        } else if (priority === 'Rendah') {
            return '<span class="badge-priority-low">🟢 Rendah</span>';
        }
        return '<span class="badge-priority-medium">🟡 Sedang</span>';
    }

    function formatIndonesianDate(dateString) {
        try {
            const [year, month, day] = dateString.split('-');
            const d = new Date(year, month - 1, day);
            return d.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    function formatDateString(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ==========================================================================
       Modals & Toast
       ========================================================================== */
    function openAddModal(prefilledDate = null) {
        elements.bookingForm.reset();
        hideFormError();
        setPriorityPill('Sedang');

        if (prefilledDate) {
            elements.inputBookingDate.value = prefilledDate;
        } else {
            initDefaultDate();
        }

        elements.inputDeadlineTime.value = '09:00';
        elements.addModal.classList.add('active');
        elements.addModal.setAttribute('aria-hidden', 'false');
        setTimeout(() => elements.inputCustomerName.focus(), 100);
    }

    function closeAddModal() {
        elements.addModal.classList.remove('active');
        elements.addModal.setAttribute('aria-hidden', 'true');
    }

    function openDeleteModal(id, title) {
        state.deletingId = id;
        elements.deleteConfirmationText.innerHTML = `Apakah Anda yakin ingin menghapus pengingat <strong>${escapeHtml(title)}</strong> (ID #${id})?`;
        elements.deleteModal.classList.add('active');
        elements.deleteModal.setAttribute('aria-hidden', 'false');
    }

    function closeDeleteModal() {
        state.deletingId = null;
        elements.deleteModal.classList.remove('active');
        elements.deleteModal.setAttribute('aria-hidden', 'true');
    }

    function openEmailModal(reminder) {
        state.targetEmailReminder = reminder;
        elements.emailPreviewSubject.textContent = `🔔 [Pengingat: ${reminder.priority}] ${reminder.title}`;
        elements.emailPreviewBody.textContent = 
`Halo Faiz!

Ini adalah pengingat untuk tugas Anda:
-----------------------------------------
📌 Judul Tugas  : ${reminder.title}
⚡ Prioritas    : ${reminder.priority}
📅 Deadline     : ${reminder.deadline_date}
⏰ Jam          : ${reminder.deadline_time || '09:00'} WIB
📝 Catatan      : ${reminder.notes || '-'}
-----------------------------------------
Semangat menyelesaikan tugasnya!`;

        elements.emailModal.classList.add('active');
        elements.emailModal.setAttribute('aria-hidden', 'false');
    }

    function closeEmailModal() {
        state.targetEmailReminder = null;
        elements.emailModal.classList.remove('active');
        elements.emailModal.setAttribute('aria-hidden', 'true');
    }

    function openOutboxModal() {
        elements.outboxModal.classList.add('active');
        elements.outboxModal.setAttribute('aria-hidden', 'false');
        loadEmailLogs();
    }

    function closeOutboxModal() {
        elements.outboxModal.classList.remove('active');
        elements.outboxModal.setAttribute('aria-hidden', 'true');
    }

    function showFormError(msg) {
        elements.formErrorMsg.textContent = msg;
        elements.formError.style.display = 'flex';
    }

    function hideFormError() {
        elements.formError.style.display = 'none';
    }

    function setSubmitLoading(isLoading) {
        elements.submitBookingBtn.disabled = isLoading;
        const textSpan = elements.submitBookingBtn.querySelector('.btn-text');
        const spinner = elements.submitBookingBtn.querySelector('.btn-spinner');
        if (isLoading) {
            textSpan.textContent = 'Menyimpan...';
            spinner.style.display = 'inline-block';
        } else {
            textSpan.textContent = 'Simpan Pengingat';
            spinner.style.display = 'none';
        }
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSvg = type === 'success'
            ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function setPriorityPill(priority) {
        elements.inputService.value = priority;
        const pills = elements.priorityPills.querySelectorAll('.pill-badge');
        pills.forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-priority') === priority);
        });
    }

    function setQuickDate(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        elements.inputBookingDate.value = formatDateString(d);
    }

    function switchView(viewName) {
        state.currentView = viewName;
        elements.viewTableBtn.classList.toggle('active', viewName === 'table');
        elements.viewTableBtn.setAttribute('aria-pressed', viewName === 'table');

        elements.viewGridBtn.classList.toggle('active', viewName === 'grid');
        elements.viewGridBtn.setAttribute('aria-pressed', viewName === 'grid');

        elements.viewCalendarBtn.classList.toggle('active', viewName === 'calendar');
        elements.viewCalendarBtn.setAttribute('aria-pressed', viewName === 'calendar');

        renderReminders();
    }

    /* ==========================================================================
       Event Listeners
       ========================================================================== */
    function bindEvents() {
        // Theme toggle
        elements.themeToggleBtn.addEventListener('click', toggleTheme);

        // Search with debounce
        let searchTimeout;
        elements.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            elements.clearSearchBtn.style.display = query ? 'block' : 'none';
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                state.searchQuery = query;
                await fetchReminders();
                renderReminders();
            }, 300);
        });

        elements.clearSearchBtn.addEventListener('click', async () => {
            elements.searchInput.value = '';
            elements.clearSearchBtn.style.display = 'none';
            state.searchQuery = '';
            await fetchReminders();
            renderReminders();
        });

        // Status Filter
        elements.statusFilterSelect.addEventListener('change', async (e) => {
            state.statusFilter = e.target.value;
            await fetchReminders();
            renderReminders();
        });

        // Sort
        elements.sortSelect.addEventListener('change', async (e) => {
            state.sortBy = e.target.value;
            await fetchReminders();
            renderReminders();
        });

        // View toggle buttons
        elements.viewTableBtn.addEventListener('click', () => switchView('table'));
        elements.viewGridBtn.addEventListener('click', () => switchView('grid'));
        elements.viewCalendarBtn.addEventListener('click', () => switchView('calendar'));

        // Calendar Navigation
        elements.btnPrevMonth.addEventListener('click', () => {
            state.calendarMonth--;
            if (state.calendarMonth < 0) {
                state.calendarMonth = 11;
                state.calendarYear--;
            }
            renderCalendar();
        });

        elements.btnNextMonth.addEventListener('click', () => {
            state.calendarMonth++;
            if (state.calendarMonth > 11) {
                state.calendarMonth = 0;
                state.calendarYear++;
            }
            renderCalendar();
        });

        elements.btnCalToday.addEventListener('click', () => {
            const today = new Date();
            state.calendarMonth = today.getMonth();
            state.calendarYear = today.getFullYear();
            state.selectedCalendarDate = formatDateString(today);
            renderCalendar();
        });

        // Calendar +Pengingat shortcut
        elements.btnAddOnDate.addEventListener('click', () => {
            openAddModal(state.selectedCalendarDate);
        });

        // Modal triggers
        elements.openAddModalBtn.addEventListener('click', () => openAddModal());
        elements.emptyAddBtn.addEventListener('click', () => openAddModal());
        elements.closeModalBtn.addEventListener('click', closeAddModal);
        elements.cancelModalBtn.addEventListener('click', closeAddModal);

        // Outbox modal triggers
        elements.openOutboxBtn.addEventListener('click', openOutboxModal);
        elements.closeOutboxModalBtn.addEventListener('click', closeOutboxModal);
        elements.closeOutboxBtn.addEventListener('click', closeOutboxModal);

        // Email modal triggers
        elements.closeEmailModalBtn.addEventListener('click', closeEmailModal);
        elements.cancelEmailBtn.addEventListener('click', closeEmailModal);
        elements.confirmSendEmailBtn.addEventListener('click', () => {
            if (state.targetEmailReminder) {
                const recipient = elements.emailRecipientInput.value.trim() || 'faizfaqot23@gmail.com';
                sendEmailNotification(state.targetEmailReminder.id, recipient);
            }
        });

        // Click outside modal to close
        [elements.addModal, elements.deleteModal, elements.emailModal, elements.outboxModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.remove('active');
                        modal.setAttribute('aria-hidden', 'true');
                    }
                });
            }
        });

        // ESC key to close modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAddModal();
                closeDeleteModal();
                closeEmailModal();
                closeOutboxModal();
            }
        });

        // Priority Pills selection
        elements.priorityPills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill-badge');
            if (!pill) return;
            const priority = pill.getAttribute('data-priority');
            setPriorityPill(priority);
        });

        // Quick date buttons
        elements.btnDateToday.addEventListener('click', () => setQuickDate(0));
        elements.btnDateTomorrow.addEventListener('click', () => setQuickDate(1));
        elements.btnDateNextWeek.addEventListener('click', () => setQuickDate(7));

        // Form submission
        elements.bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = elements.inputCustomerName.value.trim();
            const priority = elements.inputService.value.trim() || 'Sedang';
            const deadlineDate = elements.inputBookingDate.value.trim();
            const deadlineTime = elements.inputDeadlineTime.value.trim() || '09:00';
            const notes = elements.inputNotes.value.trim();

            if (!title || !deadlineDate) {
                showFormError('Judul tugas dan tanggal deadline wajib diisi.');
                return;
            }

            await submitReminder({
                title: title,
                priority: priority,
                deadline_date: deadlineDate,
                deadline_time: deadlineTime,
                notes: notes
            });
        });

        // Delete modal actions
        elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        elements.confirmDeleteBtn.addEventListener('click', () => {
            if (state.deletingId) {
                deleteReminder(state.deletingId);
            }
        });

        // PWA Install Prompt
        setupPWAInstall();
    }

    /* ==========================================================================
       PWA Service Worker & Install Support
       ========================================================================== */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((reg) => console.log('PWA Service Worker terdaftar:', reg.scope))
                    .catch((err) => console.warn('PWA SW gagal didaftarkan:', err));
            });
        }
    }

    let deferredPrompt = null;
    function setupPWAInstall() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (!installBtn) return;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'inline-flex';
        });

        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                showToast('Aplikasi berhasil dipasang di layar utama!', 'success');
            }
            deferredPrompt = null;
            installBtn.style.display = 'none';
        });

        window.addEventListener('appinstalled', () => {
            installBtn.style.display = 'none';
            deferredPrompt = null;
            showToast('Aplikasi Faiz Reminder sudah terpasang!', 'success');
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            registerServiceWorker();
        });
    } else {
        init();
        registerServiceWorker();
    }
})();
