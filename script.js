/**
 * Smart Student Attendance System - Final Fixed Version
 * Features: Auto-Login (Session Persistence), Real Backend, Fixed Reports
 */

const API_URL = "http://localhost:3000";
const ADMIN_USER = { username: 'admin', password: 'admin', role: 'admin' };
const TODAY = new Date().toISOString().split('T')[0];

// State Variables
let students = [];
let attendanceRecords = {};
let pendingRequests = [];
let notificationHistory = {};
let currentAdminUser = null;
let currentStudentUser = null;
let selectedDate = TODAY;

// ================= 1. INITIALIZATION & SESSION CHECK =================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Data from LocalStorage
    loadData();
    
    // 2. Set Default Date Inputs
    const dateInput = document.getElementById('attendanceDate');
    if(dateInput) dateInput.value = TODAY;

    const reportInput = document.getElementById('reportMonth');
    if(reportInput) {
        const now = new Date();
        reportInput.value = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}`;
    }

    // 3. CHECK SESSION (This fixes the Logout on Reload issue)
    const activeRole = localStorage.getItem('activeRole');
    const activeUser = localStorage.getItem('activeUser');

    if (activeRole && activeUser) {
        try {
            const userObj = JSON.parse(activeUser);
            // If student, refresh data from latest student list
            if (activeRole === 'student') {
                const freshUser = students.find(s => s.id === userObj.id) || userObj;
                showDashboard('student', freshUser);
            } else {
                showDashboard('admin', userObj);
            }
        } catch (e) {
            console.error("Session parse error", e);
            showDashboard('auth');
        }
    } else {
        showDashboard('auth');
    }
});

function loadData() {
    try {
        students = JSON.parse(localStorage.getItem('students')) || [];
        attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || {};
        pendingRequests = JSON.parse(localStorage.getItem('pendingRequests')) || [];
        notificationHistory = JSON.parse(localStorage.getItem('notificationHistory')) || {};
    } catch (e) {
        console.error("Error loading data", e);
    }
}

function saveData() {
    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));
    localStorage.setItem('notificationHistory', JSON.stringify(notificationHistory));
}

// ================= 2. AUTHENTICATION (LOGIN / LOGOUT) =================

function login(role, user) {
    // Save session to LocalStorage
    localStorage.setItem('activeRole', role);
    localStorage.setItem('activeUser', JSON.stringify(user));
    showDashboard(role, user);
}

function logout() {
    // Clear session
    localStorage.removeItem('activeRole');
    localStorage.removeItem('activeUser');
    currentAdminUser = null;
    currentStudentUser = null;
    showDashboard('auth');
}

// Tab Switching
document.getElementById('signInTab').addEventListener('click', () => toggleAuthTabs(true));
document.getElementById('signUpTab').addEventListener('click', () => toggleAuthTabs(false));

function toggleAuthTabs(isSignIn) {
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');

    if (isSignIn) {
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
        signInTab.classList.add('tab-active', 'text-purple-700');
        signInTab.classList.remove('text-gray-500');
        signUpTab.classList.remove('tab-active', 'text-purple-700');
        signUpTab.classList.add('text-gray-500');
    } else {
        signInForm.classList.add('hidden');
        signUpForm.classList.remove('hidden');
        signUpTab.classList.add('tab-active', 'text-purple-700');
        signUpTab.classList.remove('text-gray-500');
        signInTab.classList.remove('tab-active', 'text-purple-700');
        signInTab.classList.add('text-gray-500');
    }
}

// Handle Login Submit
document.getElementById('signInForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const role = document.getElementById('loginRole').value;

    if (role === 'admin' && u === ADMIN_USER.username && p === ADMIN_USER.password) {
        login('admin', ADMIN_USER);
        showAlert("Welcome Admin!", "success");
    } else if (role === 'student') {
        const s = students.find(stu => stu.username === u && stu.password === p);
        if (s) {
            login('student', s);
            showAlert(`Welcome ${s.name}`, "success");
        } else {
            showAlert("Invalid Student Credentials", "error");
        }
    } else {
        showAlert("Invalid Credentials", "error");
    }
});

// Handle Register Submit
document.getElementById('signUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signUpSubmitBtn');
    const originalText = btn.innerText;
    btn.innerText = "Processing..."; btn.disabled = true;

    const id = document.getElementById('signUpId').value.trim().toUpperCase();
    
    if (students.some(s => s.id === id)) {
        showAlert("Student ID already exists", "error");
        btn.innerText = originalText; btn.disabled = false;
        return;
    }

    // Photo Upload Logic
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
            console.error("Upload failed", err);
        }
    }

    const newStudent = {
        id, 
        name: document.getElementById('signUpName').value.trim(),
        email: document.getElementById('signUpEmail').value.trim(),
        class: document.getElementById('signUpClass').value.trim(),
        username: document.getElementById('signUpUsername').value.trim(),
        password: document.getElementById('signUpPassword').value.trim(),
        photo: photoUrl
    };

    students.push(newStudent);
    saveData();
    showAlert("Registration Successful!", "success");
    e.target.reset();
    toggleAuthTabs(true);
    btn.innerText = originalText; btn.disabled = false;
});

document.getElementById('logoutBtnAdmin').addEventListener('click', logout);
document.getElementById('logoutBtnStudent').addEventListener('click', logout);

// ================= 3. NAVIGATION & DASHBOARD =================

function showDashboard(role, user) {
    const authPage = document.getElementById('authPage');
    const adminDash = document.getElementById('adminDashboard');
    const studentDash = document.getElementById('studentDashboard');

    authPage.classList.add('hidden');
    adminDash.classList.add('hidden');
    studentDash.classList.add('hidden');

    if (role === 'admin') {
        currentAdminUser = user;
        adminDash.classList.remove('hidden');
        renderAdminDailyView();
    } else if (role === 'student') {
        currentStudentUser = user;
        studentDash.classList.remove('hidden');
        renderStudentSelf(user);
    } else {
        authPage.classList.remove('hidden');
    }
}

// Admin Tab Switching
const dailyTab = document.getElementById('dailyTab');
const reportTab = document.getElementById('reportTab');
const dailyView = document.getElementById('dailyView');
const reportView = document.getElementById('reportView');

dailyTab.addEventListener('click', () => {
    dailyView.classList.remove('hidden');
    reportView.classList.add('hidden');
    dailyTab.className = "tab-active px-4 py-2 text-lg hover:text-purple-700 transition-colors duration-200";
    reportTab.className = "px-4 py-2 text-lg text-gray-500 hover:text-purple-700 transition-colors duration-200";
});

reportTab.addEventListener('click', () => {
    dailyView.classList.add('hidden');
    reportView.classList.remove('hidden');
    reportTab.className = "tab-active px-4 py-2 text-lg hover:text-purple-700 transition-colors duration-200";
    dailyTab.className = "px-4 py-2 text-lg text-gray-500 hover:text-purple-700 transition-colors duration-200";
    renderMonthlyReport();
});

// ================= 4. ADMIN FEATURES (DAILY) =================

document.getElementById('attendanceDate').addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderAdminDailyView();
});

document.getElementById('scanBtn').addEventListener('click', () => {
    const input = document.getElementById('scanInput');
    const id = input.value.trim().toUpperCase();
    const student = students.find(s => s.id === id);

    if (!student) {
        showAlert("Student ID not found", "error");
        return;
    }

    const current = getAttendanceStatus(id, selectedDate);
    markAttendance(id, !current, selectedDate);
    showAlert(`${student.name} marked ${!current ? "PRESENT" : "ABSENT"}`, !current ? "success" : "warning");
    input.value = "";
    input.focus();
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
    const list = document.getElementById('studentTable');
    list.innerHTML = '';
    let pCount = 0, aCount = 0;

    // Filter Logic
    const filter = document.getElementById('filterStatus').value;

    students.forEach(s => {
        const isP = getAttendanceStatus(s.id, selectedDate) === true;
        if (isP) pCount++; else aCount++;

        // Apply Filter
        if (filter === 'present' && !isP) return;
        if (filter === 'absent' && isP) return;

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 transition';
        row.innerHTML = `
            <td class="p-3"><img src="${s.photo || '#'}" class="w-10 h-10 rounded-full bg-gray-200 object-cover border"></td>
            <td class="p-3 font-medium">${s.id}</td>
            <td class="p-3">${s.name}</td>
            <td class="p-3 text-gray-500">${s.class}</td>
            <td class="p-3">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${isP ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${isP ? 'PRESENT' : 'ABSENT'}
                </span>
            </td>
            <td class="p-3">
                <button onclick="toggleStatus('${s.id}')" class="text-purple-600 hover:text-purple-800 font-semibold text-sm">Change</button>
            </td>
        `;
        list.appendChild(row);
    });

    document.getElementById('totalCount').innerText = students.length;
    document.getElementById('presentCount').innerText = pCount;
    document.getElementById('absentCount').innerText = aCount;
    
    renderPendingRequests();
    renderNotificationTable();
}

document.getElementById('filterStatus').addEventListener('change', renderAdminDailyView);

window.toggleStatus = (id) => {
    const current = getAttendanceStatus(id, selectedDate);
    markAttendance(id, !current, selectedDate);
};

// Pending Requests
function renderPendingRequests() {
    const table = document.getElementById('pendingTable');
    const msg = document.getElementById('noPendingRequests');
    table.innerHTML = '';

    if (pendingRequests.length === 0) {
        msg.classList.remove('hidden');
        return;
    }
    msg.classList.add('hidden');

    pendingRequests.forEach((req, idx) => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="p-3">${req.id}</td>
            <td class="p-3">${req.name}</td>
            <td class="p-3">${req.class}</td>
            <td class="p-3 flex gap-2">
                <button onclick="handleRequest(${idx}, true)" class="bg-green-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-600">Approve</button>
                <button onclick="handleRequest(${idx}, false)" class="bg-red-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-red-600">Reject</button>
            </td>
        `;
        table.appendChild(row);
    });
}

