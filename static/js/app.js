// --- THEME MANAGEMENT ---
function setTheme(theme) {
    if (theme === 'dark') {
        localStorage.theme = 'dark';
        document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
        localStorage.theme = 'light';
        document.documentElement.classList.remove('dark');
    } else {
        localStorage.removeItem('theme');
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }
    if (typeof updateProgressTracker === 'function') updateProgressTracker();
}

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        setTheme('light');
    } else {
        setTheme('dark');
    }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!('theme' in localStorage)) {
        if (e.matches) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        if (typeof updateProgressTracker === 'function') updateProgressTracker();
    }
});

// --- GLOBAL VARIABLES & SCHEDULE ENGINE ---
let googleProfileName = "";
let allLogs = [];
let groupedLogs = {};
let activeDeleteId = null;
let activeDeleteWeek = null;
let userProfile = { name: "", title: "Project Manager", shift_start: "07:30 AM", shift_end: "06:30 PM", target_hours: 0, logo_data: null };
let sortOrderDesc = false;

let workDays = JSON.parse(localStorage.getItem('dtr_workdays')) || [1, 2, 3, 4, 5]; 
let customHolidays = JSON.parse(localStorage.getItem('dtr_custom_holidays')) || [];

const defaultPHHolidays = [
    { date: "01-01", name: "New Year's Day" },
    { date: "04-09", name: "Araw ng Kagitingan" },
    { date: "05-01", name: "Labor Day" },
    { date: "06-12", name: "Independence Day" },
    { date: "08-26", name: "National Heroes Day" },
    { date: "11-30", name: "Bonifacio Day" },
    { date: "12-25", name: "Christmas Day" },
    { date: "12-30", name: "Rizal Day" }
];

// --- UTILITIES ---
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
    return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
}

// --- INITIALIZE PICKERS & UI ---
flatpickr(".flatpickr-date", { altInput: true, altFormat: "F j, Y", dateFormat: "Y-m-d" });
flatpickr(".flatpickr-range", { mode: "range", altInput: true, altFormat: "F j, Y", dateFormat: "Y-m-d" });
const timeConfig = { enableTime: true, noCalendar: true, dateFormat: "h:i K", time_24hr: false };
flatpickr(".flatpickr-time", timeConfig);

const batchContainer = document.getElementById('batchRows');
if (batchContainer) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    batchContainer.innerHTML = days.map((day, i) => `
        <div class="grid grid-cols-12 gap-2 items-center">
            <div class="col-span-3 font-medium text-slate-700 dark:text-slate-300">${day}</div>
            <div class="col-span-3"><input type="text" id="bIn_${i}" class="flatpickr-time w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="08:00 AM"></div>
            <div class="col-span-3"><input type="text" id="bOut_${i}" class="flatpickr-time w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="05:00 PM"></div>
            <div class="col-span-3"><input type="number" id="bLunch_${i}" value="60" min="0" class="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="60"></div>
        </div>
    `).join('');
    flatpickr(".flatpickr-time", timeConfig);
}

// --- PROFILE & CLOUD SYNC ---
async function fetchProfile() {
    try {
        const res = await fetch('/api/profile');
        if (res.ok) {
            userProfile = await res.json();
            if (!userProfile.name && googleProfileName) userProfile.name = googleProfileName;
            
            applyInternProfile(userProfile.name, userProfile.title);
            
            const targetInput = document.getElementById('targetHoursInput');
            if (targetInput) targetInput.value = userProfile.target_hours > 0 ? userProfile.target_hours : "";
            
            if (userProfile.logo_data) {
                updateLogoIndicator();
            }
            updateProgressTracker();
        }
    } catch (e) {
        console.error("Failed to load profile", e);
    }
}

async function saveProfileToCloud(updatedData) {
    userProfile = { ...userProfile, ...updatedData };
    await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
    });
}

function checkOnboarding(googleName) {
    if (!userProfile.name) {
        document.getElementById('onboardName').value = googleName;
        document.getElementById('onboardModalTitle').innerText = "Welcome to DTR";
        document.getElementById('onboardCloseBtn').classList.add('hidden');
        toggleModal('onboardingModal');
    }
}

