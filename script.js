// script.js
// সমস্ত ফ্রন্ট-এন্ড লজিক, ফটো আপলোড, ম্যানুয়াল ইমেইল কন্ট্রোল এবং ডেট সাপোর্ট

const SERVER_BASE_URL = 'http://localhost:3000';
const DEFAULT_PHOTO_URL = "https://i.ibb.co/567b53x/default-avatar.png"; // Default photo URL

// ----- HELPER FUNCTIONS -----
function getTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); 
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function getDateNDaysBefore(dateStr, n) {
    // Note: "+T00:00:00" is added to ensure date operations are based on local time and not UTC midnight issues.
    const date = new Date(dateStr + "T00:00:00"); 
    date.setDate(date.getDate() - n);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function isWorkingDay(dateStr) {
    const date = new Date(dateStr + "T00:00:00"); 
    const day = date.getDay();
    // Assuming Sunday (0) and Saturday (6) are weekends
    return day >= 1 && day <= 5; 
}


// ----- DATA INITIALIZATION & LOCAL STORAGE -----
let users = JSON.parse(localStorage.getItem("users")) || [{username:"admin", password:"1234", type:"admin", email: "admin@school.com"}];
let students = JSON.parse(localStorage.getItem("students")) || [
    {username:"STU001", password:"STU001", type:"student", id:"STU001", name:"Alice Rahman", class:"CSE-1", email: "alice.rahman@example.com", photoUrl: DEFAULT_PHOTO_URL},
    {username:"STU002", password:"STU002", type:"student", id:"STU002", name:"Babul Islam", class:"EEE-2", email: "babul.islam@example.com", photoUrl: DEFAULT_PHOTO_URL}
];

// Ensure all student data has necessary fields and is synced to users/attendance/notifications
students.forEach(s => {
    if (!s.photoUrl) s.photoUrl = DEFAULT_PHOTO_URL;
    if (!s.email) s.email = `${s.username.toLowerCase()}@example.com`;
    // Sync students to users list if they are not already there
    if (!users.some(u => u.username === s.username)) users.push({ ...s, type: "student", email: s.email });
});

let attendance = JSON.parse(localStorage.getItem("attendance")) || {};
let pendingRequests = JSON.parse(localStorage.getItem("pendingRequests")) || [];
let sentNotifications = JSON.parse(localStorage.getItem("sentNotifications")) || {};

// Initialize attendance and notifications objects for existing students
students.forEach(s => {
    if (!attendance[s.id]) attendance[s.id] = {};
    if (!sentNotifications[s.id]) sentNotifications[s.id] = {};
});


localStorage.setItem("users", JSON.stringify(users));
localStorage.setItem("students", JSON.stringify(students));
localStorage.setItem("attendance", JSON.stringify(attendance));
localStorage.setItem("pendingRequests", JSON.stringify(pendingRequests));
localStorage.setItem("sentNotifications", JSON.stringify(sentNotifications));


// ----- ELEMENT REFERENCES & STATE -----
const signInTab=document.getElementById("signInTab");
const signUpTab=document.getElementById("signUpTab");
const signInForm=document.getElementById("signInForm");
const signUpForm=document.getElementById("signUpForm");
const signUpSubmitBtn = document.getElementById("signUpSubmitBtn");
const authPage=document.getElementById("authPage");
const adminDashboard=document.getElementById("adminDashboard");
const studentDashboard=document.getElementById("studentDashboard");
const studentTable=document.getElementById("studentTable");
const studentSelfTable=document.getElementById("studentSelfTable");
const totalCount=document.getElementById("totalCount");
const presentCount=document.getElementById("presentCount");
const absentCount = document.getElementById("absentCount");
const notificationCount = document.getElementById("notificationCount");
const filterStatus=document.getElementById("filterStatus");
const attendanceDateInput = document.getElementById("attendanceDate");
const notificationTableBody = document.getElementById("notificationTableBody");

let selectedAttendanceDate = getTodayDate(); 

// ----- API CALLS / EMAILING -----

async function uploadPhoto(file) {
    if (!file) return DEFAULT_PHOTO_URL; 
    
    const formData = new FormData();
    formData.append('studentPhoto', file); 
    
    try {
        const response = await fetch(`${SERVER_BASE_URL}/upload-photo`, { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success && data.photoUrl) {
            return data.photoUrl;
        } else {
            // Check for specific scenario where server is running but upload path is misconfigured
            if (response.status === 200 && !data.photoUrl) return DEFAULT_PHOTO_URL; 
            alert(`❌ Photo upload failed: ${data.message || 'Server error.'}`);
            return null;
        }
    } catch (error) {
        console.error("Network or Fetch Error during upload:", error);
        alert("❌ Network Error: Could not connect to the Node.js server for photo upload. Is the server running?");
        return null;
    }
}

async function sendEmailNotification(student, lastAbsentDate) {
    const SERVER_API_URL = `${SERVER_BASE_URL}/send-email`;
    
    const emailData = {
        to: student.email,
        subject: `⚠️ Urgent Attendance Alert: ${student.name} (${student.id})`,
        body: `Dear Parent/Guardian,\n\nThis is an urgent notification from the Smart Student Attendance System. Your child, ${student.name} (${student.id}), has been consecutively absent for 3 or more working days, up to the date: ${lastAbsentDate}.\n\nPlease contact the school administration immediately.\n\nThank You.\n\n--- The Smart Attendance System ---`,
        student_id: student.id,
    };
    
    try {
        const response = await fetch(SERVER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData) 
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`[EMAIL SUCCESS]: Email sent to ${student.email}. Message ID: ${data.messageId}`);
            return true;
        } else {
            console.error(`[EMAIL FAILED]: Server responded with an error.`, data.message);
            alert(`❌ ইমেল পাঠাতে ব্যর্থ হয়েছে: ${data.message}. SMTP ক্রেডেনশিয়াল (App Password) ঠিক আছে কিনা নিশ্চিত করুন.`);
            return false;
        }
    } catch (error) {
        console.error("Network or Fetch Error:", error);
        alert(`❌ নেটওয়ার্ক এরর: সার্ভারের সাথে যোগাযোগ করা সম্ভব হয়নি। Node.js সার্ভার চালু আছে কিনা চেক করুন।`);
        return false;
    }
}

