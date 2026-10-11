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
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!('theme' in localStorage)) {
        if (e.matches) { document.documentElement.classList.add('dark'); } 
        else { document.documentElement.classList.remove('dark'); }
    }
});

// --- GLOBAL VARIABLES ---
let googleProfileName = "";
let allLogs = [];
let groupedLogs = {};
let activeDeleteId = null;

// --- INITIALIZE PICKERS & UI ---
flatpickr(".flatpickr-date", { altInput: true, altFormat: "F j, Y", dateFormat: "Y-m-d" });
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

// --- PROFILE MANAGEMENT ---
function checkOnboarding(googleName) {
    const savedName = localStorage.getItem('dtr_intern_name');
    if (!savedName) {
        document.getElementById('onboardName').value = googleName;
        document.getElementById('onboardModalTitle').innerText = "Welcome to DTR";
        document.getElementById('onboardCloseBtn').classList.add('hidden');
        toggleModal('onboardingModal');
    }
}

function openEditProfile() {
    document.getElementById('onboardName').value = localStorage.getItem('dtr_intern_name') || googleProfileName;
    document.getElementById('onboardTitle').value = localStorage.getItem('dtr_intern_title') || "Project Manager";
    document.getElementById('onboardModalTitle').innerText = "Edit Profile";
    document.getElementById('onboardCloseBtn').classList.remove('hidden');
    toggleModal('onboardingModal');
}

function saveOnboarding() {
    const name = document.getElementById('onboardName').value || googleProfileName;
    const title = document.getElementById('onboardTitle').value || "Project Manager";
    
    localStorage.setItem('dtr_intern_name', name);
    localStorage.setItem('dtr_intern_title', title);
    
    applyInternProfile(name, title);
    toggleModal('onboardingModal');
}

function applyInternProfile(name, title) {
    if (document.getElementById('userName')) document.getElementById('userName').innerText = name;
    if (document.getElementById('headerInternTitle')) document.getElementById('headerInternTitle').innerText = title;
    if (document.getElementById('printInternName')) document.getElementById('printInternName').innerText = name;
    if (document.getElementById('printInternTitle')) document.getElementById('printInternTitle').innerText = title;
}

// --- MODALS ---
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
    inInput.disabled = isNa;
    outInput.disabled = isNa;
    lunchInput.disabled = isNa;
    if (isNa) { inInput.value = ""; outInput.value = ""; lunchInput.value = "0"; }
}

// --- LOGO HANDLING ---
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
    reader.onload = e => {
        localStorage.setItem('dtr_logo', e.target.result);
        const printLogo = document.getElementById('printLogo');
        if (printLogo) { printLogo.src = e.target.result; printLogo.style.display = 'block'; }
        updateLogoIndicator();
    };
    if (event.target.files[0]) reader.readAsDataURL(event.target.files[0]);
}

function removeLogo() {
    localStorage.removeItem('dtr_logo');
    
    const printLogo = document.getElementById('printLogo');
    if (printLogo) { printLogo.src = ''; printLogo.style.display = 'none'; }
    
    const label = document.getElementById('logoUploadLabel');
    if (label) {
        label.classList.replace('bg-emerald-50', 'bg-slate-100');
        label.classList.replace('text-emerald-700', 'text-slate-700');
        label.classList.replace('dark:bg-emerald-900/30', 'dark:bg-slate-700');
        label.classList.replace('dark:text-emerald-400', 'dark:text-slate-200');
        label.innerHTML = `<span>Upload Logo</span><input type="file" id="logoUpload" class="hidden" accept="image/*" onchange="handleLogoUpload(event)">`;
    }
    
    const removeBtn = document.getElementById('removeLogoBtn');
    if (removeBtn) removeBtn.classList.add('hidden');
    
    const fileInput = document.getElementById('logoUpload');
    if (fileInput) fileInput.value = '';
}

