/**
 * Smart Student Attendance System - Fixed & Polished
 */

// ================= CONSTANTS & STATE =================
const API_URL = "http://localhost:3000";
const ADMIN_USER = { username: 'admin', password: 'admin', role: 'admin' };
const TODAY = new Date().toISOString().split('T')[0];

let students = []; 
let attendanceRecords = {}; 
let pendingRequests = []; 
let notificationHistory = {}; 
let currentAdminUser = null;
let currentStudentUser = null;
let selectedDate = TODAY;

// ================= INIT & LOAD DATA =================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Set default dates
    document.getElementById('attendanceDate').value = TODAY;
    const now = new Date();
    document.getElementById('reportMonthInput').value = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}`;
    
    // CHECK SESSION (Fix for refresh logout)
    checkSession();
});

function loadData() {
    try {
        students = JSON.parse(localStorage.getItem('students')) || [];
        attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || {};
        pendingRequests = JSON.parse(localStorage.getItem('pendingRequests')) || [];
        notificationHistory = JSON.parse(localStorage.getItem('notificationHistory')) || {};
    } catch (e) {
        console.error("Data load error", e);
    }
}

function saveData() {
    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));
    localStorage.setItem('notificationHistory', JSON.stringify(notificationHistory));
}

// ================= AUTHENTICATION & SESSION =================

function checkSession() {
    const savedRole = localStorage.getItem('sessionRole');
    const savedUser = JSON.parse(localStorage.getItem('sessionUser'));

    if (savedRole && savedUser) {
        showDashboard(savedRole, savedUser);
    } else {
        showDashboard('auth');
    }
}

function loginUser(role, user) {
    localStorage.setItem('sessionRole', role);
    localStorage.setItem('sessionUser', JSON.stringify(user));
    showDashboard(role, user);
}

function logoutUser() {
    localStorage.removeItem('sessionRole');
    localStorage.removeItem('sessionUser');
    currentAdminUser = null;
    currentStudentUser = null;
    showDashboard('auth');
}

// Tab Switching
document.getElementById('signInTab').addEventListener('click', () => toggleAuthForms(true));
document.getElementById('signUpTab').addEventListener('click', () => toggleAuthForms(false));

function toggleAuthForms(isSignIn) {
    document.getElementById('signInForm').classList.toggle('hidden', !isSignIn);
    document.getElementById('signUpForm').classList.toggle('hidden', isSignIn);
    
    const activeClass = ['border-b-2', 'border-purple-600', 'text-purple-700', 'font-bold'];
    const inactiveClass = ['text-gray-500'];
    
    const inTab = document.getElementById('signInTab');
    const upTab = document.getElementById('signUpTab');

    if(isSignIn) {
        inTab.classList.add(...activeClass); inTab.classList.remove(...inactiveClass);
        upTab.classList.remove(...activeClass); upTab.classList.add(...inactiveClass);
    } else {
        upTab.classList.add(...activeClass); upTab.classList.remove(...inactiveClass);
        inTab.classList.remove(...activeClass); inTab.classList.add(...inactiveClass);
    }
}

// Login Submit
document.getElementById('signInForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const role = document.getElementById('loginRole').value;

    if (role === 'admin' && u === ADMIN_USER.username && p === ADMIN_USER.password) {
        loginUser('admin', ADMIN_USER);
        showToast("Welcome Admin!", "success");
    } else if (role === 'student') {
        const s = students.find(stu => stu.username === u && stu.password === p);
        if (s) {
            loginUser('student', s);
            showToast(`Welcome ${s.name}`, "success");
        } else {
            showToast("Invalid Student Credentials", "error");
        }
    } else {
        showToast("Invalid Credentials", "error");
    }
});

// Register Submit
document.getElementById('signUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signUpSubmitBtn');
    btn.disabled = true; btn.innerText = "Processing...";

    const id = document.getElementById('signUpId').value.trim().toUpperCase();
    
    if (students.some(s => s.id === id)) {
        showToast("Student ID already exists", "error");
        btn.disabled = false; btn.innerText = "Register";
        return;
    }

    // Handle File Upload
    const fileInput = document.getElementById('signUpPhotoFile');
    let photoUrl = null;

    if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('studentPhoto', fileInput.files[0]);
        try {
            const res = await fetch(`${API_URL}/upload-photo`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) photoUrl = data.photoUrl;
        } catch (err) {
            console.error(err); // Fail silently for photo, continue reg
        }
    }

    const newStudent = {
        id: id,
        name: document.getElementById('signUpName').value.trim(),
        email: document.getElementById('signUpEmail').value.trim(),
        class: document.getElementById('signUpClass').value.trim(),
        username: document.getElementById('signUpUsername').value.trim(),
        password: document.getElementById('signUpPassword').value.trim(),
        photo: photoUrl
    };

    students.push(newStudent);
    saveData();
    showToast("Registration Successful!", "success");
    e.target.reset();
    toggleAuthForms(true);
    btn.disabled = false; btn.innerText = "Register";
});

// ================= NAVIGATION =================
function showDashboard(view, user = null) {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');

    if (view === 'admin') {
        currentAdminUser = user;
        document.getElementById('adminDashboard').classList.remove('hidden');
        renderAdminDailyView();
    } else if (view === 'student') {
        currentStudentUser = user;
        document.getElementById('studentDashboard').classList.remove('hidden');
        renderStudentSelf(user);
    } else {
        document.getElementById('authPage').classList.remove('hidden');
    }
}

document.getElementById('logoutBtnAdmin').addEventListener('click', logoutUser);
document.getElementById('logoutBtnStudent').addEventListener('click', logoutUser);

// Admin View Switching (Daily vs Report)
document.getElementById('tabDaily').addEventListener('click', () => toggleAdminView('daily'));
document.getElementById('tabReport').addEventListener('click', () => toggleAdminView('report'));

function toggleAdminView(viewName) {
    const dailyContainer = document.getElementById('dailyViewContainer');
    const reportContainer = document.getElementById('reportViewContainer');
    const tabDaily = document.getElementById('tabDaily');
    const tabReport = document.getElementById('tabReport');

    if (viewName === 'daily') {
        dailyContainer.classList.remove('hidden');
        reportContainer.classList.add('hidden');
        tabDaily.classList.add('bg-white', 'text-purple-700', 'shadow');
        tabDaily.classList.remove('text-gray-500');
        tabReport.classList.remove('bg-white', 'text-purple-700', 'shadow');
        tabReport.classList.add('text-gray-500');
    } else {
        dailyContainer.classList.add('hidden');
        reportContainer.classList.remove('hidden');
        tabReport.classList.add('bg-white', 'text-purple-700', 'shadow');
        tabReport.classList.remove('text-gray-500');
        tabDaily.classList.remove('bg-white', 'text-purple-700', 'shadow');
        tabDaily.classList.add('text-gray-500');
        renderMonthlyReport(); // Trigger report generation
    }
}

// ================= ADMIN LOGIC (DAILY) =================

document.getElementById('attendanceDate').addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderAdminDailyView();
});

document.getElementById('scanBtn').addEventListener('click', () => {
    const input = document.getElementById('scanInput');
    const id = input.value.trim().toUpperCase();
    const student = students.find(s => s.id === id);

    if (!student) {
        showToast("Student not found", "error");
        return;
    }
    
    const current = getAttendanceStatus(id, selectedDate);
    markAttendance(id, !current, selectedDate);
    
    showToast(`${student.name} marked ${!current ? "PRESENT" : "ABSENT"}`, !current ? "success" : "warning");
    input.value = ""; input.focus();
});

function getAttendanceStatus(id, date) {
    return attendanceRecords[id] && attendanceRecords[id][date];
}

function markAttendance(id, status, date) {
    if (!attendanceRecords[id]) attendanceRecords[id] = {};
    attendanceRecords[id][date] = status;
    saveData();
    renderAdminDailyView();
}

function renderAdminDailyView() {
    const date = selectedDate;
    const list = document.getElementById('studentTable');
    list.innerHTML = '';
    
    let pCount = 0, aCount = 0;

    students.forEach(s => {
        const isP = getAttendanceStatus(s.id, date) === true;
        if(isP) pCount++; else aCount++;

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="p-3"><img src="${s.photo || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full object-cover border"></td>
            <td class="p-3">${s.id}</td>
            <td class="p-3">${s.name}</td>
            <td class="p-3">${s.class}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${isP ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${isP ? 'PRESENT' : 'ABSENT'}</span></td>
            <td class="p-3"><button onclick="toggleStatus('${s.id}')" class="text-blue-600 hover:underline text-sm">Toggle</button></td>
        `;
        list.appendChild(row);
    });

    document.getElementById('totalCount').innerText = students.length;
    document.getElementById('presentCount').innerText = pCount;
    document.getElementById('absentCount').innerText = aCount;

    renderPendingRequests();
    renderNotificationTable();
}

