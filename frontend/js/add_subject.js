import { checkAuth } from "./check_auth.js";
import { logout } from "./logout.js";

const addForm = document.getElementById("subjectForm");
const subjectInput = document.getElementById("subjectName");
const educationLevel = document.getElementById("level");
const messageArea = document.getElementById("message");
const subjectsList = document.querySelector("#subject_list");

const far_bars=document.querySelector(".fa-bars")
const nav=document.querySelector(".sidebar");

far_bars.addEventListener("click",()=>{
    far_bars.classList.toggle("fa-close");
    far_bars.style.color="gray";
    far_bars.style.top="30px"
  

    nav.classList.toggle("display_nav")
})
// 🔐 Check auth first
checkAuth().then(() => {
    loadSubjects();
}).catch(() => {
    window.location.href = "../index.html";
});

addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = subjectInput.value.trim();
    const level = educationLevel.value.trim() || "General";

    if (!name) {
        showMessage("Please enter a subject name.", "red");
        return;
    }

    try {
        const res = await fetch("http://127.0.0.1:5000/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name, level })
        });

        // ✅ Correct: await inside async function
        const data = await res.json(); // ← This is line 141?

        if (res.ok) {
            showMessage(data.message || "Subject added!", "green");
            subjectInput.value = "";
            educationLevel.value = "";
            loadSubjects();
        } else {
            showMessage(data.error || "Failed to add subject.", "red");
        }

    } catch (error) {
        console.error("Error:", error);
        showMessage("Network error. Try again.", "red");
    }
});

// ✅ Show message with auto-hide
function showMessage(text, color) {
    messageArea.textContent = text;
    messageArea.style.color = color;
    messageArea.style.fontWeight = "bold";
    messageArea.style.margin = "10px 0";
    messageArea.style.display = "block";

    setTimeout(() => {
        messageArea.style.opacity = 0;
        setTimeout(() => {
            messageArea.style.display = "none";
            messageArea.style.opacity = 1; // reset
        }, 300);
    }, 3000);
}

// ✅ Load subjects
async function loadSubjects() {
    try {
        const res = await fetch("http://127.0.0.1:5000/subjects", {
            method: "GET",
            credentials: "include"
        });

        if (!res.ok) {
            if (res.status === 401) {
                window.location.href = "../index.html";
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const username = data.username || "User";
        const subjects = data.subjects || [];

        subjectsList.innerHTML = "";

        if (subjects.length === 0) {
            subjectsList.innerHTML = "<li>No subjects yet. Add one above!</li>";
            return;
        }

        subjects.forEach(subject => {
            const li = document.createElement("li");
            li.className = "subject";
            li.innerHTML = `
                <span><strong>${escapeHtml(subject.subject_name)}</strong> 
                (${subject.education_level || 'General'})</span>
                <button onclick="deleteSubject(${subject.id})" class="delete">🗑️ Delete</button>
            `;
            subjectsList.appendChild(li);
        });

        // Update welcome message
       // ✅ Replace this:
// document.querySelector(".welcomeUser")?.textContent = `Welcome back, ${username}!`;

// ✅ With this:
const welcomeEl = document.querySelector(".welcomeUser");
if (welcomeEl) {
  welcomeEl.textContent = `Welcome back, ${username}!`;
}
 
    } catch (error) {
        console.error("Error loading subjects:", error);
        subjectsList.innerHTML = "<li>❌ Failed to load subjects.</li>";
    }
}

// ✅ Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ✅ Delete subject
window.deleteSubject = async function(id) {
    if (!confirm("Are you sure you want to delete this subject? This will also delete its study plan.")) return;

    try {
        const res = await fetch(`http://127.0.0.1:5000/api/subjects/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (res.ok) {
            showMessage("Subject deleted successfully.", "green");
            loadSubjects();
        } else {
            const error = await res.json().catch(() => ({}));
            showMessage(error.error || "Delete failed.", "red");
        }
    } catch (error) {
        console.error("Delete error:", error);
        showMessage("Network error. Could not delete subject.", "red");
    }
};

// ✅ Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to log out?")) {
        await logout();
    }
});