function openEditProfile() {
    document.getElementById('onboardName').value = userProfile.name || googleProfileName;
    document.getElementById('onboardTitle').value = userProfile.title || "Project Manager";
    document.getElementById('onboardShiftStart').value = userProfile.shift_start || "07:30 AM";
    document.getElementById('onboardShiftEnd').value = userProfile.shift_end || "06:30 PM";
    document.getElementById('onboardModalTitle').innerText = "Edit Profile";
    document.getElementById('onboardCloseBtn').classList.remove('hidden');
    toggleModal('onboardingModal');
}

async function saveOnboarding() {
    const name = document.getElementById('onboardName').value || googleProfileName;
    const title = document.getElementById('onboardTitle').value || "Project Manager";
    const shiftStart = document.getElementById('onboardShiftStart').value || "07:30 AM";
    const shiftEnd = document.getElementById('onboardShiftEnd').value || "06:30 PM";
    
    await saveProfileToCloud({ name, title, shift_start: shiftStart, shift_end: shiftEnd });
    applyInternProfile(name, title);
    toggleModal('onboardingModal');
    
    if (allLogs.length > 0) { renderDashboard(); updateProgressTracker(); }
}

function applyInternProfile(name, title) {
    if (document.getElementById('userName')) document.getElementById('userName').innerText = name;
    if (document.getElementById('headerInternTitle')) document.getElementById('headerInternTitle').innerText = title;
}

// --- CALENDAR & MULTI-DATE HOLIDAY SETTINGS ---
function openCalendarModal() {
    renderWorkDays();
    renderHolidays();
    toggleModal('calendarModal');
}

function renderWorkDays() {
    const days = [ {v:1, l:'Mon'}, {v:2, l:'Tue'}, {v:3, l:'Wed'}, {v:4, l:'Thu'}, {v:5, l:'Fri'}, {v:6, l:'Sat'}, {v:0, l:'Sun'} ];
    const container = document.getElementById('workDaysCheckboxes');
    container.innerHTML = days.map(d => `
        <label class="flex items-center gap-1.5 p-2 px-3 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <input type="checkbox" class="work-day-cb w-4 h-4 text-blue-600 focus:ring-blue-500 rounded" value="${d.v}" ${workDays.includes(d.v) ? 'checked' : ''}>
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">${d.l}</span>
        </label>
    `).join('');
}

function renderHolidays() {
    const container = document.getElementById('holidayList');
    let html = '';
    
    defaultPHHolidays.forEach(h => {
        html += `<li class="flex justify-between items-center text-slate-500 dark:text-slate-400 p-2"><span class="font-semibold">${h.name}</span><span class="text-xs font-medium bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-md">${h.date} (Annual)</span></li>`;
    });
    
    customHolidays.forEach((h, i) => {
        html += `<li class="flex justify-between items-center text-blue-700 dark:text-blue-400 p-2 border-t border-slate-200 dark:border-slate-700">
            <span class="font-bold">${h.name}</span>
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-md">${h.date}</span>
                <button onclick="removeCustomHoliday(${i})" class="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold px-1">&times;</button>
            </div>
        </li>`;
    });
    
    container.innerHTML = html;
}

function addCustomHolidays() {
    const dateRangeStr = document.getElementById('customHolDates').value;
    const nameVal = document.getElementById('customHolName').value || "Special Event";
    if (!dateRangeStr) return alert("Please select a date or date range.");

    // Flatpickr range returns dates separated by " to "
    const dates = dateRangeStr.split(" to ");
    let startDate = new Date(dates[0]);
    let endDate = dates[1] ? new Date(dates[1]) : new Date(dates[0]);

    let curr = new Date(startDate);
    while (curr <= endDate) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        // Prevent duplicate entries for the exact same date
        if (!customHolidays.some(h => h.date === formattedDate)) {
            customHolidays.push({ date: formattedDate, name: nameVal });
        }
        curr.setDate(curr.getDate() + 1);
    }
    
    document.getElementById('customHolDates')._flatpickr.clear();
    document.getElementById('customHolName').value = "";
    renderHolidays();
}

function removeCustomHoliday(index) {
    customHolidays.splice(index, 1);
    renderHolidays();
}

