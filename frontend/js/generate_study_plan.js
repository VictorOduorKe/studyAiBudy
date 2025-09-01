import { logout } from "./logout.js";

const subjectsList = document.getElementById("subjects-list");
const studyPlanContainer = document.getElementById("studyPlan");
const messageArea = document.querySelector(".welcomeUser");
const farBars = document.querySelector(".fa-bars");
const nav = document.querySelector(".sidebar");

farBars.addEventListener("click", () => {
    farBars.classList.toggle("fa-close");
    farBars.style.color = "gray";
    farBars.style.top = "30px";
    nav.classList.toggle("display_nav");
});

// 🔐 Check Authentication
async function checkAuth() {
    try {
        const res = await fetch("https://studyaibudy.onrender.com/auth/api/user", {
            method: "GET",
            credentials: "include"
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            window.location.href = err.redirectUrl || "../index.html";
            return false;
        }
        const userData = await res.json();
        messageArea.textContent = `Welcome, ${userData.username}!`;
        return true;
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = "../index.html";
    }
}

// 1️⃣ Load Subjects
async function loadSubjects() {
    try {
        const res = await fetch("https://studyaibudy.onrender.com/subjects", {
            method: "GET",
            credentials: "include"
        });
        if (!res.ok) {
            if (res.status === 401) window.location.href = "../index.html";
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const subjects = data.subjects || [];
        const username = data.username || "User";
        messageArea.textContent = `Welcome, ${username}!`;

        subjectsList.innerHTML = "";

        if (!subjects.length) {
            subjectsList.innerHTML = "<li>No subjects found</li>";
            return;
        }

        subjects.forEach(sub => {
            const li = document.createElement("li");

            const viewPlanLink = sub.plan_id
                ? ` <a href="./study_plan.html?plan_id=${sub.plan_id}" style="margin-left:10px; color:#3498db;">View Study Plan</a>`
                : '';

            const button = !sub.plan_id
                ? `<button onclick="generateStudyPlan('${sub.subject_name}', '${sub.education_level}')" style="margin-left:10px;">
                     Generate Plan
                   </button>`
                : '';

            li.innerHTML = `
                <span><strong>${sub.subject_name}</strong> (${sub.education_level || 'General'})</span>
                ${button}
                ${viewPlanLink}
            `;
            subjectsList.appendChild(li);
        });

    } catch (err) {
        console.error("Failed to load subjects:", err);
        subjectsList.innerHTML = "<li>Failed to load subjects</li>";
    }
}

// 2️⃣ Generate Study Plan
async function generateStudyPlan(subjectName, subjectLevel) {
    studyPlanContainer.innerHTML = "<p><em>Generating your study plan...</em></p>";

    try {
        const res = await fetch("https://studyaibudy.onrender.com/api/generate_plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ subject: subjectName, level: subjectLevel })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error || err.details || "Failed to generate plan";
            studyPlanContainer.innerHTML = `<p style="color:red;">❌ ${msg}</p>`;
            return;
        }

        const plan = await res.json();
        displayStudyPlan(plan);

        // Refresh subjects to show "View Plan" link
        await loadSubjects();

    } catch (err) {
        console.error("Error generating plan:", err);
        studyPlanContainer.innerHTML = "<p style='color:red;'>❌ Failed to connect to AI backend.</p>";
    }
}

// 3️⃣ Display Study Plan
function displayStudyPlan(plan) {
    if (!plan || !plan.id) {
        studyPlanContainer.innerHTML = `<p>Study plan generated successfully!</p>`;
        return;
    }

    studyPlanContainer.innerHTML = `
        <div style="padding:15px; border:1px solid #d0ebff; background-color:#f0f8ff; border-radius:8px;">
            <h3>✅ Study Plan Generated!</h3>
            <p><strong>Subject:</strong> ${plan.subject}</p>
            <p><strong>Level:</strong> ${plan.level}</p>
            <p><strong>Plan ID:</strong> ${plan.id}</p>
            <a href="./study_plan.html?plan_id=${plan.id}" 
               style="color:#fff; background-color:#3498db; padding:8px 12px; border-radius:4px; text-decoration:none; margin-top:10px; display:inline-block;">
               Open Study Plan
            </a>
        </div>
    `;
}

window.generateStudyPlan = generateStudyPlan;

// 🔁 Initialize
checkAuth().then(auth => auth && loadSubjects());

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to log out?")) await logout();
});
