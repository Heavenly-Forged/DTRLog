/* =========================================================
   DTR Dashboard - app.js (refactored)
   Functions referenced by inline HTML handlers stay global.
   ========================================================= */

// --- CONSTANTS ---
const DEFAULT_PROFILE = {
    name: "",
    title: "Project Manager",
    shift_start: "07:30 AM",
    shift_end: "06:30 PM",
    target_hours: 0,
    logo_data: null
};
const BATCH_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PH_HOLIDAYS = ["01-01", "04-09", "05-01", "06-12", "08-26", "11-30", "12-25", "12-30"];
const MODAL_FADE_MS = 200;
const WEEKS_PER_PRINT_PAGE = 2;

const LOGO_CLASSES = {
    idle: ['bg-slate-100', 'text-slate-700', 'dark:bg-slate-700', 'dark:text-slate-200'],
    saved: ['bg-emerald-50', 'text-emerald-700', 'dark:bg-emerald-900/30', 'dark:text-emerald-400']
};
const LOGO_INPUT_HTML = `<input type="file" id="logoUpload" class="hidden" accept="image/*" onchange="handleLogoUpload(event)">`;
const LOGO_IDLE_HTML = `<span>Logo</span>${LOGO_INPUT_HTML}`;
const LOGO_SAVED_HTML = `<span class="flex items-center gap-1"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>Logo Saved</span>${LOGO_INPUT_HTML}`;