function saveCalendarSettings() {
    const cbs = document.querySelectorAll('.work-day-cb:checked');
    workDays = Array.from(cbs).map(cb => parseInt(cb.value));
    
    localStorage.setItem('dtr_workdays', JSON.stringify(workDays));
    localStorage.setItem('dtr_custom_holidays', JSON.stringify(customHolidays));
    
    toggleModal('calendarModal');
    updateProgressTracker();
}

// --- MODALS & LOGO ---
function toggleModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (modal.classList.contains('active')) {
        modal.style.opacity = '0';
        setTimeout(() => modal.classList.remove('active'), 200);
    } else {
        modal.classList.add('active');
        setTimeout(() => modal.style.opacity = '1', 10);
        if (id === 'printSettingsModal') populatePrintCheckboxes();
    }
}

function toggleSingleNA() {
    const isNa = document.getElementById('sNa').checked;
    const inInput = document.getElementById('sTimeIn');
    const outInput = document.getElementById('sTimeOut');
    const lunchInput = document.getElementById('sLunch');
    inInput.disabled = isNa; outInput.disabled = isNa; lunchInput.disabled = isNa;
    if (isNa) { inInput.value = ""; outInput.value = ""; lunchInput.value = "0"; }
}

function updateLogoIndicator() {
    const label = document.getElementById('logoUploadLabel');
    const removeBtn = document.getElementById('removeLogoBtn');
    if (label) {
        label.classList.replace('bg-slate-100', 'bg-emerald-50');
        label.classList.replace('text-slate-700', 'text-emerald-700');
        label.classList.replace('dark:bg-slate-700', 'dark:bg-emerald-900/30');
        label.classList.replace('dark:text-slate-200', 'dark:text-emerald-400');
        label.innerHTML = `<span class="flex items-center gap-1"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>Logo Saved</span><input type="file" id="logoUpload" class="hidden" accept="image/*" onchange="handleLogoUpload(event)">`;
    }
    if (removeBtn) removeBtn.classList.remove('hidden');
}

function handleLogoUpload(event) {
    const reader = new FileReader();
    reader.onload = async e => {
        const base64Logo = e.target.result;
        await saveProfileToCloud({ logo_data: base64Logo });
        updateLogoIndicator();
    };
    if (event.target.files[0]) reader.readAsDataURL(event.target.files[0]);
}

async function removeLogo() {
    await saveProfileToCloud({ logo_data: null });
    const label = document.getElementById('logoUploadLabel');
    if (label) {
        label.classList.replace('bg-emerald-50', 'bg-slate-100');
        label.classList.replace('text-emerald-700', 'text-slate-700');
        label.classList.replace('dark:bg-emerald-900/30', 'dark:bg-slate-700');
        label.classList.replace('dark:text-emerald-400', 'dark:text-slate-200');
        label.innerHTML = `<span>Logo</span><input type="file" id="logoUpload" class="hidden" accept="image/*" onchange="handleLogoUpload(event)">`;
    }
    const removeBtn = document.getElementById('removeLogoBtn');
    if (removeBtn) removeBtn.classList.add('hidden');
    const fileInput = document.getElementById('logoUpload');
    if (fileInput) fileInput.value = '';
}

// --- CALCULATION LOGIC ---
function parseTimeAMPM(timeStr) {
    if (!timeStr || timeStr === "N/A") return null;
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    return { h: hours, m: parseInt(minutes, 10) };
}

function calculateHours(timeIn, timeOut, lunchMins = 0) {
    if (timeIn === "N/A" || timeOut === "N/A") return 0;
    const inT = parseTimeAMPM(timeIn);
    const outT = parseTimeAMPM(timeOut);
    const shiftStartT = parseTimeAMPM(userProfile.shift_start || "07:30 AM");
    const shiftEndT = parseTimeAMPM(userProfile.shift_end || "06:30 PM");

    if (!inT || !outT) return 0;
    
    let dIn = new Date(2000, 0, 1, inT.h, inT.m);
    let dOut = new Date(2000, 0, 1, outT.h, outT.m);
    const dShiftStart = new Date(2000, 0, 1, shiftStartT.h, shiftStartT.m);
    const dShiftEnd = new Date(2000, 0, 1, shiftEndT.h, shiftEndT.m);
    
    if (dOut < dIn) dOut.setDate(dOut.getDate() + 1);
    if (dShiftEnd < dShiftStart) dShiftEnd.setDate(dShiftEnd.getDate() + 1);

    if (dIn < dShiftStart) dIn = dShiftStart;
    if (dOut > dShiftEnd) dOut = dShiftEnd;
    if (dOut <= dIn) return "0.00";
    
    let diffHours = ((dOut - dIn) / (1000 * 60 * 60)) - (lunchMins / 60);
    return Math.max(0, diffHours).toFixed(2);
}