// Function to manually send email
async function sendManualNotification(studentId, lastAbsentDate) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const today = getTodayDate();
    if (sentNotifications[studentId] && sentNotifications[studentId][today]) {
        alert(`Email for ${student.name} was already sent today.`);
        return;
    }

    const confirmed = confirm(`Are you sure you want to manually send the 3+ consecutive absence email for ${student.name} (Absent up to ${lastAbsentDate})?`);
    if (!confirmed) return;

    const success = await sendEmailNotification(student, lastAbsentDate); 

    if (success) {
        if (!sentNotifications[studentId]) sentNotifications[studentId] = {};
        sentNotifications[studentId][today] = true;
        localStorage.setItem("sentNotifications", JSON.stringify(sentNotifications));
        alert(`✅ Email successfully sent to ${student.name}'s guardian.`);
        renderEmailNotificationList(); // Re-render the list to update status
    }
}


// ----- UI RENDERING & HANDLERS -----

function renderEmailNotificationList() {
    const today = getTodayDate();
    let notificationCountToday = 0;
    let requiredNotifications = 0;
    notificationTableBody.innerHTML = '';

    students.forEach(student => {
        let consecutiveAbsentDays = 0;
        let lastAbsentDate = null;
        
        // Check last 7 days (or more) for consecutive absences
        for (let i = 0; i < 7; i++) { 
            const checkDate = getDateNDaysBefore(today, i);
            if (!isWorkingDay(checkDate) || checkDate > today) continue; 

            const isPresent = !!attendance[student.id] && !!attendance[student.id][checkDate];

            if (!isPresent) {
                consecutiveAbsentDays++;
                lastAbsentDate = checkDate;
            } else {
                break; // Break the count if a present day is found
            }
        }
        
        if (consecutiveAbsentDays >= 3) {
            requiredNotifications++;
            
            const alreadySentToday = sentNotifications[student.id] && sentNotifications[student.id][today];
            const statusText = alreadySentToday ? '✅ Sent Today' : '⚠️ Needed';
            const statusClass = alreadySentToday ? 'bg-teal-100 text-teal-700' : 'bg-yellow-100 text-yellow-700';

            if (alreadySentToday) notificationCountToday++;

            const tr = document.createElement("tr");
            tr.classList.add("hover:bg-gray-50", "transition-colors", "duration-150");
            tr.innerHTML = `
                <td class="p-2 border-b">${student.id}</td>
                <td class="p-2 border-b">${student.name}</td>
                <td class="p-2 border-b">${lastAbsentDate}</td>
                <td class="p-2 border-b">
                    <span class="px-2 py-1 rounded-full text-xs ${statusClass}">${statusText}</span>
                </td>
                <td class="p-2 border-b">
                    <button onclick="sendManualNotification('${student.id}', '${lastAbsentDate}')" 
                        class="text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        ${alreadySentToday ? 'disabled' : ''}>
                        Send Email Now
                    </button>
                </td>
            `;
            notificationTableBody.appendChild(tr);
        }
    });

    notificationCount.textContent = notificationCountToday;
    document.getElementById("noNotificationNeeded").classList.toggle('hidden', requiredNotifications > 0);
}