const ICON_EDIT = `<svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`;
const ICON_DELETE = `<svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;

// --- STATE ---
let googleProfileName = "";
let allLogs = [];
let groupedLogs = {};
let activeDeleteId = null;
let activeDeleteWeek = null;
let userProfile = { ...DEFAULT_PROFILE };
let sortOrderDesc = false;

// --- DOM / GENERAL HELPERS ---
const $ = id => document.getElementById(id);
const setText = (id, text) => { const el = $(id); if (el) el.innerText = text; };
const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function api(url, method = 'GET', body) {
    const options = { method };
    if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    return fetch(url, options);
}

// --- THEME ---
function applyDarkClass(isDark) {
    document.documentElement.classList.toggle('dark', isDark);
}

function setTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
        localStorage.theme = theme;
        applyDarkClass(theme === 'dark');
    } else {
        localStorage.removeItem('theme');
        applyDarkClass(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    updateProgressTracker();
}

function toggleTheme() {
    setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!('theme' in localStorage)) {
        applyDarkClass(e.matches);
        updateProgressTracker();
    }
});

// --- FORMATTING UTILITIES ---
function formatHM(decimalHours) {
    const num = parseFloat(decimalHours);
    if (isNaN(num) || num <= 0) return "0h 0m";
    const h = Math.floor(num);
    const m = Math.round((num - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function cleanWeekStr(str) {
    if (!str) return "Week 1";
    return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const lunchMinutes = log => (log.lunch_hours || 0) * 60;
const netHoursOf = log => calculateHours(log.time_in, log.time_out, lunchMinutes(log));

// --- PICKERS & BATCH ROWS ---
const TIME_PICKER_CONFIG = { enableTime: true, noCalendar: true, dateFormat: "h:i K", time_24hr: false };
const BATCH_INPUT_CLASS = "w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white";

function renderBatchRows() {
    const container = $('batchRows');
    if (!container) return;
    container.innerHTML = BATCH_DAYS.map((day, i) => `
        <div class="grid grid-cols-12 gap-2 items-center">
            <div class="col-span-3 font-medium text-slate-700 dark:text-slate-300">${day}</div>
            <div class="col-span-3"><input type="text" id="bIn_${i}" class="flatpickr-time ${BATCH_INPUT_CLASS}" placeholder="08:00 AM"></div>
            <div class="col-span-3"><input type="text" id="bOut_${i}" class="flatpickr-time ${BATCH_INPUT_CLASS}" placeholder="05:00 PM"></div>
            <div class="col-span-3"><input type="number" id="bLunch_${i}" value="60" min="0" class="${BATCH_INPUT_CLASS}" placeholder="60"></div>
        </div>
    `).join('');
}

function initPickers() {
    renderBatchRows(); // build rows first so every picker is initialised exactly once
    flatpickr(".flatpickr-date", { altInput: true, altFormat: "F j, Y", dateFormat: "Y-m-d" });
    flatpickr(".flatpickr-time", TIME_PICKER_CONFIG);
}

// --- PROFILE & CLOUD SYNC ---
async function fetchProfile() {
    try {
        const res = await api('/api/profile');
        if (!res.ok) return;

        userProfile = await res.json();
        if (!userProfile.name && googleProfileName) userProfile.name = googleProfileName;

        applyInternProfile(userProfile.name, userProfile.title);

        const targetInput = $('targetHoursInput');
        if (targetInput) targetInput.value = userProfile.target_hours > 0 ? userProfile.target_hours : "";

        if (userProfile.logo_data) updateLogoIndicator();
        updateProgressTracker();
    } catch (e) {
        console.error("Failed to load profile", e);
    }
}

async function saveProfileToCloud(updatedData) {
    userProfile = { ...userProfile, ...updatedData };
    await api('/api/profile', 'POST', userProfile);
}

function applyInternProfile(name, title) {
    setText('userName', name);
    setText('headerInternTitle', title);
}

function checkOnboarding(googleName) {
    if (userProfile.name) return;
    $('onboardName').value = googleName;
    $('onboardModalTitle').innerText = "Welcome to DTR";
    $('onboardCloseBtn').classList.add('hidden');
    toggleModal('onboardingModal');
}

function openEditProfile() {
    $('onboardName').value = userProfile.name || googleProfileName;
    $('onboardTitle').value = userProfile.title || DEFAULT_PROFILE.title;
    $('onboardShiftStart').value = userProfile.shift_start || DEFAULT_PROFILE.shift_start;
    $('onboardShiftEnd').value = userProfile.shift_end || DEFAULT_PROFILE.shift_end;
    $('onboardModalTitle').innerText = "Edit Profile";
    $('onboardCloseBtn').classList.remove('hidden');
    toggleModal('onboardingModal');
}

async function saveOnboarding() {
    const name = $('onboardName').value || googleProfileName;
    const title = $('onboardTitle').value || DEFAULT_PROFILE.title;
    const shift_start = $('onboardShiftStart').value || DEFAULT_PROFILE.shift_start;
    const shift_end = $('onboardShiftEnd').value || DEFAULT_PROFILE.shift_end;

    await saveProfileToCloud({ name, title, shift_start, shift_end });
    applyInternProfile(name, title);
    toggleModal('onboardingModal');

    if (allLogs.length > 0) {
        renderDashboard();
        updateProgressTracker();
    }
}

// --- MODALS ---
function toggleModal(id) {
    const modal = $(id);
    if (!modal) return;

    if (modal.classList.contains('active')) {
        modal.style.opacity = '0';
        setTimeout(() => modal.classList.remove('active'), MODAL_FADE_MS);
    } else {
        modal.classList.add('active');
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
        if (id === 'printSettingsModal') populatePrintCheckboxes();
    }
}

function toggleSingleNA() {
    const isNa = $('sNa').checked;
    const inputs = [$('sTimeIn'), $('sTimeOut'), $('sLunch')];
    inputs.forEach(input => { input.disabled = isNa; });
    if (isNa) {
        $('sTimeIn').value = "";
        $('sTimeOut').value = "";
        $('sLunch').value = "0";
    }
}

// --- LOGO ---
function setLogoState(isSaved) {
    const label = $('logoUploadLabel');
    const removeBtn = $('removeLogoBtn');
    if (label) {
        label.classList.remove(...LOGO_CLASSES[isSaved ? 'idle' : 'saved']);
        label.classList.add(...LOGO_CLASSES[isSaved ? 'saved' : 'idle']);
        label.innerHTML = isSaved ? LOGO_SAVED_HTML : LOGO_IDLE_HTML;
    }
    if (removeBtn) removeBtn.classList.toggle('hidden', !isSaved);
}

function updateLogoIndicator() {
    setLogoState(true);
}

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        await saveProfileToCloud({ logo_data: e.target.result });
        updateLogoIndicator();
    };
    reader.readAsDataURL(file);
}

async function removeLogo() {
    await saveProfileToCloud({ logo_data: null });
    setLogoState(false);
}

// --- CALCULATIONS ---
function parseTimeAMPM(timeStr) {
    if (!timeStr || timeStr === "N/A") return null;
    const [time, modifier] = timeStr.split(' ');
    const [hoursStr, minutesStr] = time.split(':');
    let hours = parseInt(hoursStr, 10);
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    return { h: hours, m: parseInt(minutesStr, 10) };
}

const toDate = t => new Date(2000, 0, 1, t.h, t.m);

/** Returns net hours as a number, clamped to the user's shift window. */
function calculateHours(timeIn, timeOut, lunchMins = 0) {
    if (timeIn === "N/A" || timeOut === "N/A") return 0;

    const inT = parseTimeAMPM(timeIn);
    const outT = parseTimeAMPM(timeOut);
    if (!inT || !outT) return 0;

    const shiftStartT = parseTimeAMPM(userProfile.shift_start || DEFAULT_PROFILE.shift_start);
    const shiftEndT = parseTimeAMPM(userProfile.shift_end || DEFAULT_PROFILE.shift_end);

    let dIn = toDate(inT);
    let dOut = toDate(outT);
    const dShiftStart = toDate(shiftStartT);
    const dShiftEnd = toDate(shiftEndT);

    if (dOut < dIn) dOut.setDate(dOut.getDate() + 1);
    if (dShiftEnd < dShiftStart) dShiftEnd.setDate(dShiftEnd.getDate() + 1);

    if (dIn < dShiftStart) dIn = dShiftStart;
    if (dOut > dShiftEnd) dOut = dShiftEnd;
    if (dOut <= dIn) return 0;

    const diffHours = ((dOut - dIn) / 3600000) - (lunchMins / 60);
    return Number(Math.max(0, diffHours).toFixed(2));
}

// --- PROGRESS & PREDICTION ---
function setCompletionStyle(isDone) {
    const el = $('estimatedCompletionDate');
    if (!el) return;
    el.classList.toggle('text-indigo-600', !isDone);
    el.classList.toggle('dark:text-indigo-400', !isDone);
    el.classList.toggle('text-emerald-600', isDone);
    el.classList.toggle('dark:text-emerald-400', isDone);
}

async function updateProgressTracker() {
    const targetInput = $('targetHoursInput');
    if (!targetInput) return;

    let target = parseFloat(targetInput.value);
    if (isNaN(target) || target < 0) target = 0;

    if (target !== userProfile.target_hours) {
        await saveProfileToCloud({ target_hours: target });
    }

    const totalHours = allLogs.reduce((sum, log) => sum + netHoursOf(log), 0);
    const hasTarget = target > 0;
    const percent = hasTarget ? Math.min(100, Math.max(0, (totalHours / target) * 100)) : 0;
    const remaining = hasTarget ? Math.max(0, target - totalHours) : 0;

    setText('progressPercent', `${Math.round(percent)}%`);
    setText('progressHours', formatHM(totalHours));
    setText('progressTarget', hasTarget ? `${target}h` : "0h");
    setText('progressRemaining', hasTarget ? `${formatHM(remaining)} remaining` : "Set target to calculate");

    const bar = $('linearProgressBar');
    if (bar) bar.style.width = `${percent}%`;

    const wrapper = $('circularProgressWrapper');
    if (wrapper) {
        const emptyColor = document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0';
        wrapper.style.background = `conic-gradient(#10b981 ${percent}%, ${emptyColor} ${percent}%)`;
    }

    const isDone = hasTarget && remaining <= 0;
    if (!hasTarget) setText('estimatedCompletionDate', "Set target to calculate");
    else if (isDone) setText('estimatedCompletionDate', "Requirements Completed 🎉");
    else setText('estimatedCompletionDate', predictCompletionDate(remaining));
    setCompletionStyle(isDone);
}