window.handleRequest = (index, approve) => {
    const req = pendingRequests[index];
    if (approve) {
        markAttendance(req.id, true, TODAY);
        showAlert(`Approved ${req.name}`, "success");
    }
    pendingRequests.splice(index, 1);
    saveData();
    renderPendingRequests();
};

// ================= 5. ADMIN FEATURES (MONTHLY REPORT) =================

document.getElementById('reportMonth').addEventListener('change', renderMonthlyReport);

function renderMonthlyReport() {
    const input = document.getElementById('reportMonth').value;
    if (!input) return;

    const [year, month] = input.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const tHead = document.getElementById('reportTableHeader');
    const tBody = document.getElementById('reportTableBody');

    // 1. Build Header
    // Note: We use the classes provided in HTML for sticky positioning
    let headHTML = `
        <tr class="bg-gray-100 text-gray-600 text-sm">
            <th class="p-3 border-b sticky-col z-30 bg-gray-100 left-0">ID</th>
            <th class="p-3 border-b sticky-col z-30 bg-gray-100 left-[60px]">Name</th>
    `;

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sun=0, Sat=6
        headHTML += `<th class="p-2 border-b text-center min-w-[35px] ${isWeekend ? 'bg-red-50 text-red-400' : ''}">${d}</th>`;
    }
    headHTML += `<th class="p-3 border-b bg-green-100 text-center font-bold text-green-800">P</th>
                 <th class="p-3 border-b bg-red-100 text-center font-bold text-red-800">A</th></tr>`;
    
    tHead.innerHTML = headHTML;

    // 2. Build Body
    tBody.innerHTML = '';
    
    students.forEach(s => {
        let pCount = 0;
        let aCount = 0;

        let rowHTML = `<tr class="border-b hover:bg-gray-50 transition">
            <td class="p-3 bg-white border-r sticky-col left-0 font-medium z-10">${s.id}</td>
            <td class="p-3 bg-white border-r sticky-col left-[60px] z-10 text-gray-600 text-xs">${s.name}</td>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isP = getAttendanceStatus(s.id, dateStr);
            
            const dateObj = new Date(year, month - 1, d);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            let cellContent = '';
            let cellClass = isWeekend ? 'bg-gray-100' : '';

            if (isP === true) {
                cellContent = '✔'; 
                cellClass = 'text-green-600 font-bold bg-green-50'; 
                pCount++;
            } else if (isP === false) {
                cellContent = '✘'; 
                cellClass = 'text-red-600 font-bold bg-red-50'; 
                aCount++;
            } else if (!isWeekend) {
                // If weekday and not marked, count as absent (or neutral depending on policy)
                // Here we leave it blank but count towards potential absence if strict
                cellContent = '';
            }
            rowHTML += `<td class="p-2 border-r text-center text-sm ${cellClass}">${cellContent}</td>`;
        }

        rowHTML += `<td class="p-3 text-center bg-green-50 font-bold text-green-700">${pCount}</td>
                    <td class="p-3 text-center bg-red-50 font-bold text-red-700">${aCount}</td></tr>`;
        
        tBody.innerHTML += rowHTML;
    });

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    document.getElementById('reportSummary').innerText = `Report for ${monthName} ${year} | Total Students: ${students.length}`;
}

// ================= 6. NOTIFICATIONS & STUDENT VIEW =================

function renderNotificationTable() {
    const table = document.getElementById('notificationTableBody');
    const msg = document.getElementById('noNotificationNeeded');
    table.innerHTML = '';
    let hasData = false;

    students.forEach(s => {
        const absences = getConsecutiveAbsences(s.id);
        const alreadySent = notificationHistory[s.id] && notificationHistory[s.id][TODAY];

        if (absences >= 3 && !alreadySent) {
            hasData = true;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-3">${s.id}</td>
                <td class="p-3">${s.name}</td>
                <td class="p-3 text-sm text-gray-500">${TODAY}</td>
                <td class="p-3 font-bold text-red-600">${absences} Days</td>
                <td class="p-3">
                    <button onclick="sendEmail('${s.id}', '${s.email}', this)" class="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm shadow">Alert</button>
                </td>
            `;
            table.appendChild(row);
        }
    });

    if (hasData) msg.classList.add('hidden');
    else msg.classList.remove('hidden');
    
    // Count for top cards
    document.getElementById('notificationCount').innerText = Object.keys(notificationHistory).reduce((acc, id) => {
        return acc + (notificationHistory[id][TODAY] ? 1 : 0);
    }, 0);
}