// --- TIME LOGIC ---
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
    if (!inT || !outT) return 0;
    
    let dIn = new Date(2000, 0, 1, inT.h, inT.m);
    let dOut = new Date(2000, 0, 1, outT.h, outT.m);
    if (dOut < dIn) dOut.setDate(dOut.getDate() + 1);
    
    let diffHours = ((dOut - dIn) / (1000 * 60 * 60)) - (lunchMins / 60);
    return Math.max(0, diffHours).toFixed(2);
}

// --- API FETCH & RENDER ---
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
    } catch (e) {
        console.error("Failed to fetch logs", e);
    }
}

function renderDashboard() {
    const container = document.getElementById('dashboard-views');
    if (!container) return;
    container.innerHTML = '';
    
    Object.keys(groupedLogs).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(week => {
        let html = `<div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 class="font-bold text-slate-800 dark:text-white">${week}</h3>
            </div>
            <div class="p-6 overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <tr><th class="px-4 py-3">Date</th><th class="px-4 py-3">In</th><th class="px-4 py-3">Out</th><th class="px-4 py-3 text-center">Lunch</th><th class="px-4 py-3">Hrs (Net)</th><th class="px-4 py-3 text-right">Act</th></tr>
                    </thead>
                    <tbody>`;
        
        let wTotal = 0;
        groupedLogs[week].forEach(log => {
            wTotal += log.hours;
            const isNa = log.time_in === "N/A";
            const hrsDisplay = isNa ? `<span class="text-slate-400 dark:text-slate-500">N/A</span>` : `<span class="font-bold text-blue-600 dark:text-blue-400">${log.hours.toFixed(2)}</span>`;
            const lunchDisplay = isNa ? `-` : `${(log.lunch_hours || 0) * 60}m`;
            
            html += `<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">${log.date}</td>
                <td class="px-4 py-3 ${isNa ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}">${log.time_in}</td>
                <td class="px-4 py-3 ${isNa ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}">${log.time_out}</td>
                <td class="px-4 py-3 text-center text-slate-500 dark:text-slate-400">${lunchDisplay}</td>
                <td class="px-4 py-3">${hrsDisplay}</td>
                <td class="px-4 py-3 text-right">
                    <button onclick="confirmDelete(${log.id})" class="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"><svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>
            <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm">
                <span class="font-semibold text-slate-600 dark:text-slate-400">Weekly Total (Net)</span>
                <span class="font-bold text-lg text-slate-900 dark:text-white">${wTotal.toFixed(2)} Hrs</span>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// --- SUBMIT LOGS ---
async function submitSingleLog() {
    let week = document.getElementById('sWeek').value || "Week 1";
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
    let week = document.getElementById('bWeek').value || "Week 1";
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

// --- PROGRESS TRACKER ---
function updateProgressTracker() {
    const targetInput = document.getElementById('targetHoursInput');
    if (!targetInput) return;
    
    // Save exactly what the user types (even if it's empty)
    localStorage.setItem('dtr_target_hours', targetInput.value);
    
    let target = parseFloat(targetInput.value);
    if (isNaN(target) || target < 0) target = 0;
    
    let totalHours = 0;
    allLogs.forEach(log => { totalHours += (log.hours || 0); });
    
    let percent = 0;
    let remaining = 0;
    
    if (target > 0) {
        percent = Math.min(100, Math.max(0, (totalHours / target) * 100));
        remaining = Math.max(0, target - totalHours);
    }
    
    // Update Text
    document.getElementById('progressPercent').innerText = `${Math.round(percent)}%`;
    document.getElementById('progressHours').innerText = totalHours.toFixed(1);
    document.getElementById('progressTarget').innerText = target > 0 ? target : "0";
    
    if (target > 0) {
        document.getElementById('progressRemaining').innerText = `${remaining.toFixed(1)}h remaining`;
    } else {
        document.getElementById('progressRemaining').innerText = `Set target to calculate`;
    }
    
    // Update Bars
    document.getElementById('linearProgressBar').style.width = `${percent}%`;
    
    const isDark = document.documentElement.classList.contains('dark');
    const emptyColor = isDark ? '#334155' : '#e2e8f0'; 
    document.getElementById('circularProgressWrapper').style.background = `conic-gradient(#10b981 ${percent}%, ${emptyColor} ${percent}%)`;
}

// Update this block near the bottom of window.onload:
    const targetInput = document.getElementById('targetHoursInput');
    if (targetInput) {
        targetInput.value = localStorage.getItem('dtr_target_hours') || "";
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
    
    localStorage.setItem('dtr_comp', comp);
    localStorage.setItem('dtr_sup', sName);
    localStorage.setItem('dtr_title', sTitle);

    if (document.getElementById('printCompanyDisplay')) document.getElementById('printCompanyDisplay').innerText = comp;
    if (document.getElementById('printSupNameDisplay')) document.getElementById('printSupNameDisplay').innerText = sName;
    if (document.getElementById('printSupTitleDisplay')) document.getElementById('printSupTitleDisplay').innerText = sTitle;

    const container = document.getElementById('print-data-container');
    if (container) {
        container.innerHTML = '';
        const checkboxes = document.querySelectorAll('.print-week-cb:checked');
        checkboxes.forEach(cb => {
            const week = cb.value;
            const logs = groupedLogs[week];
            
            let html = `<div class="print-week-group">
                <div class="week-header">${week}</div>
                <table>
                    <thead><tr><th>Date</th><th>Time In</th><th>Time Out</th><th>Lunch Deduct</th><th>Net Hours</th></tr></thead>
                    <tbody>`;
            
            let total = 0;
            logs.forEach(log => {
                total += log.hours;
                const isNa = log.time_in === "N/A";
                const hrsDisplay = isNa ? "N/A" : log.hours.toFixed(2);
                const lunchDisplay = isNa ? "-" : `${(log.lunch_hours || 0) * 60}m`;
                html += `<tr><td>${log.date}</td><td>${log.time_in}</td><td>${log.time_out}</td><td>${lunchDisplay}</td><td>${hrsDisplay}</td></tr>`;
            });
            
            html += `</tbody>
                    <tfoot><tr class="total-row"><th colspan="4" style="text-align: right; padding-right: 20px;">Total for ${week}:</th><th>${total.toFixed(2)}</th></tr></tfoot>
                </table>
            </div>`;
            container.innerHTML += html;
        });
    }
    window.print();
}

// --- ON INIT ---
window.onload = async () => { 
    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            const user = await res.json();
            googleProfileName = user.name;
            if (document.getElementById('userAvatar') && user.picture) document.getElementById('userAvatar').src = user.picture;
            
            checkOnboarding(googleProfileName);
            
            const storedName = localStorage.getItem('dtr_intern_name') || googleProfileName;
            const storedTitle = localStorage.getItem('dtr_intern_title') || "Project Manager";
            
            applyInternProfile(storedName, storedTitle);
        }
    } catch (e) {
        console.error("Auth skipped or failed:", e);
    }
    
    if (document.getElementById('dashboard-views')) fetchLogs();
    
    const savedLogo = localStorage.getItem('dtr_logo');
    if (savedLogo) {
        const printLogo = document.getElementById('printLogo');
        if (printLogo) { printLogo.src = savedLogo; printLogo.style.display = 'block'; }
        updateLogoIndicator(); // Shows the remove button if a logo exists on load
    }
    
    if (document.getElementById('inputCompName')) document.getElementById('inputCompName').value = localStorage.getItem('dtr_comp') || "Company Name";
    if (document.getElementById('inputSupName')) document.getElementById('inputSupName').value = localStorage.getItem('dtr_sup') || "";
    if (document.getElementById('inputSupTitle')) document.getElementById('inputSupTitle').value = localStorage.getItem('dtr_title') || "Supervisor Title";
};