function renderAdminTable(){
    const dateToView = selectedAttendanceDate;
    const filter=filterStatus.value;
    studentTable.innerHTML="";
    let currentPresentCount = 0;

    students.forEach((s,i)=>{
      const isPresent=!!attendance[s.id] && !!attendance[s.id][dateToView];
      if(isPresent) currentPresentCount++;
      if(filter==="present" && !isPresent) return;
      if(filter==="absent" && isPresent) return;
      
      const statusClass = isPresent ? "bg-green-100 text-green-700 font-medium" : "bg-red-100 text-red-700 font-medium";
      const statusText = isPresent ? "Present" : "Absent";
      const actionText = isPresent ? "Undo" : "Mark";
      
      const photoHtml = `<td class="p-2 border-b"><img src="${s.photoUrl || DEFAULT_PHOTO_URL}" alt="${s.name}" class="h-8 w-8 object-cover rounded-full shadow-sm"></td>`; 
      
      const tr=document.createElement("tr");
      tr.classList.add("hover:bg-gray-50", "transition-colors", "duration-150");
      tr.innerHTML=`${photoHtml}
        <td class="p-2 border-b">${s.id}</td>
        <td class="p-2 border-b">${s.name}</td>
        <td class="p-2 border-b">${s.class}</td>
        <td class="p-2 border-b">
          <span class="px-2 py-1 rounded-full text-xs ${statusClass}">${statusText}</span>
        </td>
        <td class="p-2 border-b space-x-2">
          <button onclick="toggleAttendance('${s.id}')" class="text-blue-600 hover:underline">${actionText}</button>
          <button onclick="removeStudent(${i})" class="text-red-600 hover:underline">Remove</button>
        </td>`;
      studentTable.appendChild(tr);
    });
    totalCount.textContent = students.length;
    presentCount.textContent = currentPresentCount;
    absentCount.textContent = students.length - currentPresentCount;
}

function showAdmin(){ 
    authPage.classList.add("hidden"); 
    adminDashboard.classList.remove("hidden"); 
    selectedAttendanceDate = getTodayDate();
    attendanceDateInput.value = selectedAttendanceDate;
    renderAdminTable(); 
    renderPendingRequests(); 
    renderEmailNotificationList();
}
function showStudent(user){ 
    authPage.classList.add("hidden"); 
    studentDashboard.classList.remove("hidden"); 
    renderStudentSelf(user);
}