function predictCompletionDate(remainingHours) {
    let dailyNetHours = calculateHours(userProfile.shift_start, userProfile.shift_end, 60);
    if (!(dailyNetHours > 0)) dailyNetHours = 8;

    let daysNeeded = Math.ceil(remainingHours / dailyNetHours);
    const date = new Date();

    while (daysNeeded > 0) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (day !== 0 && day !== 6 && !PH_HOLIDAYS.includes(mmdd)) daysNeeded--;
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// --- SORTING, FILTERING & RENDERING ---
function filterLogs() {
    const query = $('searchInput').value.toLowerCase();
    document.querySelectorAll('.week-group-container').forEach(week => {
        week.style.display = week.innerText.toLowerCase().includes(query) ? 'block' : 'none';
    });
}

function toggleSortOrder() {
    sortOrderDesc = !sortOrderDesc;
    setText('sortBtnText', sortOrderDesc ? "Sort: Latest First" : "Sort: Oldest First");
    renderDashboard();
}

function groupLogsByWeek(logs) {
    return logs.reduce((groups, log) => {
        const week = log.week_label || "Uncategorized";
        (groups[week] ||= []).push(log);
        return groups;
    }, {});
}

async function fetchLogs() {
    try {
        const res = await api('/api/logs');
        if (res.status === 401) {
            window.location.href = '/';
            return;
        }
        allLogs = await res.json();
        groupedLogs = groupLogsByWeek(allLogs);

        renderDashboard();
        updateProgressTracker();
        filterLogs();
    } catch (e) {
        console.error("Failed to fetch logs", e);
    }
}

function renderLogRow(log) {
    const isNa = log.time_in === "N/A";
    const netHrs = netHoursOf(log);
    const timeClass = isNa ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300';
    const hrsDisplay = isNa
        ? `<span class="text-slate-400 dark:text-slate-500">N/A</span>`
        : `<span class="font-bold text-blue-600 dark:text-blue-400">${formatHM(netHrs)}</span>`;
    const lunchDisplay = isNa ? `-` : `${lunchMinutes(log)}m`;

    return `<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">${escapeHtml(log.date)}</td>
        <td class="px-4 py-3 ${timeClass}">${escapeHtml(log.time_in)}</td>
        <td class="px-4 py-3 ${timeClass}">${escapeHtml(log.time_out)}</td>
        <td class="px-4 py-3 text-center text-slate-500 dark:text-slate-400">${lunchDisplay}</td>
        <td class="px-4 py-3">${hrsDisplay}</td>
        <td class="px-4 py-3 text-right">
            <button data-action="edit-log" data-id="${log.id}" class="text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors mr-2" aria-label="Edit log">${ICON_EDIT}</button>
            <button data-action="delete-log" data-id="${log.id}" class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" aria-label="Delete log">${ICON_DELETE}</button>
        </td>
    </tr>`;
}

function renderWeekGroup(week) {
    const logs = groupedLogs[week];
    const weekTotal = logs.reduce((sum, log) => sum + netHoursOf(log), 0);

    return `<div class="week-group-container bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
        <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 class="font-bold text-slate-800 dark:text-white">${escapeHtml(week)}</h3>
            <button data-action="delete-week" data-week="${escapeHtml(week)}" class="text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg transition-colors">Delete Week</button>
        </div>
        <div class="p-6 overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <tr><th class="px-4 py-3">Date</th><th class="px-4 py-3">In</th><th class="px-4 py-3">Out</th><th class="px-4 py-3 text-center">Lunch</th><th class="px-4 py-3">Hrs (Net)</th><th class="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody>${logs.map(renderLogRow).join('')}</tbody>
            </table>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm">
            <span class="font-semibold text-slate-600 dark:text-slate-400">Weekly Total (Net)</span>
            <span class="font-bold text-lg text-slate-900 dark:text-white">${formatHM(weekTotal)}</span>
        </div>
    </div>`;
}

function renderDashboard() {
    const container = $('dashboard-views');
    if (!container) return;

    const weekKeys = Object.keys(groupedLogs).sort(naturalSort);
    if (sortOrderDesc) weekKeys.reverse();
    container.innerHTML = weekKeys.map(renderWeekGroup).join('');
}

function initDashboardActions() {
    const container = $('dashboard-views');
    if (!container) return;
    container.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id, week } = btn.dataset;
        if (action === 'edit-log') openEditLog(Number(id));
        else if (action === 'delete-log') confirmDelete(Number(id));
        else if (action === 'delete-week') confirmDeleteWeek(week);
    });
}