// --- PROGRESS & PREDICTION TRACKER ---
async function updateProgressTracker() {
    const targetInput = document.getElementById('targetHoursInput');
    if (!targetInput) return;
    
    let target = parseFloat(targetInput.value);
    if (isNaN(target) || target < 0) target = 0;
    
    if (target !== userProfile.target_hours) {
        await saveProfileToCloud({ target_hours: target });
    }
    
    let totalHours = 0;
    allLogs.forEach(log => { totalHours += parseFloat(calculateHours(log.time_in, log.time_out, (log.lunch_hours || 0) * 60)); });
    
    let percent = 0;
    let remaining = 0;
    if (target > 0) {
        percent = Math.min(100, Math.max(0, (totalHours / target) * 100));
        remaining = Math.max(0, target - totalHours);
    }
    
    const percentEl = document.getElementById('progressPercent');
    if (percentEl) percentEl.innerText = `${Math.round(percent)}%`;
    const hrsEl = document.getElementById('progressHours');
    if (hrsEl) hrsEl.innerText = formatHM(totalHours);
    const targetEl = document.getElementById('progressTarget');
    if (targetEl) targetEl.innerText = target > 0 ? `${target}h` : "0h";
    const remainingEl = document.getElementById('progressRemaining');
    if (remainingEl) remainingEl.innerText = target > 0 ? `${formatHM(remaining)} remaining` : `Set target to calculate`;
    
    const barEl = document.getElementById('linearProgressBar');
    if (barEl) barEl.style.width = `${percent}%`;
    const wrapEl = document.getElementById('circularProgressWrapper');
    if (wrapEl) {
        const isDark = document.documentElement.classList.contains('dark');
        const emptyColor = isDark ? '#334155' : '#e2e8f0'; 
        wrapEl.style.background = `conic-gradient(#10b981 ${percent}%, ${emptyColor} ${percent}%)`;
    }

    const estEl = document.getElementById('estimatedCompletionDate');
    if (estEl) {
        if (target <= 0) {
            estEl.innerText = "Set target to calculate";
        } else if (remaining <= 0) {
            estEl.innerText = "Requirements Completed 🎉";
            estEl.classList.replace('text-indigo-600', 'text-emerald-600');
            estEl.classList.replace('dark:text-indigo-400', 'dark:text-emerald-400');
        } else {
            estEl.innerText = predictCompletionDate(remaining);
        }
    }
}

