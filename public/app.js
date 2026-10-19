/**
 * Sistem Booking Modern - Client-side Logic with Interactive Calendar
 * Vanilla JavaScript ES6+
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
        bookings: [],
        currentView: 'table', // 'table' | 'grid' | 'calendar'
        searchQuery: '',
        sortBy: 'id_desc',
        deletingId: null,
        theme: localStorage.getItem('booking_app_theme') || 'light',
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
        sortSelect: document.getElementById('sort-select'),
        viewTableBtn: document.getElementById('view-table-btn'),
        viewGridBtn: document.getElementById('view-grid-btn'),
        viewCalendarBtn: document.getElementById('view-calendar-btn'),
        openAddModalBtn: document.getElementById('open-add-modal-btn'),

        // Containers
        loadingSpinner: document.getElementById('loading-spinner'),
        emptyState: document.getElementById('empty-state'),
        emptyStateDesc: document.getElementById('empty-state-desc'),
        emptyAddBtn: document.getElementById('empty-add-btn'),
        tableView: document.getElementById('table-view'),
        gridView: document.getElementById('grid-view'),
        calendarView: document.getElementById('calendar-view'),
        bookingsTbody: document.getElementById('bookings-tbody'),

        // Calendar Controls & Elements
        calendarMonthYear: document.getElementById('calendar-month-year'),
        calendarMonthTotal: document.getElementById('calendar-month-total'),
        btnPrevMonth: document.getElementById('btn-prev-month'),
        btnNextMonth: document.getElementById('btn-next-month'),
        btnCalToday: document.getElementById('btn-cal-today'),
        calendarDaysContainer: document.getElementById('calendar-days-container'),
        selectedDateTitle: document.getElementById('selected-date-title'),
        selectedDateBookings: document.getElementById('selected-date-bookings'),
        btnAddOnDate: document.getElementById('btn-add-on-date'),

        // Add Modal & Form
        addModal: document.getElementById('add-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        cancelModalBtn: document.getElementById('cancel-modal-btn'),
        bookingForm: document.getElementById('booking-form'),
        inputCustomerName: document.getElementById('input-customer-name'),
        inputService: document.getElementById('input-service'),
        inputBookingDate: document.getElementById('input-booking-date'),
        formError: document.getElementById('form-error'),
        formErrorMsg: document.getElementById('form-error-msg'),
        submitBookingBtn: document.getElementById('submit-booking-btn'),
        servicePills: document.getElementById('service-pills'),
        btnDateToday: document.getElementById('btn-date-today'),
        btnDateTomorrow: document.getElementById('btn-date-tomorrow'),
        btnDateNextWeek: document.getElementById('btn-date-nextweek'),

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
        localStorage.setItem('booking_app_theme', theme);
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
            await Promise.all([fetchBookings(), fetchStats()]);
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Gagal memuat data dari server', 'error');
        } finally {
            elements.loadingSpinner.style.display = 'none';
            renderBookings();
        }
    }

    async function fetchBookings() {
        const params = new URLSearchParams({
            search: state.searchQuery,
            sort: state.sortBy
        });
        const response = await fetch(`/api/bookings?${params.toString()}`);
        if (!response.ok) throw new Error('Gagal mengambil daftar booking');
        const result = await response.json();
        state.bookings = result.data || [];
    }

    async function fetchStats() {
        const response = await fetch('/api/stats');
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.stats) {
            elements.statTotal.textContent = result.stats.total;
            elements.statToday.textContent = result.stats.today;
            elements.statUpcoming.textContent = result.stats.upcoming;
            elements.statTopService.textContent = result.stats.top_service || '-';
            state.todayDateStr = result.stats.today_date;
        }
    }

    async function submitBooking(formData) {
        setSubmitLoading(true);
        hideFormError();

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Gagal menambahkan booking');
            }

            closeAddModal();
            showToast(`Booking untuk "${formData.customer_name}" berhasil dibuat!`, 'success');
            await fetchData();
        } catch (err) {
            showFormError(err.message);
        } finally {
            setSubmitLoading(false);
        }
    }

    async function deleteBooking(id) {
        try {
            elements.confirmDeleteBtn.disabled = true;
            elements.confirmDeleteBtn.textContent = 'Menghapus...';

            const response = await fetch(`/api/bookings/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal membatalkan booking');
            }

            closeDeleteModal();
            showToast(`Booking #${id} berhasil dibatalkan`, 'success');
            await fetchData();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            elements.confirmDeleteBtn.disabled = false;
            elements.confirmDeleteBtn.textContent = 'Ya, Batalkan';
        }
    }

    /* ==========================================================================
       Rendering & Views
       ========================================================================== */
    function renderBookings() {
        const count = state.bookings.length;

        // If in calendar view, always show calendar even when bookings = 0
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

            if (state.searchQuery) {
                elements.emptyStateDesc.textContent = `Tidak ditemukan booking yang sesuai kata kunci "${state.searchQuery}".`;
            } else {
                elements.emptyStateDesc.textContent = 'Belum ada booking yang tercatat. Klik tombol di bawah untuk membuat reservasi baru.';
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

        state.bookings.forEach((item) => {
            const tr = document.createElement('tr');
            const statusInfo = getStatusInfo(item.booking_date);
            const initials = getInitials(item.customer_name);
            const formattedDate = formatIndonesianDate(item.booking_date);

            tr.innerHTML = `
                <td style="font-weight: 700; color: var(--text-muted);">#${item.id}</td>
                <td>
                    <div class="customer-cell">
                        <div class="avatar-circle" title="${escapeHtml(item.customer_name)}">${initials}</div>
                        <span class="customer-name">${escapeHtml(item.customer_name)}</span>
                    </div>
                </td>
                <td>
                    <span class="service-tag">${escapeHtml(item.service)}</span>
                </td>
                <td>
                    <span style="font-weight: 500;">${formattedDate}</span>
                </td>
                <td>
                    <span class="badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-icon-danger" data-id="${item.id}" title="Batalkan booking">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            `;

            const deleteBtn = tr.querySelector('.btn-icon-danger');
            deleteBtn.addEventListener('click', () => openDeleteModal(item.id, item.customer_name));

            elements.bookingsTbody.appendChild(tr);
        });
    }

    function renderGrid() {
        elements.gridView.innerHTML = '';

        state.bookings.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'booking-card';

            const statusInfo = getStatusInfo(item.booking_date);
            const initials = getInitials(item.customer_name);
            const formattedDate = formatIndonesianDate(item.booking_date);

            card.innerHTML = `
                <div class="booking-card-header">
                    <div class="customer-cell">
                        <div class="avatar-circle">${initials}</div>
                        <div>
                            <div class="customer-name">${escapeHtml(item.customer_name)}</div>
                            <small style="color: var(--text-muted);">ID Booking #${item.id}</small>
                        </div>
                    </div>
                    <span class="badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span>
                </div>

                <div class="booking-card-body">
                    <div class="card-service-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                            <polyline points="2 17 12 22 22 17"></polyline>
                        </svg>
                        <span>${escapeHtml(item.service)}</span>
                    </div>
                    <div class="card-date-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${formattedDate}</span>
                    </div>
                </div>

                <div class="booking-card-footer">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${item.booking_date}</span>
                    <button type="button" class="btn-icon-danger" title="Batalkan booking">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            const deleteBtn = card.querySelector('.btn-icon-danger');
            deleteBtn.addEventListener('click', () => openDeleteModal(item.id, item.customer_name));

            elements.gridView.appendChild(card);
        });
    }

    /* ==========================================================================
       Interactive Calendar Logic
       ========================================================================== */
    function renderCalendar() {
        const year = state.calendarYear;
        const month = state.calendarMonth;

        // Month Title
        elements.calendarMonthYear.textContent = `${MONTH_NAMES[month]} ${year}`;

        // Map bookings by date string YYYY-MM-DD
        const bookingsMap = new Map();
        let monthBookingsCount = 0;
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

        state.bookings.forEach((b) => {
            if (!bookingsMap.has(b.booking_date)) {
                bookingsMap.set(b.booking_date, []);
            }
            bookingsMap.get(b.booking_date).push(b);
            if (b.booking_date.startsWith(currentMonthPrefix)) {
                monthBookingsCount++;
            }
        });

        elements.calendarMonthTotal.textContent = `${monthBookingsCount} booking di bulan ini`;

        // Calculate days
        const firstDayDate = new Date(year, month, 1);
        // Monday=0 ... Sunday=6
        const startDayIndex = (firstDayDate.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        elements.calendarDaysContainer.innerHTML = '';

        // Previous Month Trailing Days
        for (let i = startDayIndex - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevMonthDate = new Date(year, month - 1, dayNum);
            const dateStr = formatDateString(prevMonthDate);
            appendCalendarCell(dayNum, dateStr, true, bookingsMap.get(dateStr) || []);
        }

        // Current Month Days
        for (let day = 1; day <= daysInMonth; day++) {
            const currDate = new Date(year, month, day);
            const dateStr = formatDateString(currDate);
            appendCalendarCell(day, dateStr, false, bookingsMap.get(dateStr) || []);
        }

        // Next Month Leading Days to fill grid rows (multiple of 7)
        const totalRendered = startDayIndex + daysInMonth;
        const remainingCells = (7 - (totalRendered % 7)) % 7;
        for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
            const nextMonthDate = new Date(year, month + 1, nextDay);
            const dateStr = formatDateString(nextMonthDate);
            appendCalendarCell(nextDay, dateStr, true, bookingsMap.get(dateStr) || []);
        }

        // Render selected day detail
        renderSelectedDateDetails();
    }

    function appendCalendarCell(dayNumber, dateStr, isOtherMonth, dayBookings) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';

        if (isOtherMonth) cell.classList.add('is-other-month');
        if (dateStr === state.todayDateStr) cell.classList.add('is-today');
        if (dateStr === state.selectedCalendarDate) cell.classList.add('is-selected');

        const count = dayBookings.length;
        const countHtml = count > 0 ? `<span class="day-booking-count">${count}</span>` : '';

        let chipsHtml = '';
        if (count > 0) {
            chipsHtml = '<div class="day-bookings-list">';
            const displayList = dayBookings.slice(0, 2);
            displayList.forEach(b => {
                chipsHtml += `<div class="day-chip" title="${escapeHtml(b.customer_name)} - ${escapeHtml(b.service)}">${escapeHtml(b.customer_name)}</div>`;
            });
            if (count > 2) {
                chipsHtml += `<div class="day-more-chip">+${count - 2} lagi</div>`;
            }
            chipsHtml += '</div>';
        }

        cell.innerHTML = `
            <div class="day-cell-header">
                <span class="day-number">${dayNumber}</span>
                ${countHtml}
            </div>
            ${chipsHtml}
        `;

        cell.addEventListener('click', () => {
            state.selectedCalendarDate = dateStr;
            const allCells = elements.calendarDaysContainer.querySelectorAll('.calendar-day-cell');
            allCells.forEach(c => c.classList.remove('is-selected'));
            cell.classList.add('is-selected');
            renderSelectedDateDetails();
        });

        elements.calendarDaysContainer.appendChild(cell);
    }

    function renderSelectedDateDetails() {
        const selectedStr = state.selectedCalendarDate;
        elements.selectedDateTitle.textContent = formatIndonesianDate(selectedStr);

        const dayBookings = state.bookings.filter(b => b.booking_date === selectedStr);
        elements.selectedDateBookings.innerHTML = '';

        if (dayBookings.length === 0) {
            elements.selectedDateBookings.innerHTML = `
                <div class="empty-day-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Tidak ada jadwal booking pada tanggal ini.</p>
                </div>
            `;
            return;
        }

        dayBookings.forEach(item => {
            const card = document.createElement('div');
            card.className = 'detail-booking-card';
            const initials = getInitials(item.customer_name);

            card.innerHTML = `
                <div class="detail-booking-info">
                    <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 0.75rem;">${initials}</div>
                    <div>
                        <div class="detail-booking-name">${escapeHtml(item.customer_name)}</div>
                        <div class="detail-booking-service">${escapeHtml(item.service)}</div>
                    </div>
                </div>
                <button type="button" class="btn-icon-danger" title="Batalkan booking">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

            const delBtn = card.querySelector('.btn-icon-danger');
            delBtn.addEventListener('click', () => openDeleteModal(item.id, item.customer_name));

            elements.selectedDateBookings.appendChild(card);
        });
    }

    function formatDateString(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /* ==========================================================================
       Helpers
       ========================================================================== */
    function getStatusInfo(bookingDateStr) {
        const todayStr = state.todayDateStr || new Date().toISOString().split('T')[0];
        if (bookingDateStr === todayStr) {
            return { label: 'Hari Ini', badgeClass: 'badge-today' };
        } else if (bookingDateStr > todayStr) {
            return { label: 'Mendatang', badgeClass: 'badge-upcoming' };
        } else {
            return { label: 'Selesai / Lewat', badgeClass: 'badge-passed' };
        }
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

    function getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
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
        clearPillSelection();

        if (prefilledDate) {
            elements.inputBookingDate.value = prefilledDate;
        } else {
            initDefaultDate();
        }

        elements.addModal.classList.add('active');
        elements.addModal.setAttribute('aria-hidden', 'false');
        setTimeout(() => elements.inputCustomerName.focus(), 100);
    }

    function closeAddModal() {
        elements.addModal.classList.remove('active');
        elements.addModal.setAttribute('aria-hidden', 'true');
    }

    function openDeleteModal(id, customerName) {
        state.deletingId = id;
        elements.deleteConfirmationText.innerHTML = `Apakah Anda yakin ingin membatalkan booking untuk <strong>${escapeHtml(customerName)}</strong> (ID #${id})?`;
        elements.deleteModal.classList.add('active');
        elements.deleteModal.setAttribute('aria-hidden', 'false');
    }

    function closeDeleteModal() {
        state.deletingId = null;
        elements.deleteModal.classList.remove('active');
        elements.deleteModal.setAttribute('aria-hidden', 'true');
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
            textSpan.textContent = 'Simpan Booking';
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

    function clearPillSelection() {
        const activePills = elements.servicePills.querySelectorAll('.pill-badge.active');
        activePills.forEach(p => p.classList.remove('active'));
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

        renderBookings();
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
                await fetchBookings();
                renderBookings();
            }, 300);
        });

        elements.clearSearchBtn.addEventListener('click', async () => {
            elements.searchInput.value = '';
            elements.clearSearchBtn.style.display = 'none';
            state.searchQuery = '';
            await fetchBookings();
            renderBookings();
        });

        // Sort
        elements.sortSelect.addEventListener('change', async (e) => {
            state.sortBy = e.target.value;
            await fetchBookings();
            renderBookings();
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

        // Calendar +Booking on date shortcut
        elements.btnAddOnDate.addEventListener('click', () => {
            openAddModal(state.selectedCalendarDate);
        });

        // Modal triggers
        elements.openAddModalBtn.addEventListener('click', () => openAddModal());
        elements.emptyAddBtn.addEventListener('click', () => openAddModal());
        elements.closeModalBtn.addEventListener('click', closeAddModal);
        elements.cancelModalBtn.addEventListener('click', closeAddModal);

        // Click outside modal to close
        elements.addModal.addEventListener('click', (e) => {
            if (e.target === elements.addModal) closeAddModal();
        });
        elements.deleteModal.addEventListener('click', (e) => {
            if (e.target === elements.deleteModal) closeDeleteModal();
        });

        // ESC key to close modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAddModal();
                closeDeleteModal();
            }
        });

        // Service Pills selection
        elements.servicePills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill-badge');
            if (!pill) return;
            clearPillSelection();
            pill.classList.add('active');
            elements.inputService.value = pill.getAttribute('data-service');
        });

        elements.inputService.addEventListener('input', () => {
            clearPillSelection();
        });

        // Quick date buttons
        elements.btnDateToday.addEventListener('click', () => setQuickDate(0));
        elements.btnDateTomorrow.addEventListener('click', () => setQuickDate(1));
        elements.btnDateNextWeek.addEventListener('click', () => setQuickDate(7));

        // Booking form submission
        elements.bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const customerName = elements.inputCustomerName.value.trim();
            const service = elements.inputService.value.trim();
            const bookingDate = elements.inputBookingDate.value.trim();

            if (!customerName || !service || !bookingDate) {
                showFormError('Mohon lengkapi semua kolom yang wajib diisi.');
                return;
            }

            await submitBooking({
                customer_name: customerName,
                service: service,
                booking_date: bookingDate
            });
        });

        // Delete modal actions
        elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        elements.confirmDeleteBtn.addEventListener('click', () => {
            if (state.deletingId) {
                deleteBooking(state.deletingId);
            }
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