function toggleAttendance(id){
    const dateToMark = selectedAttendanceDate; 
    if(!attendance[id]) attendance[id] = {};
    
    if(attendance[id][dateToMark]){ 
        if(confirm(`Undo attendance for this student on ${dateToMark}?`)) {
            delete attendance[id][dateToMark]; 
            // Also remove any pending request if undoing
            pendingRequests = pendingRequests.filter(req => req.id !== id || req.date !== dateToMark); 
        }
    } else {
        attendance[id][dateToMark]=true;
        // Also remove any pending request if marking
        pendingRequests = pendingRequests.filter(req => req.id !== id || req.date !== dateToMark); 
    }
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("pendingRequests", JSON.stringify(pendingRequests));
    renderAdminTable();
    renderPendingRequests();
    renderEmailNotificationList();
}

function removeStudent(i){
    const id=students[i].id;
    if(!confirm(`Are you sure you want to remove student ID: ${id}?`)) return;
    delete attendance[id]; delete sentNotifications[id]; 
    students.splice(i,1);
    users=users.filter(u=>u.username!==id);
    pendingRequests = pendingRequests.filter(req => req.id !== id);
    localStorage.setItem("students", JSON.stringify(students));
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("pendingRequests", JSON.stringify(pendingRequests));
    localStorage.setItem("sentNotifications", JSON.stringify(sentNotifications));
    renderAdminTable(); 
    renderPendingRequests();
    renderEmailNotificationList();
}

// ----- EVENT LISTENERS -----
signInTab.addEventListener("click", ()=>{
    signInForm.classList.remove("hidden"); signUpForm.classList.add("hidden");
    signInTab.classList.add("tab-active");
    signUpTab.classList.remove("tab-active");
});
signUpTab.addEventListener("click", ()=>{
    signInForm.classList.add("hidden"); signUpForm.classList.remove("hidden");
    signUpTab.classList.add("tab-active");
    signInTab.classList.remove("tab-active");
});

// Login (FIXED to check for role)
signInForm.addEventListener("submit", e=>{
    e.preventDefault();
    const username=document.getElementById("loginUsername").value.trim();
    const password=document.getElementById("loginPassword").value.trim();
    const role=document.getElementById("loginRole").value; // Get role
    
    // Crucial fix: Find user by username, password, AND role/type
    const user=users.find(u=>u.username===username && u.password===password && u.type===role);
    
    if(!user){ 
        alert(`Invalid credentials or incorrect role selected.`); 
        return; 
    }
    if(user.type==="admin"){ showAdmin(); } else if (user.type==="student") { showStudent(user); }
});

// Sign Up (FIXED with email, photo and proper local storage saving)
signUpForm.addEventListener("submit", async e=>{
    e.preventDefault();
    signUpSubmitBtn.disabled = true;
    signUpSubmitBtn.textContent = "Processing...";

    const id=document.getElementById("signUpId").value.trim().toUpperCase();
    const name=document.getElementById("signUpName").value.trim();
    const email=document.getElementById("signUpEmail").value.trim(); 
    const photoFile = document.getElementById("signUpPhotoFile").files[0]; 
    const cls=document.getElementById("signUpClass").value.trim();
    const username=document.getElementById("signUpUsername").value.trim();
    const password=document.getElementById("signUpPassword").value.trim();

    if(users.some(u=>u.username===username)){ alert("Username already exists."); signUpSubmitBtn.disabled = false; signUpSubmitBtn.textContent = "Sign Up"; return; }
    if(students.some(s=>s.id===id)){ alert("Student ID already registered."); signUpSubmitBtn.disabled = false; signUpSubmitBtn.textContent = "Sign Up"; return; }
    
    // Upload photo before saving student
    const photoUrl = await uploadPhoto(photoFile);
    if (photoFile && !photoUrl) { signUpSubmitBtn.disabled = false; signUpSubmitBtn.textContent = "Sign Up"; return; }

    const newStudent={username,password,type:"student",id,name,class:cls, email: email, photoUrl: photoUrl || DEFAULT_PHOTO_URL}; 
    
    users.push(newStudent); students.push(newStudent);
    attendance[id] = {}; sentNotifications[id] = {}; // Initialize data structures for new student
    
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("students", JSON.stringify(students));
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("sentNotifications", JSON.stringify(sentNotifications));
    
    alert("Registration successful! You can now sign in.");
    signUpSubmitBtn.disabled = false;
    signUpSubmitBtn.textContent = "Sign Up";
    signInTab.click();
    e.target.reset();
});