window.toggleStatus = (id) => {
    const current = getAttendanceStatus(id, selectedDate);
    markAttendance(id, !current, selectedDate);
};

function renderPendingRequests() {
    const table = document.getElementById('pendingTable');
    table.innerHTML = '';
    if(pendingRequests.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">No pending requests</td></tr>';
        return;
    }
    pendingRequests.forEach((req, idx) => {
        const row = document.createElement('tr');
        row.className = "border-b";
        row.innerHTML = `
            <td class="p-3">${req.id}</td>
            <td class="p-3">${req.name}</td>
            <td class="p-3">${req.class}</td>
            <td class="p-3 flex gap-2">
                <button onclick="handleRequest(${idx}, true)" class="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600">Accept</button>
                <button onclick="handleRequest(${idx}, false)" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">Reject</button>
            </td>
        `;
        table.appendChild(row);
    });
}

window.handleRequest = (index, approve) => {
    const req = pendingRequests[index];
    if(approve) {
        markAttendance(req.id, true, TODAY);
        showToast(`Approved ${req.name}`, "success");
    }
    pendingRequests.splice(index, 1);
    saveData();
    renderPendingRequests();
};

function renderNotificationTable() {
    const table = document.getElementById('notificationTableBody');
    table.innerHTML = '';
    let hasUrgent = false;

    students.forEach(s => {
        const absences = getConsecutiveAbsences(s.id);
        const alreadySent = notificationHistory[s.id] && notificationHistory[s.id][TODAY];

        if (absences >= 3 && !alreadySent) {
            hasUrgent = true;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-3">${s.id}</td>
                <td class="p-3">${s.name}</td>
                <td class="p-3 font-bold text-red-600">${absences} Days</td>
                <td class="p-3">
                    <button onclick="sendEmail('${s.id}', '${s.email}', this)" class="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm">Send Alert</button>
                </td>
            `;
            table.appendChild(row);
        }
    });

    if(!hasUrgent) table.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">No urgent alerts needed today.</td></tr>';
}

function getConsecutiveAbsences(id) {
    let count = 0;
    let d = new Date(selectedDate);
    for(let i=0; i<7; i++) {
        const dateStr = d.toISOString().split('T')[0];
        if(getAttendanceStatus(id, dateStr) === true) break;
        count++;
        d.setDate(d.getDate() - 1);
    }
    return count;
}

window.sendEmail = async (id, email, btn) => {
    btn.innerText = "Sending..."; btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/send-email`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ to: email, subject: `Attendance Warning: ${id}`, body: `Student ${id} is absent for 3+ days.` })
        });
        const data = await res.json();
        if(data.success) {
            showToast("Email Sent!", "success");
            if(!notificationHistory[id]) notificationHistory[id] = {};
            notificationHistory[id][TODAY] = true;
            saveData();
            renderNotificationTable();
        } else throw new Error(data.message);
    } catch (err) {
        showToast("Email failed", "error");
        btn.innerText = "Retry"; btn.disabled = false;
    }
};

