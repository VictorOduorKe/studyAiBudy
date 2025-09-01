// js/subjects.js
import { checkAuth,logout } from './check_auth.js';

const subjectsList = document.getElementById("subjects-list");
const addForm = document.getElementById("subjectForm");
const subjectInput = document.getElementById("subjectName");
const levelInput = document.getElementById("educationLevel") || null; // optional dropdown

const far_bars=document.querySelector(".fa-bars")
const nav=document.querySelector(".sidebar");

far_bars.addEventListener("click",()=>{
    far_bars.classList.toggle("fa-close");
    far_bars.style.color="gray";
    far_bars.style.top="30px"
  

    nav.classList.toggle("display_nav")
})
// Load subjects from backend
async function loadSubjects() {
  try {
    const res = await fetch("https://studyaibudy.onrender.com/subjects", {
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
    const subjects = data.subjects || [];
    const username = data.username || "User";

    // Update welcome message
    document.querySelector(".welcomeUser")?.textContent = `Welcome, ${username}!`;

    // Render subjects
    subjectsList.innerHTML = "";
    if (subjects.length === 0) {
      subjectsList.innerHTML = "<li>No subjects yet. Add one above!</li>";
      return;
    }

    subjects.forEach(sub => {
      const li = document.createElement("li");

      const viewPlanLink = sub.plan_id
        ? ` <a href="./study_plan.html?plan_id=${sub.plan_id}" style="margin-left:10px; color:#3498db;">View Study Plan</a>`
        : '';

      const generateButton = !sub.plan_id
        ? `<button onclick="generateStudyPlan('${sub.subject_name}', '${sub.education_level || 'General'}')" style="margin-left:10px;">
             Generate Plan
           </button>`
        : '';

      li.innerHTML = `
        <span>
          <strong>${sub.subject_name}</strong> 
          (${sub.education_level || 'General'})
        </span>
        ${generateButton}
        ${viewPlanLink}
      `;
      subjectsList.appendChild(li);
    });
  } catch (error) {
    console.error("Failed to load subjects:", error);
    subjectsList.innerHTML = "<li>❌ Failed to load subjects</li>";
  }
}

// Add new subject
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = subjectInput.value.trim();
  const level = levelInput ? levelInput.value || "General" : "General";

  if (!name) {
    alert("Subject name is required!");
    return;
  }

  try {
    const res = await fetch("https://studyaibudy.onrender.com/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, level })
    });

    const data = await res.json();

    if (res.ok) {
      subjectInput.value = "";
      loadSubjects(); // ✅ Refresh list
    } else {
      alert("Error: " + data.error);
    }
  } catch (error) {
    console.error("Network error:", error);
    alert("Failed to connect to server.");
  }
});

// Make generateStudyPlan globally available
window.generateStudyPlan = async function(subjectName, subjectLevel) {
  try {
    const res = await fetch("https://studyaibudy.onrender.com/api/generate_plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subject: subjectName, level: subjectLevel })
    });

    if (!res.ok) {
      const error = await res.json();
      alert("Error: " + (error.error || "Failed to generate plan"));
      return;
    }

    const plan = await res.json();
    console.log("Generated plan ID:", plan.id);
    alert(`✅ Study plan generated!`);
    loadSubjects(); // ✅ Refresh to show "View Study Plan" link
  } catch (error) {
    console.error("Generate plan error:", error);
    alert("Failed to reach AI backend.");
  }
};

// On load: Check auth + load subjects
document.addEventListener("DOMContentLoaded", async () => {
  const authenticated = await checkAuth();
  if (authenticated) {
    loadSubjects();
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to log out?")) {
    await logout();  // Call logout → redirects automatically
  }
});