document.getElementById("logoutBtnAdmin").addEventListener("click", ()=>{ 
    adminDashboard.classList.add("hidden"); authPage.classList.remove("hidden"); 
    // Reset date view to today on logout for next admin login
    selectedAttendanceDate = getTodayDate();
});
document.getElementById("logoutBtnStudent").addEventListener("click", ()=>{ 
    studentDashboard.classList.add("hidden"); authPage.classList.remove("hidden"); 
});

// Admin date change listener
attendanceDateInput.addEventListener("change", (e) => {
    selectedAttendanceDate = e.target.value;
    renderAdminTable();
});
filterStatus.addEventListener("change", renderAdminTable);

document.getElementById("scanBtn").addEventListener("click", () => {
    const id = document.getElementById("scanInput").value.trim().toUpperCase();
    if (id && students.some(s => s.id === id)) {
        toggleAttendance(id);
    } else {
        alert("Invalid Student ID.");
    }
    document.getElementById("scanInput").value = "";
});

// MODAL Logic (Add Student)
const modal = document.getElementById("modal");
document.getElementById("addBtn").addEventListener("click", ()=>{ modal.classList.remove("hidden"); modal.classList.add("flex"); });
document.getElementById("cancelBtn").addEventListener("click", ()=>{ modal.classList.add("hidden"); modal.classList.remove("flex"); });

document.getElementById("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id=document.getElementById("stuId").value.trim().toUpperCase();
    const name=document.getElementById("stuName").value.trim();
    const email=document.getElementById("stuEmail").value.trim(); 
    const photoFile = document.getElementById("stuPhotoFile").files[0]; 
    const cls=document.getElementById("stuClass").value.trim();
    const username = id; const password = id;

    if(users.some(u=>u.username===username)){ alert("Username already exists."); return; }
    if(students.some(s=>s.id===id)){ alert("Student ID already registered."); return; }
    
    document.getElementById("addSubmitBtn").disabled = true;
    document.getElementById("addSubmitBtn").textContent = "Uploading...";
    
    const photoUrl = await uploadPhoto(photoFile);
    
    document.getElementById("addSubmitBtn").disabled = false;
    document.getElementById("addSubmitBtn").textContent = "Save";
    
    if (photoFile && !photoUrl) return; 

    const newStudent={username,password,type:"student",id,name,class:cls, email: email, photoUrl: photoUrl || DEFAULT_PHOTO_URL}; 
    
    users.push(newStudent); students.push(newStudent);
    attendance[id] = {}; sentNotifications[id] = {};
    
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("students", JSON.stringify(students));
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("sentNotifications", JSON.stringify(sentNotifications));

    alert("Student added successfully!");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    e.target.reset();
    renderAdminTable();
    renderEmailNotificationList();
});