// ================= REPORT LOGIC (FIXED) =================
document.getElementById('reportMonthInput').addEventListener('change', renderMonthlyReport);

function renderMonthlyReport() {
    const input = document.getElementById('reportMonthInput').value;
    if(!input) return;

    const [year, month] = input.split('-').map(Number); // month is 1-12
    const daysInMonth = new Date(year, month, 0).getDate();
    const tHead = document.getElementById('reportHead');
    const tBody = document.getElementById('reportBody');

    // 1. Build Header
    let headHTML = '<tr><th class="p-3 bg-gray-200 sticky left-0 z-20">Name</th><th class="p-3 bg-gray-200">ID</th>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        headHTML += `<th class="p-2 text-center min-w-[40px] ${isWeekend ? 'bg-red-50 text-red-400' : ''}">
            <div class="text-xs text-gray-500">${dayName}</div>
            <div>${d}</div>
        </th>`;
    }
    headHTML += '<th class="p-3 bg-green-100 text-center">P</th><th class="p-3 bg-red-100 text-center">A</th></tr>';
    tHead.innerHTML = headHTML;

    // 2. Build Rows
    tBody.innerHTML = '';
    students.forEach(s => {
        let pCount = 0;
        let aCount = 0;
        let rowHTML = `<tr class="border-b hover:bg-gray-50">
            <td class="p-3 sticky left-0 bg-white font-medium z-10 border-r">${s.name}</td>
            <td class="p-3 border-r text-gray-500 text-xs">${s.id}</td>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dateObj = new Date(year, month - 1, d);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            
            const isP = getAttendanceStatus(s.id, dateStr);
            
            let cellContent = '-';
            let cellClass = isWeekend ? 'bg-gray-100' : '';

            if(isP === true) {
                cellContent = '✔';
                cellClass = 'text-green-600 font-bold bg-green-50';
                pCount++;
            } else if (isP === false) {
                cellContent = '✘';
                cellClass = 'text-red-600 font-bold bg-red-50';
                aCount++;
            } else if (!isWeekend) {
                 // Absent by default if not marked and not weekend
                 cellContent = '';
                 aCount++; // Optional: Don't count "future" days or unmarked days as absent if you prefer
            }

            rowHTML += `<td class="p-2 text-center border-r ${cellClass}">${cellContent}</td>`;
        }

        rowHTML += `<td class="p-3 text-center font-bold text-green-700 bg-green-50">${pCount}</td>`;
        rowHTML += `<td class="p-3 text-center font-bold text-red-700 bg-red-50">${aCount}</td>`;
        rowHTML += '</tr>';
        tBody.innerHTML += rowHTML;
    });
}

