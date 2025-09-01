// Replace with your Flask backend base URL
const API_BASE = "http://127.0.0.1:5000";

// ----------------- SIGNUP -----------------
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = signupForm.querySelector("input[placeholder='Full Name']").value;
    const email = signupForm.querySelector("input[placeholder='Email Address']").value;
    const password = signupForm.querySelector("input[placeholder='Password']").value;

    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (res.ok) {
      alert("Signup successful! Please login.");
      window.location.href = "login.html";
    } else {
      alert(data.error || "Signup failed.");
    }
  });
}

// ----------------- LOGIN -----------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector("input[placeholder='Email Address']").value;
    const password = loginForm.querySelector("input[placeholder='Password']").value;

    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token); // Save JWT
      alert("Login successful!");
      window.location.href = "dashboard.html";
    } else {
      alert(data.error || "Login failed.");
    }
  });
}

// ----------------- ADD SUBJECT -----------------
const subjectForm = document.getElementById("subjectForm");
if (subjectForm) {
  subjectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = subjectForm.querySelector("input").value;
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/subjects`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ subject })
    });

    const data = await res.json();
    if (res.ok) {
      alert("Subject added!");
      loadPlan();
    } else {
      alert(data.error || "Failed to add subject.");
    }
  });
}

// ----------------- LOAD STUDY PLAN -----------------
async function loadPlan() {
  const planList = document.getElementById("planList");
  if (!planList) return;

  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/plan`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  const data = await res.json();
  planList.innerHTML = "";

  if (data.plan && data.plan.length > 0) {
    data.plan.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `📅 ${item.subject}: ${item.schedule}`;
      planList.appendChild(li);
    });
  } else {
    planList.innerHTML = "<li>No study plan yet. Add a subject!</li>";
  }
}

// ----------------- LOAD QUIZ -----------------
async function loadQuiz() {
  const quizSection = document.querySelector(".quiz-card");
  if (!quizSection) return;

  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/quiz`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  const data = await res.json();
  if (data.question) {
    quizSection.innerHTML = `
      <p><strong>${data.question}</strong></p>
      <input type="text" id="answerInput" placeholder="Your answer">
      <button onclick="submitQuiz('${data.id}')">Submit Answer</button>
    `;
  } else {
    quizSection.innerHTML = "<p>No quiz available. Add a subject first!</p>";
  }
}

// ----------------- SUBMIT QUIZ -----------------
async function submitQuiz(quizId) {
  const answer = document.getElementById("answerInput").value;
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE}/quiz/submit`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ quiz_id: quizId, answer })
  });

  const data = await res.json();
  if (res.ok) {
    alert(`Your answer was graded: ${data.grade}`);
    loadQuiz();
  } else {
    alert(data.error || "Failed to submit quiz.");
  }
}

// ----------------- AUTO LOAD DASHBOARD DATA -----------------
document.addEventListener("DOMContentLoaded", () => {
  loadPlan();
  loadQuiz();
});
