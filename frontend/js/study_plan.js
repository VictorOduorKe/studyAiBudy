import { logout } from '../js/logout.js';

const urlParams = new URLSearchParams(window.location.search);
const studyPlanId = urlParams.get('plan_id');
const studyPlanContainer = document.getElementById("studyPlan");
const welcomeUser = document.querySelector(".welcomeUser");
const studyProgress = document.getElementById("subjectProgress");

const far_bars=document.querySelector(".fa-bars")
const nav=document.querySelector(".sidebar");

far_bars.addEventListener("click",()=>{
    far_bars.classList.toggle("fa-close");
    far_bars.style.color="gray";
    far_bars.style.top="30px"
  

    nav.classList.toggle("display_nav")
})
// 🔐 Auth check
async function checkAuth() {
  try {
    const res = await fetch("http://127.0.0.1:8000/auth/api/user", {
      method: "GET",
      credentials: "include"
    });

    if (res.ok) {
      const userData = await res.json();
      welcomeUser.textContent = `Welcome back, ${userData.username}!`;
      return true;
    } else {
      window.location.href = "../index.html";
      return false;
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.href = "../index.html";
    return false;
  }
}

// 🚀 Fetch and display saved study plan
async function loadSavedStudyPlan(plan_id) {
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/plan/${plan_id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to load plan (Status: ${response.status})`);
    }

    const plan = await response.json();
    displayStudyPlan(plan);

  } catch (error) {
    console.error("Error loading saved study plan:", error);
    studyPlanContainer.innerHTML = `
      <p style="color:red;">
        ❌ Failed to load study plan: ${error.message}
      </p>
      <small>Check if you're logged in and the plan exists.</small>
    `;
  }
}

function displayStudyPlan(plan) {
  studyPlanContainer.innerHTML = `
    <div style="font-family:Arial,sans-serif; line-height:1.6; max-width:900px; margin:auto; padding:20px;">
      <h2>📘 Study Plan: ${plan.subject}</h2>
      <p><strong>Level:</strong> ${plan.level}</p>
      <p><strong>📖 Summary:</strong> ${plan.summary}</p>

      <h3>📅 7-Week Roadmap</h3>
      <ul style="list-style:none; padding:0;">
        ${plan.roadmap.map(w => `
          <li style="padding:8px 0; border-bottom:1px solid #eee;">
            <strong>Week ${w.week}:</strong> 
            <span>${w.topic}</span> → 
            <em>${w.goal}</em>
          </li>
        `).join('')}
      </ul>

      <h3>🧠 Quiz: Answer One at a Time</h3>
      <div id="quiz-container"></div>
      <div id="quiz-results" style="margin-top:20px; font-weight:bold; display:none;"></div>
    </div>
  `;

  const quizContainer = document.getElementById("quiz-container");
  const resultsDiv = document.getElementById("quiz-results");
  let currentQIndex = 0;
  const questions = plan.quiz_questions;
  const userAnswers = [];

  function renderQuestion() {
    if (currentQIndex >= questions.length) {
      showResults();
      return;
    }

    const q = questions[currentQIndex];
    const questionDiv = document.createElement("div");
    questionDiv.id = "current-question";
    questionDiv.innerHTML = `
      <div style="background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #ddd;">
        <p><strong>Question ${currentQIndex + 1} of ${questions.length}:</strong></p>
        <p style="font-size:1.1em; margin:10px 0;">${q.question}</p>
        <ol style="margin-left:20px;" type="a">
          ${q.options.map((opt, idx) => `
            <li>
              <label>
                <input type="radio" name="quiz-question-${currentQIndex}" value="${opt}" required>
                ${opt}
              </label>
            </li>
          `).join('')}
        </ol>
        <button onclick="checkAnswer(${currentQIndex})" style="background:#27ae60; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; margin-top:10px;">
          Submit Answer
        </button>
      </div>
    `;
    quizContainer.appendChild(questionDiv);
  }

  // ✅ Extract first letter and compare
  window.checkAnswer = function(qIndex) {
    const selected = document.querySelector(`input[name="quiz-question-${qIndex}"]:checked`);
    if (!selected) {
      alert("Please select an answer!");
      return;
    }

    const fullText = selected.value;
    const givenLetter = fullText.trim().charAt(0).toUpperCase();
    const correctLetter = questions[qIndex].answer.trim().toUpperCase();

    userAnswers.push({ 
      question: qIndex, 
      given: givenLetter,
      correct: correctLetter
    });

    setTimeout(() => {
      currentQIndex++;
      quizContainer.innerHTML = "";
      renderQuestion();
    }, 500);
  };

 // ✅ Show results
function showResults() {
  const correctCount = userAnswers.filter(a => a.given === a.correct).length;
  const total = questions.length;
  const percentage = Math.max((correctCount / total) * 100, 10);

  // ✅ Update progress bar
  studyProgress.style.width = `${percentage}%`;
  studyProgress.style.backgroundColor = correctCount === total ? "#27ae60" : "#3498db";

  // Initial "Saving..." state
  resultsDiv.innerHTML = `<p>📊 Saving your answers...</p>`;
  resultsDiv.style.display = "block";

  // Save to backend
  saveQuizAnswers(studyPlanId, userAnswers, correctCount, total)
    .then((message) => {
      // ✅ Render results first
      resultsDiv.innerHTML = `
        <p>🎉 <strong>Quiz Completed!</strong></p>
        <p>You scored: <strong>${correctCount} / ${total}</strong></p>
        <ol type="A">
          ${userAnswers.map((a, i) => {
            const isCorrect = a.given === a.correct;
            return `
              <li>
                Q${i+1}: ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
                ${!isCorrect ? `(You: <strong>${a.given}</strong>, Correct: <em>${a.correct}</em>)` : ""}
              </li>
            `;
          }).join('')}
        </ol>
        <p id="show_message" style="color: orange; margin-top: 10px;"></p>
      `;

      // ✅ Now update the message (after DOM insertion)
      if (message) {
        document.getElementById("show_message").textContent = message;
      }
    })
    .catch((errorMsg) => {
      resultsDiv.innerHTML = `
        <p style="color: orange;">⚠️ Could not save answers (offline?)</p>
        <p>You scored: <strong>${correctCount} / ${total}</strong></p>
        <ol type="A">
          ${userAnswers.map((a, i) => {
            const isCorrect = a.given === a.correct;
            return `
              <li>
                Q${i+1}: ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
                ${!isCorrect ? `(You: <strong>${a.given}</strong>, Correct: <em>${a.correct}</em>)` : ""}
              </li>
            `;
          }).join('')}
        </ol>
        <p id="show_message" style="color: red; margin-top: 10px;"></p>
      `;

      if (errorMsg) {
        document.getElementById("show_message").textContent = errorMsg;
      }
    });
}

  // ✅ Save answers to backend
  async function saveQuizAnswers(plan_id, answers, score, total) {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id, answers, score, total })
      });

      if (response.status === 409) {
        const data = await response.json();
        return;
      }

      if (!response.ok) throw new Error("Save failed");

      const data = await response.json();
      console.log("✅ Quiz saved:", data);
    } catch (error) {
      console.error("Failed to save quiz:", error);
      throw error;
    }
  }

  // Add this in displayStudyPlan(), before renderQuestion()
checkIfQuizSubmitted(studyPlanId).then(submitted => {
  if (submitted) {
    const badge = document.createElement("p");
    //badge.innerHTML = `<strong style="color: #e67e22;">🟡 Quiz already completed!</strong>`;
    //quizContainer.parentElement.insertBefore(badge, quizContainer);
  }
});

async function checkIfQuizSubmitted(plan_id) {
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/quiz/result/${plan_id}`, {
      credentials: "include"
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

  renderQuestion(); // Start quiz
}

// 🔁 Start: Check auth, then load plan
checkAuth().then(authenticated => {
  if (authenticated && studyPlanId) {
    loadSavedStudyPlan(studyPlanId);
  } else if (!studyPlanId) {
    studyPlanContainer.innerHTML = "<p style='color: red;'>❌ No study plan ID provided in URL.</p>";
  }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (confirm("Are you sure you want to log out?")) {
    await logout();
  }
});