// ================= STUDENT LOGIC =================
document.getElementById('requestBtn').addEventListener('click', () => {
    const inputId = document.getElementById('scanInputStudent').value;
    if(!currentStudentUser || inputId !== currentStudentUser.id) return showToast("ID Mismatch", "error");
    if(pendingRequests.some(r => r.id === inputId)) return showToast("Already Pending", "warning");
    if(getAttendanceStatus(inputId, TODAY)) return showToast("Already Present", "success");

    pendingRequests.push(currentStudentUser);
    saveData();
    showToast("Request Sent", "info");
    renderStudentSelf(currentStudentUser);
});

function renderStudentSelf(user) {
    document.getElementById('scanInputStudent').value = user.id;
    const table = document.getElementById('studentSelfTable');
    const isP = getAttendanceStatus(user.id, TODAY);
    
    let statusHTML = isP ? '<span class="text-green-600 font-bold">Present</span>' : 
                     (pendingRequests.some(r => r.id === user.id) ? '<span class="text-blue-500 font-bold">Pending</span>' : '<span class="text-red-500">Absent</span>');

    table.innerHTML = `
        <tr class="bg-gray-50">
            <td class="p-3"><img src="${user.photo || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full"></td>
            <td class="p-3">${user.id}</td>
            <td class="p-3">${user.name}</td>
            <td class="p-3">${user.class}</td>
            <td class="p-3">${statusHTML}</td>
        </tr>
    `;
}

// ================= UTILS =================
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    const colors = { success: 'bg-green-600', error: 'bg-red-600', warning: 'bg-orange-500', info: 'bg-blue-600' };
    el.className = `${colors[type]} text-white px-6 py-3 rounded shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 mb-3`;
    el.innerText = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => { el.classList.add('opacity-0', 'translate-y-2'); setTimeout(() => el.remove(), 300); }, 3000);
}