function getConsecutiveAbsences(id) {
    let count = 0;
    let d = new Date(selectedDate);
    // Check past 7 days
    for (let i = 0; i < 7; i++) {
        const dateStr = d.toISOString().split('T')[0];
        const status = getAttendanceStatus(id, dateStr);
        if (status === true) break; // Stop at first present
        // You might want to skip checking weekends here if school is closed
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
            body: JSON.stringify({
                to: email,
                subject: `Attendance Warning for Student ${id}`,
                body: `Dear Guardian,\n\nStudent ${id} has been absent for 3 or more consecutive days.\nPlease contact the administration.`
            })
        });
        const data = await res.json();
        if (data.success) {
            showAlert("Email Sent Successfully", "success");
            if (!notificationHistory[id]) notificationHistory[id] = {};
            notificationHistory[id][TODAY] = true;
            saveData();
            renderNotificationTable();
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        console.error(err);
        showAlert("Failed to send email", "error");
        btn.innerText = "Retry"; btn.disabled = false;
    }
};

// Student Request
document.getElementById('requestBtn').addEventListener('click', () => {
    const inputId = document.getElementById('scanInputStudent').value.trim().toUpperCase();
    if (!currentStudentUser || inputId !== currentStudentUser.id) {
        showAlert("ID Mismatch. Enter your own ID.", "error");
        return;
    }
    if (pendingRequests.some(r => r.id === inputId)) {
        showAlert("Request is pending approval", "warning");
        return;
    }
    if (getAttendanceStatus(inputId, TODAY) === true) {
        showAlert("You are already marked present", "success");
        return;
    }

    pendingRequests.push(currentStudentUser);
    saveData();
    showAlert("Attendance Requested", "success");
    renderStudentSelf(currentStudentUser);
});