// --- CREATE LOGS ---
function buildLogPayload(week, date, timeIn, timeOut, lunchMins) {
    return {
        week_label: week,
        date,
        time_in: timeIn,
        time_out: timeOut,
        lunch_hours: lunchMins / 60,
        hours: calculateHours(timeIn, timeOut, lunchMins)
    };
}

async function submitSingleLog() {
    const week = cleanWeekStr($('sWeek').value);
    const date = $('sDate').value;
    const isNa = $('sNa').checked;
    let timeIn = $('sTimeIn').value;
    let timeOut = $('sTimeOut').value;
    let lunchMins = parseFloat($('sLunch').value) || 0;

    if (!date) return alert("Select a date.");
    if (isNa) {
        timeIn = "N/A";
        timeOut = "N/A";
        lunchMins = 0;
    } else if (!timeIn || !timeOut) {
        return alert("Fill all time fields or mark as N/A.");
    }

    await api('/api/logs', 'POST', buildLogPayload(week, date, timeIn, timeOut, lunchMins));
    toggleModal('singleLogModal');
    fetchLogs();
}

async function submitBatchLogs() {
    const week = cleanWeekStr($('bWeek').value);
    const startStr = $('wStartDate').value;
    if (!startStr) return alert("Select a starting date");
    const baseDate = new Date(startStr);

    for (let i = 0; i < BATCH_DAYS.length; i++) {
        let tIn = $(`bIn_${i}`).value;
        let tOut = $(`bOut_${i}`).value;
        let lunchMins = parseFloat($(`bLunch_${i}`).value) || 0;

        if (!tIn && !tOut) {
            tIn = "N/A";
            tOut = "N/A";
            lunchMins = 0;
        }
        if (!tIn || !tOut) continue;

        const logDate = new Date(baseDate);
        logDate.setUTCDate(baseDate.getUTCDate() + i);
        const dateStr = logDate.toISOString().split('T')[0];

        await api('/api/logs', 'POST', buildLogPayload(week, dateStr, tIn, tOut, lunchMins));
    }
    toggleModal('weeklyLogModal');
    fetchLogs();
}