// ----- PENDING REQUESTS -----
function renderPendingRequests(){
  const table=document.getElementById("pendingTable"); table.innerHTML="";
  pendingRequests.forEach((req,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td class="p-2 border-b">${req.id}</td>
      <td class="p-2 border-b">${req.name}</td>
      <td class="p-2 border-b">${req.class}</td>
      <td class="p-2 border-b space-x-2">
        <button onclick="approveRequest(${i})" class="text-green-600 hover:underline">Approve</button>
        <button onclick="rejectRequest(${i})" class="text-red-600 hover:underline">Reject</button>
      </td>`;
    table.appendChild(tr);
  });
}

function approveRequest(i){
    const req=pendingRequests[i];
    const dateToMark = req.date || getTodayDate(); // Use date from request or today

    if (!attendance[req.id]) attendance[req.id] = {};
    attendance[req.id][dateToMark] = true;
    localStorage.setItem("attendance", JSON.stringify(attendance));
    
    pendingRequests.splice(i,1);
    localStorage.setItem("pendingRequests", JSON.stringify(pendingRequests));
    renderPendingRequests();
    renderAdminTable();
    renderEmailNotificationList();
}

function rejectRequest(i){
    pendingRequests.splice(i,1);
    localStorage.setItem("pendingRequests", JSON.stringify(pendingRequests));
    renderPendingRequests();
    renderAdminTable();
}

// ----- STUDENT REQUEST -----
document.getElementById("requestBtn").addEventListener("click", ()=>{
    const id=document.getElementById("scanInputStudent").value.trim().toUpperCase();
    const dateToRequest = getTodayDate();
    const student=students.find(s=>s.id===id);
    if(!student){ alert("Invalid ID"); return; }
    
    // Check if already present OR already requested for TODAY
    const isPresent = !!attendance[id] && !!attendance[id][dateToRequest];
    const isPending = pendingRequests.some(r=>r.id===id && r.date===dateToRequest);
    
    if(isPresent || isPending){ 
        alert("Already requested or present for today."); 
        return; 
    }
    
    // Push the student object along with the request date
    pendingRequests.push({...student, date: dateToRequest});
    localStorage.setItem("pendingRequests", JSON.stringify(pendingRequests));
    document.getElementById("requestMsg").textContent=`Request sent for ${dateToRequest}. Waiting for admin approval.`;
    document.getElementById("scanInputStudent").value=id; // Keep ID for self-view
    renderPendingRequests(); // Update admin pending view
    renderStudentSelf(student); // Re-render student view
});

// ----- STUDENT DASHBOARD -----
function renderStudentSelf(user){
    studentSelfTable.innerHTML="";
    const today = getTodayDate();
    const isPresent=!!attendance[user.id] && !!attendance[user.id][today];
    const isPending = pendingRequests.some(r=>r.id===user.id && r.date===today);
    
    let statusText;
    let statusClass;

    if(isPresent){
        statusText = "Present (Marked)";
        statusClass = "bg-green-100 text-green-700";
    } else if (isPending) {
        statusText = "Request Sent (Pending Admin Approval)";
        statusClass = "bg-blue-100 text-blue-700";
    } else {
        statusText = "Absent (Not Marked)";
        statusClass = "bg-red-100 text-red-700";
    }
    
    const photoHtml = `<td class="p-2 border-b"><img src="${user.photoUrl || DEFAULT_PHOTO_URL}" alt="${user.name}" class="h-8 w-8 object-cover rounded-full shadow-sm"></td>`; 

    const tr=document.createElement("tr");
    tr.innerHTML=`${photoHtml}
        <td class="p-2 border-b">${user.id}</td>
        <td class="p-2 border-b">${user.name}</td>
        <td class="p-2 border-b">${user.class}</td>
        <td class="p-2 border-b">
            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
        </td>`;
    studentSelfTable.appendChild(tr);

    document.getElementById("scanInputStudent").value = user.id; // Pre-fill ID
    document.getElementById("requestMsg").textContent = isPresent || isPending ? "" : "You can request attendance for today.";
}


// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    // Set default date to today
    attendanceDateInput.value = getTodayDate(); 
    // Ensure email notification list is ready
    renderEmailNotificationList();
});