function renderStudentSelf(user) {
    document.getElementById('scanInputStudent').value = user.id;
    const table = document.getElementById('studentSelfTable');
    const isP = getAttendanceStatus(user.id, TODAY);
    
    let statusHTML = isP ? '<span class="text-green-600 font-bold">Present</span>' :
        (pendingRequests.some(r => r.id === user.id) ? '<span class="text-blue-600 font-bold">Pending</span>' : '<span class="text-red-500">Absent</span>');

    table.innerHTML = `
        <tr class="bg-gray-50">
            <td class="p-3"><img src="${user.photo || '#'}" class="w-10 h-10 rounded-full bg-gray-200 object-cover"></td>
            <td class="p-3">${user.id}</td>
            <td class="p-3">${user.name}</td>
            <td class="p-3">${user.class}</td>
            <td class="p-3">${statusHTML}</td>
        </tr>
    `;
    
    // Request Msg
    const msg = document.getElementById('requestMsg');
    msg.innerText = isP ? "You are present today." : "Please request attendance.";
}

// ================= 7. HELPERS & MODALS =================

function showAlert(msg, type) {
    // Create container if not exists
    let container = document.getElementById('toast-container-js');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-js';
        container.style.cssText = "position:fixed; bottom:20px; right:20px; display:flex; flex-direction:column; gap:10px; z-index:9999;";
        document.body.appendChild(container);
    }

    const el = document.createElement('div');
    const colors = { success: '#16a34a', error: '#dc2626', warning: '#ca8a04' };
    el.style.cssText = `background:${colors[type] || '#2563eb'}; color:white; padding:12px 20px; border-radius:8px; box-shadow:0 5px 15px rgba(0,0,0,0.2); transition: all 0.3s ease; transform: translateY(20px); opacity: 0;`;
    el.innerText = msg;
    
    container.appendChild(el);
    
    requestAnimationFrame(() => {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
    });

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// Modal Handling (Add Student)
const modal = document.getElementById('modal');
const addBtn = document.getElementById('addBtn');
const cancelBtn = document.getElementById('cancelBtn');

addBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
});

cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

// Admin add student form handler (reuses register logic slightly)
document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('stuId').value.trim().toUpperCase();
    if(students.some(s => s.id === id)) return showAlert("ID Exists", "error");

    const newStudent = {
        id, 
        name: document.getElementById('stuName').value,
        email: document.getElementById('stuEmail').value,
        class: document.getElementById('stuClass').value,
        username: id, 
        password: id,
        photo: null // Admin manual add doesn't support file upload in this simple modal without extra JS, or you can add it
    };
    students.push(newStudent);
    saveData();
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    renderAdminDailyView();
    showAlert("Student Added", "success");
});