// --- EDIT & DELETE ---
function openEditLog(id) {
    const log = allLogs.find(l => l.id === id);
    if (!log) return;

    $('editLogId').value = log.id;
    $('eWeek').value = log.week_label;
    $('eLunch').value = lunchMinutes(log);

    const setPicker = (inputId, value) => {
        const picker = $(inputId)._flatpickr;
        if (!picker) return;
        if (value && value !== "N/A") picker.setDate(value);
        else picker.clear();
    };
    setPicker('eDate', log.date);
    setPicker('eTimeIn', log.time_in);
    setPicker('eTimeOut', log.time_out);

    toggleModal('editLogModal');
}

async function submitEditLog() {
    const id = $('editLogId').value;
    const week = cleanWeekStr($('eWeek').value);
    const date = $('eDate').value;
    const timeIn = $('eTimeIn').value || "N/A";
    const timeOut = $('eTimeOut').value || "N/A";
    const lunchMins = parseFloat($('eLunch').value) || 0;

    if (!date) return alert("Select a date.");

    await api(`/api/logs/${id}`, 'PUT', buildLogPayload(week, date, timeIn, timeOut, lunchMins));
    toggleModal('editLogModal');
    fetchLogs();
}

function confirmDelete(id) {
    activeDeleteId = id;
    toggleModal('deleteConfirmModal');
}

