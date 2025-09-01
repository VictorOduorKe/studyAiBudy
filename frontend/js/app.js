const API_URL = "http://127.0.0.1:5000"; // Flask backend
let token = "";
let currentUser = null;

// Show sections
function showSection(id) {
  document.querySelectorAll("section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// ---------------- AUTH ----------------
async function register() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();
  document.getElementById("authMsg").innerText = data.msg || "Registered!";
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (res.ok) {
    token = data.token;
    currentUser = data.user;
    document.getElementById("userName").innerText = currentUser.name;
    showSection("dashboard");
  } else {
    document.getElementById("authMsg").innerText = data.msg;
  }
}

// ---------------- SUBJECTS ----------------
async function addSubject() {
  const subject = document.getElementById("subjectInput").value;

  const res = await fetch(`${API_URL}/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ subject })
  });

  if (res.ok) {
    loadSubjects();
    document.getElementById("subjectInput").value = "";
  }
}

async function loadSubjects() {
  const res = await fetch(`${API_URL}/subjects`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  const subjects = await res.json();
  const list = document.getElementById("subjectList");
  list.innerHTML = "";
  subjects.forEach(s => {
    const li = document.createElement("li");
    li.innerText = s.subject_name;
    list.appendChild(li);
  });
}

// ---------------- AI FEATURES ----------------
async function generatePlan() {
  const subject = prompt("Enter subject for study plan:");

  const res = await fetch(`${API_URL}/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ subject })
  });

  const data = await res.json();
  document.getElementById("planOutput").innerText = data.plan;
}

async function generateQuiz() {
  const subject = prompt("Enter subject for quiz:");

  const res = await fetch(`${API_URL}/quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ subject })
  });

  const data = await res.json();
  document.getElementById("quizOutput").innerText = data.quiz;
}