function predictCompletionDate(remainingHours) {
    let dailyNetHours = parseFloat(calculateHours(userProfile.shift_start, userProfile.shift_end, 60));
    if (isNaN(dailyNetHours) || dailyNetHours <= 0) dailyNetHours = 8; 

    let daysNeeded = Math.ceil(remainingHours / dailyNetHours);
    let currentDate = new Date();

    while (daysNeeded > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        
        const yyyymmdd = `${yyyy}-${mm}-${dd}`;
        const mmdd = `${mm}-${dd}`;
        
        const isAnnualHoliday = defaultPHHolidays.some(h => h.date === mmdd);
        const isCustomHoliday = customHolidays.some(h => h.date === yyyymmdd);

        if (workDays.includes(dayOfWeek) && !isAnnualHoliday && !isCustomHoliday) {
            daysNeeded--;
        }
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// --- SORTING & RENDERING ---
function filterLogs() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const weeks = document.querySelectorAll('.week-group-container');
    weeks.forEach(week => {
        const text = week.innerText.toLowerCase();
        week.style.display = text.includes(query) ? 'block' : 'none';
    });
}

function toggleSortOrder() {
    sortOrderDesc = !sortOrderDesc;
    document.getElementById('sortBtnText').innerText = sortOrderDesc ? "Sort: Latest First" : "Sort: Oldest First";
    renderDashboard();
}

async function fetchLogs() {
    try {
        const res = await fetch('/api/logs');
        if (res.status === 401) window.location.href = '/';
        allLogs = await res.json();
        
        groupedLogs = {};
        allLogs.forEach(log => {
            const week = log.week_label || "Uncategorized";
            if (!groupedLogs[week]) groupedLogs[week] = [];
            groupedLogs[week].push(log);
        });
        
        renderDashboard();
        updateProgressTracker();
        filterLogs();
    } catch (e) {
        console.error("Failed to fetch logs", e);
    }
}

function renderDashboard() {
    const container = document.getElementById('dashboard-views');
    if (!container) return;
    container.innerHTML = '';
    
    let weekKeys = Object.keys(groupedLogs).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    if (sortOrderDesc) weekKeys.reverse();
    
    weekKeys.forEach(week => {
        let html = `<div class="week-group-container bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
            <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 class="font-bold text-slate-800 dark:text-white">${week}</h3>
                <button onclick="confirmDeleteWeek('${week}')" class="text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg transition-colors">Delete Week</button>
            </div>
            <div class="p-6 overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <tr><th class="px-4 py-3">Date</th><th class="px-4 py-3">In</th><th class="px-4 py-3">Out</th><th class="px-4 py-3 text-center">Lunch</th><th class="px-4 py-3">Hrs (Net)</th><th class="px-4 py-3 text-right">Actions</th></tr>
                    </thead>
                    <tbody>`;
        
        let wTotal = 0;
        groupedLogs[week].forEach(log => {
            const netHrs = parseFloat(calculateHours(log.time_in, log.time_out, (log.lunch_hours || 0) * 60));
            wTotal += netHrs;
            const isNa = log.time_in === "N/A";
            const hrsDisplay = isNa ? `<span class="text-slate-400 dark:text-slate-500">N/A</span>` : `<span class="font-bold text-blue-600 dark:text-blue-400">${formatHM(netHrs)}</span>`;
            const lunchDisplay = isNa ? `-` : `${(log.lunch_hours || 0) * 60}m`;
            
            html += `<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">${log.date}</td>
                <td class="px-4 py-3 ${isNa ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}">${log.time_in}</td>
                <td class="px-4 py-3 ${isNa ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}">${log.time_out}</td>
                <td class="px-4 py-3 text-center text-slate-500 dark:text-slate-400">${lunchDisplay}</td>
                <td class="px-4 py-3">${hrsDisplay}</td>
                <td class="px-4 py-3 text-right">
                    <button onclick="openEditLog(${log.id})" class="text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors mr-2"><svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onclick="confirmDelete(${log.id})" class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"><svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>
            <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm">
                <span class="font-semibold text-slate-600 dark:text-slate-400">Weekly Total (Net)</span>
                <span class="font-bold text-lg text-slate-900 dark:text-white">${formatHM(wTotal)}</span>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// --- SUBMIT LOGS ---
async function submitSingleLog() {
    let week = cleanWeekStr(document.getElementById('sWeek').value);
    const date = document.getElementById('sDate').value;
    const isNa = document.getElementById('sNa').checked;
    let timeIn = document.getElementById('sTimeIn').value;
    let timeOut = document.getElementById('sTimeOut').value;
    let lunchMins = parseFloat(document.getElementById('sLunch').value) || 0;
    
    if (!date) return alert("Select a date.");
    if (isNa) { timeIn = "N/A"; timeOut = "N/A"; lunchMins = 0; }
    else if (!timeIn || !timeOut) return alert("Fill all time fields or mark as N/A.");
    
    await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_label: week, date, time_in: timeIn, time_out: timeOut, lunch_hours: lunchMins/60, hours: parseFloat(calculateHours(timeIn, timeOut, lunchMins)) })
    });
    toggleModal('singleLogModal');
    fetchLogs();
}

async function submitBatchLogs() {
    let week = cleanWeekStr(document.getElementById('bWeek').value);
    const startStr = document.getElementById('wStartDate').value;
    if (!startStr) return alert("Select a starting date");
    let baseDate = new Date(startStr);

    for (let i = 0; i < 5; i++) {
        let tIn = document.getElementById(`bIn_${i}`).value;
        let tOut = document.getElementById(`bOut_${i}`).value;
        let lunchMins = parseFloat(document.getElementById(`bLunch_${i}`).value) || 0;
        
        if (!tIn && !tOut) { tIn = "N/A"; tOut = "N/A"; lunchMins = 0; }
        
        if (tIn && tOut) {
            let logDate = new Date(baseDate);
            logDate.setDate(baseDate.getDate() + i);
            const dateStr = logDate.toISOString().split('T')[0];
            
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ week_label: week, date: dateStr, time_in: tIn, time_out: tOut, lunch_hours: lunchMins/60, hours: parseFloat(calculateHours(tIn, tOut, lunchMins)) })
            });
        }
    }
    toggleModal('weeklyLogModal');
    fetchLogs();
}

// --- EDIT & DELETE ---
function openEditLog(id) {
    const log = allLogs.find(l => l.id === id);
    if (!log) return;
    document.getElementById('editLogId').value = log.id;
    document.getElementById('eWeek').value = log.week_label;
    
    const dp = document.getElementById('eDate')._flatpickr;
    if (dp) dp.setDate(log.date);
    
    const tin = document.getElementById('eTimeIn')._flatpickr;
    if (tin && log.time_in !== "N/A") tin.setDate(log.time_in);
    
    const tout = document.getElementById('eTimeOut')._flatpickr;
    if (tout && log.time_out !== "N/A") tout.setDate(log.time_out);
    
    document.getElementById('eLunch').value = (log.lunch_hours || 0) * 60;
    toggleModal('editLogModal');
}

async function submitEditLog() {
    const id = document.getElementById('editLogId').value;
    let week = cleanWeekStr(document.getElementById('eWeek').value);
    const date = document.getElementById('eDate').value;
    let timeIn = document.getElementById('eTimeIn').value || "N/A";
    let timeOut = document.getElementById('eTimeOut').value || "N/A";
    let lunchMins = parseFloat(document.getElementById('eLunch').value) || 0;
    
    if (!date) return alert("Select a date.");
    
    await fetch(`/api/logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_label: week, date, time_in: timeIn, time_out: timeOut, lunch_hours: lunchMins/60, hours: parseFloat(calculateHours(timeIn, timeOut, lunchMins)) })
    });
    toggleModal('editLogModal');
    fetchLogs();
}

function confirmDelete(id) {
    activeDeleteId = id;
    toggleModal('deleteConfirmModal');
}
const delBtn = document.getElementById('confirmDeleteBtn');
if (delBtn) {
    delBtn.addEventListener('click', async () => {
        if (activeDeleteId) {
            await fetch(`/api/logs/${activeDeleteId}`, { method: 'DELETE' });
            toggleModal('deleteConfirmModal');
            fetchLogs();
        }
    });
}

function confirmDeleteWeek(week) {
    activeDeleteWeek = week;
    document.getElementById('deleteWeekTargetName').innerText = week;
    toggleModal('deleteWeekConfirmModal');
}
async function executeDeleteWeek() {
    if (!activeDeleteWeek || !groupedLogs[activeDeleteWeek]) return;
    const logs = groupedLogs[activeDeleteWeek];
    for (let log of logs) {
        await fetch(`/api/logs/${log.id}`, { method: 'DELETE' });
    }
    toggleModal('deleteWeekConfirmModal');
    fetchLogs();
}

// --- PRINTING ---
function populatePrintCheckboxes() {
    const container = document.getElementById('weekCheckboxes');
    if (!container) return;
    container.innerHTML = Object.keys(groupedLogs).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).map(week => `
        <label class="flex items-center p-2 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-700 rounded transition-colors">
            <input type="checkbox" class="print-week-cb w-4 h-4 text-slate-800 rounded focus:ring-slate-800" value="${week}" checked>
            <span class="ml-3 text-sm font-semibold text-slate-700 dark:text-slate-300">${week}</span>
        </label>
    `).join('');
}