function initDeleteButton() {
    const btn = $('confirmDeleteBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        if (!activeDeleteId) return;
        await api(`/api/logs/${activeDeleteId}`, 'DELETE');
        toggleModal('deleteConfirmModal');
        fetchLogs();
    });
}

function confirmDeleteWeek(week) {
    activeDeleteWeek = week;
    setText('deleteWeekTargetName', week);
    toggleModal('deleteWeekConfirmModal');
}

async function executeDeleteWeek() {
    if (!activeDeleteWeek || !groupedLogs[activeDeleteWeek]) return;
    for (const log of groupedLogs[activeDeleteWeek]) {
        await api(`/api/logs/${log.id}`, 'DELETE');
    }
    toggleModal('deleteWeekConfirmModal');
    fetchLogs();
}

// --- PRINTING ---
function populatePrintCheckboxes() {
    const container = $('weekCheckboxes');
    if (!container) return;
    container.innerHTML = Object.keys(groupedLogs).sort(naturalSort).map(week => `
        <label class="flex items-center p-2 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-700 rounded transition-colors">
            <input type="checkbox" class="print-week-cb w-4 h-4 text-slate-800 rounded focus:ring-slate-800" value="${escapeHtml(week)}" checked>
            <span class="ml-3 text-sm font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(week)}</span>
        </label>
    `).join('');
}

const PRINT_TH = 'border: 1px solid #cbd5e1; padding: 8px;';
const PRINT_TD = 'border: 1px solid #cbd5e1; padding: 6px;';

function printHeaderHtml(company, logoSrc) {
    return `
        <div class="doc-header" style="text-align: center; margin-bottom: 30px;">
            ${logoSrc ? `<img src="${logoSrc}" style="height: 60px; margin-bottom: 10px; display: inline-block;">` : ''}
            <div style="font-weight: 800; font-size: 18px; text-transform: uppercase; color: #0f172a;">${escapeHtml(company)}</div>
            <div style="font-size: 12px; font-weight: 600; color: #64748b; letter-spacing: 2px;">DAILY TIME RECORD</div>
            <hr style="margin-top: 15px; border-top: 1px solid #cbd5e1;">
        </div>`;
}

function printSignatureHtml(name, title) {
    return `
        <div style="width: 40%; text-align: center;">
            <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 800; font-size: 12px; text-transform: uppercase;">${escapeHtml(name)}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${escapeHtml(title)}</div>
        </div>`;
}

function printLogRowHtml(log) {
    const isNa = log.time_in === "N/A";
    const hrsDisplay = isNa ? "N/A" : formatHM(netHoursOf(log));
    const lunchDisplay = isNa ? "-" : `${lunchMinutes(log)}m`;
    return `
        <tr style="color: #334155;">
            <td style="${PRINT_TD}">${escapeHtml(log.date)}</td>
            <td style="${PRINT_TD}">${escapeHtml(log.time_in)}</td>
            <td style="${PRINT_TD}">${escapeHtml(log.time_out)}</td>
            <td style="${PRINT_TD}">${lunchDisplay}</td>
            <td style="${PRINT_TD} font-weight: 600;">${hrsDisplay}</td>
        </tr>`;
}

