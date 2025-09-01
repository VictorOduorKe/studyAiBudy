import { logout } from "./logout.js";

const subjectsList = document.getElementById("subjects-list");
const studyPlanContainer = document.getElementById("studyPlan");
const messageArea = document.querySelector(".welcomeUser");
const far_bars=document.querySelector(".fa-bars")
const nav=document.querySelector(".sidebar");

far_bars.addEventListener("click",()=>{
    far_bars.classList.toggle("fa-close");
    far_bars.style.color="gray";
    far_bars.style.top="30px"
  

    nav.classList.toggle("display_nav")
})
// 🔐 0️⃣ Check Authentication
async function checkAuth() {
    try {
        const res = await fetch("https://studyaibudy.onrender.com/auth/api/user", {
            method: "GET",
            credentials: "include"
        });

        if (res.ok) {
            const userData = await res.json();
            messageArea.textContent = `Welcome, ${userData.username}!`;
        } else {
            const errorData = await res.json();
            console.warn("Not authenticated:", errorData.error);
            window.location.href = errorData.redirectUrl || "../index.html";
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        window.location.href = "../index.html";
    }
}

// 1️⃣ Load subjects
async function loadSubjects() {
    try {
        const ap_url = "https://studyaibudy.onrender.com/subjects";
        const res = await fetch(ap_url, {
            method: "GET",
            credentials: "include"
        });

        if (!res.ok) {
            if (res.status === 401) {
                window.location.href = "../index.html";
                return;
            }
            throw new Error(`HTTP error! status: ${res.status}`);
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
                <span>
                    <strong>${sub.subject_name}</strong> 
                    (${sub.education_level || 'General'})
                </span>
                ${button}
                ${viewPlanLink}
            `;

            subjectsList.appendChild(li);
        });

    } catch (error) {
        console.error("Error loading subjects:", error);
        subjectsList.innerHTML = "<li>Failed to load subjects</li>";
    }
}

// 2️⃣ Generate study plan
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
            const errorData = await res.json().catch(() => ({}));
            console.log(errorData);
            studyPlanContainer.innerHTML = `<p style="color:red;">❌ ${errorData.error || "Failed to generate plan"}</p>`;
            return;
        }

        const plan = await res.json();
        displayStudyPlan(plan);

        // Refresh subject list to show "View Study Plan" link
        await loadSubjects();

    } catch (error) {
        console.error("Error generating study plan:", error);
        studyPlanContainer.innerHTML = "<p style='color:red; padding:10px'>❌ Failed to connect to AI backend.</p>";
    }
}

// 3️⃣ Display the study plan
function displayStudyPlan(plan) {
    if (!plan || !plan.id) {
        studyPlanContainer.innerHTML = `<p style="color:green; padding:10px;" >Study plan Generated successfully</a>`;
        return;
    }

    studyPlanContainer.innerHTML = `
        <div style="padding: 15px; border: 1px solid #d0ebff; background-color: #f0f8ff; border-radius: 8px;">
            <h3>✅ Study Plan Generated!</h3>
            <p><strong>Subject:</strong> ${plan.subject}</p>
            <p><strong>Level:</strong> ${plan.level}</p>
            <p><strong>Plan ID:</strong> ${plan.id}</p>
            <a href="./study_plan.html?plan_id=${plan.id}" 
               style="color:#fff; background-color:#3498db; padding:8px 12px; border-radius:4px; text-decoration:none; display:inline-block; margin-top:10px;">
               Open Study Plan
            </a>
        </div>
    `;
}

// ✅ Make generateStudyPlan globally available
window.generateStudyPlan = generateStudyPlan;

// 🔁 On Page Load
checkAuth().then(() => loadSubjects());

// ✅ Logout button
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to log out?")) {
        await logout();
    }
});