function executePrint() {
    const comp = document.getElementById('inputCompName').value || "Company Name";
    const sName = document.getElementById('inputSupName').value || "Supervisor Name";
    const sTitle = document.getElementById('inputSupTitle').value || "Supervisor Title";
    
    const iName = userProfile.name || "Intern Name";
    const iTitle = userProfile.title || "Project Manager";
    const logoSrc = userProfile.logo_data || "";
    
    localStorage.setItem('dtr_comp', comp);
    localStorage.setItem('dtr_sup', sName);
    localStorage.setItem('dtr_title', sTitle);

    const container = document.getElementById('print-data-container');
    if (!container) return;
    container.innerHTML = '';
    
    const checkboxes = Array.from(document.querySelectorAll('.print-week-cb:checked'));
    const selectedWeeks = checkboxes.map(cb => cb.value);
    
    for (let i = 0; i < selectedWeeks.length; i += 2) {
        const weekChunk = selectedWeeks.slice(i, i + 2);
        
        let pageHtml = `<div class="print-page" style="page-break-after: always; padding: 20px 0;">`;
        
        pageHtml += `
            <div class="doc-header" style="text-align: center; margin-bottom: 30px;">
                ${logoSrc ? `<img src="${logoSrc}" style="height: 60px; margin-bottom: 10px; display: inline-block;">` : ''}
                <div style="font-weight: 800; font-size: 18px; text-transform: uppercase; color: #0f172a;">${comp}</div>
                <div style="font-size: 12px; font-weight: 600; color: #64748b; letter-spacing: 2px;">DAILY TIME RECORD</div>
                <hr style="margin-top: 15px; border-top: 1px solid #cbd5e1;">
            </div>
        `;
        
        weekChunk.forEach(week => {
            const logs = groupedLogs[week];
            let total = 0;
            
            let tableHtml = `
            <div class="print-week-group" style="margin-bottom: 40px; break-inside: avoid;">
                <div style="font-weight: 700; margin-bottom: 10px; background: #f8fafc; padding: 6px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155;">${week}</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; text-align: center;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #475569;">
                            <th style="border: 1px solid #cbd5e1; padding: 8px;">Date</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px;">Time In</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px;">Time Out</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px;">Lunch Deduct</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px;">Net Hours</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            logs.forEach(log => {
                const netHrs = parseFloat(calculateHours(log.time_in, log.time_out, (log.lunch_hours || 0) * 60));
                total += netHrs;
                const isNa = log.time_in === "N/A";
                const hrsDisplay = isNa ? "N/A" : formatHM(netHrs);
                const lunchDisplay = isNa ? "-" : `${(log.lunch_hours || 0) * 60}m`;
                
                tableHtml += `
                    <tr style="color: #334155;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px;">${log.date}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px;">${log.time_in}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px;">${log.time_out}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px;">${lunchDisplay}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${hrsDisplay}</td>
                    </tr>`;
            });
            
            tableHtml += `
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc; font-weight: 700; color: #0f172a;">
                            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Total for ${week}:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">${formatHM(total)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <div style="display: flex; justify-content: space-between; margin-top: 30px; padding: 0 40px;">
                    <div style="width: 40%; text-align: center;">
                        <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 800; font-size: 12px; text-transform: uppercase;">${iName}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${iTitle}</div>
                    </div>
                    <div style="width: 40%; text-align: center;">
                        <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: 800; font-size: 12px; text-transform: uppercase;">${sName}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${sTitle}</div>
                    </div>
                </div>
            </div>`;
            
            pageHtml += tableHtml;
        });
        
        pageHtml += `</div>`; 
        container.innerHTML += pageHtml;
    }
    
    toggleModal('printSettingsModal');
    setTimeout(() => {
        window.print();
    }, 300);
}

// --- ON INIT ---
window.onload = async () => { 
    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            const user = await res.json();
            googleProfileName = user.name;
            if (document.getElementById('userAvatar') && user.picture) document.getElementById('userAvatar').src = user.picture;
            
            await fetchProfile();
            checkOnboarding(googleProfileName);
        }
    } catch (e) {
        console.error("Auth skipped or failed:", e);
    }
    
    if (document.getElementById('dashboard-views')) fetchLogs();
    
    if (document.getElementById('inputCompName')) document.getElementById('inputCompName').value = localStorage.getItem('dtr_comp') || "Company Name";
    if (document.getElementById('inputSupName')) document.getElementById('inputSupName').value = localStorage.getItem('dtr_sup') || "";
    if (document.getElementById('inputSupTitle')) document.getElementById('inputSupTitle').value = localStorage.getItem('dtr_title') || "Supervisor Title";
};