function printWeekHtml(week, signer) {
    const logs = groupedLogs[week];
    const total = logs.reduce((sum, log) => sum + netHoursOf(log), 0);
    const safeWeek = escapeHtml(week);

    return `
        <div class="print-week-group" style="margin-bottom: 40px; break-inside: avoid;">
            <div style="font-weight: 700; margin-bottom: 10px; background: #f8fafc; padding: 6px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155;">${safeWeek}</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; text-align: center;">
                <thead>
                    <tr style="background: #f1f5f9; color: #475569;">
                        <th style="${PRINT_TH}">Date</th>
                        <th style="${PRINT_TH}">Time In</th>
                        <th style="${PRINT_TH}">Time Out</th>
                        <th style="${PRINT_TH}">Lunch Deduct</th>
                        <th style="${PRINT_TH}">Net Hours</th>
                    </tr>
                </thead>
                <tbody>${logs.map(printLogRowHtml).join('')}</tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 700; color: #0f172a;">
                        <td colspan="4" style="${PRINT_TH} text-align: right;">Total for ${safeWeek}:</td>
                        <td style="${PRINT_TH}">${formatHM(total)}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 40px;">
                ${printSignatureHtml(signer.internName, signer.internTitle)}
                ${printSignatureHtml(signer.supName, signer.supTitle)}
            </div>
        </div>`;
}

function executePrint() {
    const company = $('inputCompName').value || "Company Name";
    const supName = $('inputSupName').value || "Supervisor Name";
    const supTitle = $('inputSupTitle').value || "Supervisor Title";

    const signer = {
        internName: userProfile.name || "Intern Name",
        internTitle: userProfile.title || DEFAULT_PROFILE.title,
        supName,
        supTitle
    };
    const logoSrc = userProfile.logo_data || "";

    localStorage.setItem('dtr_comp', company);
    localStorage.setItem('dtr_sup', supName);
    localStorage.setItem('dtr_title', supTitle);

    const container = $('print-data-container');
    if (!container) return;

    const selectedWeeks = Array.from(document.querySelectorAll('.print-week-cb:checked')).map(cb => cb.value);
    const pages = [];

    for (let i = 0; i < selectedWeeks.length; i += WEEKS_PER_PRINT_PAGE) {
        const weeksHtml = selectedWeeks
            .slice(i, i + WEEKS_PER_PRINT_PAGE)
            .map(week => printWeekHtml(week, signer))
            .join('');
        pages.push(`<div class="print-page" style="page-break-after: always; padding: 20px 0;">${printHeaderHtml(company, logoSrc)}${weeksHtml}</div>`);
    }

    container.innerHTML = pages.join('');
    window.print();
}

// --- INIT ---
function restorePrintSettings() {
    const fields = {
        inputCompName: ['dtr_comp', "Company Name"],
        inputSupName: ['dtr_sup', ""],
        inputSupTitle: ['dtr_title', "Supervisor Title"]
    };
    Object.entries(fields).forEach(([id, [key, fallback]]) => {
        const el = $(id);
        if (el) el.value = localStorage.getItem(key) || fallback;
    });
}

async function loadUser() {
    try {
        const res = await api('/api/user');
        if (!res.ok) return;
        const user = await res.json();
        googleProfileName = user.name;

        const avatar = $('userAvatar');
        if (avatar && user.picture) avatar.src = user.picture;

        await fetchProfile();
        checkOnboarding(googleProfileName);
    } catch (e) {
        console.error("Auth skipped or failed:", e);
    }
}

initPickers();
initDashboardActions();
initDeleteButton();

window.addEventListener('load', async () => {
    await loadUser();
    if ($('dashboard-views')) fetchLogs();
    restorePrintSettings();
});