import { logout } from '../js/logout.js';

// -------------------------
// DOM Elements
// -------------------------
const urlParams = new URLSearchParams(window.location.search);
const studyPlanId = urlParams.get('plan_id');
const studyPlanContainer = document.getElementById("studyPlan");
const welcomeUser = document.querySelector(".welcomeUser");
const studyProgress = document.getElementById("subjectProgress");
const far_bars = document.querySelector(".fa-bars");
const nav = document.querySelector(".sidebar");

// -------------------------
// Sidebar toggle
// -------------------------
far_bars.addEventListener("click", () => {
    far_bars.classList.toggle("fa-close");
    far_bars.style.color = "gray";
    far_bars.style.top = "30px";
    nav.classList.toggle("display_nav");
});

// -------------------------
// Check Authentication
// -------------------------
async function checkAuth() {
    try {
        const res = await fetch("https://studyaibudy.onrender.com/auth/api/user", {
            method: "GET",
            credentials: "include"
        });

        if (res.ok) {
            const userData = await res.json();
            welcomeUser.textContent = `Welcome back, ${userData.username}!`;
            return true;
        } else {
            const errorData = await res.json().catch(() => ({}));
            window.location.href = errorData.redirectUrl || "../index.html";
            return false;
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = "../index.html";
        return false;
    }
}

// -------------------------
// Load Saved Study Plan
// -------------------------
async function loadSavedStudyPlan(plan_id) {
    try {
        const response = await fetch(`https://studyaibudy.onrender.com/api/plan/${plan_id}`, {
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

// -------------------------
// Display Study Plan
// -------------------------
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

    // -------------------------
    // Render Quiz Question
    // -------------------------
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
               <ol style="margin-left:20px;" type="A">
    ${q.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i); // 65 = 'A'
            return `
            <li>
                <label>
                    <input type="radio" name="quiz-question-${currentQIndex}" value="${letter}" required>
                    ${letter}. ${opt}
                </label>
            </li>
        `;
        }).join('')}
</ol>

                <button onclick="checkAnswer(${currentQIndex})" style="background:#27ae60; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; margin-top:10px;">
                    Submit Answer
                </button>
            </div>
        `;
        quizContainer.appendChild(questionDiv);
    }

    // -------------------------
    // Check Answer
    // -------------------------
    window.checkAnswer = function (qIndex) {
        const selected = document.querySelector(`input[name="quiz-question-${qIndex}"]:checked`);
        if (!selected) {
            alert("Please select an answer!");
            return;
        }
        const givenLetter = selected.value; // Already 'A', 'B', 'C', ...
        const correctLetter = questions[qIndex].answer.trim().toUpperCase();


        userAnswers.push({ question: qIndex, given: givenLetter, correct: correctLetter });

        currentQIndex++;
        quizContainer.innerHTML = "";
        renderQuestion();
    };

    // -------------------------
    // Show Results & Save
    // -------------------------
    function showResults() {
        const correctCount = userAnswers.filter(a => a.given === a.correct).length;
        const total = questions.length;
        const percentage = Math.max((correctCount / total) * 100, 10);

        // Update progress bar
        studyProgress.style.width = `${percentage}%`;
        studyProgress.style.backgroundColor = correctCount === total ? "#27ae60" : "#3498db";

        resultsDiv.innerHTML = `<p>📊 Saving your answers...</p>`;
        resultsDiv.style.display = "block";

        saveQuizAnswers(studyPlanId, userAnswers, correctCount, total)
            .then(message => {
                resultsDiv.innerHTML = `
                    <p>🎉 <strong>Quiz Completed!</strong></p>
                    <p>You scored: <strong>${correctCount} / ${total}</strong></p>
                    <ol type="A">
                        ${userAnswers.map((a, i) => {
                    const isCorrect = a.given === a.correct;
                    return `
                                <li>
                                    Q${i + 1}: ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
                                    ${!isCorrect ? `(You: <strong>${a.given}</strong>, Correct: <em>${a.correct}</em>)` : ""}
                                </li>
                            `;
                }).join('')}
                    </ol>
                    <p id="show_message" style="color: orange; margin-top: 10px;">${message || ''}</p>
                `;
            })
            .catch(errMsg => {
                console.error("Failed to save answers:", errMsg);
                resultsDiv.innerHTML = `
                    <p style="color:red;">⚠️ Could not save answers</p>
                    <p>You scored: <strong>${correctCount} / ${total}</strong></p>
                `;
            });
    }

    // -------------------------
    // Save Quiz Answers
    // -------------------------
    async function saveQuizAnswers(plan_id, answers, score, total) {
        try {
            const payload = {
                plan_id,
                answers,
                score,
                total_questions: total // ⚡ Correct key
            };

            const response = await fetch("https://studyaibudy.onrender.com/api/quiz/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (response.status === 409) {
                const data = await response.json();
                console.warn("Duplicate quiz submission:", data);
                return "Quiz already submitted";
            }

            if (!response.ok) throw new Error("Save failed");

            const data = await response.json();
            return data.message;
        } catch (error) {
            console.error("Failed to save quiz:", error);
            throw error;
        }
    }

    // -------------------------
    // Check if quiz already submitted
    // -------------------------
    async function checkIfQuizSubmitted(plan_id) {
        try {
            const res = await fetch(`https://studyaibudy.onrender.com/api/quiz/result/${plan_id}`, {
                credentials: "include"
            });
            const data = await res.json();
            return data.attempted;
        } catch {
            return false;
        }
    }

    checkIfQuizSubmitted(studyPlanId).then(submitted => {
        if (submitted) {
            const badge = document.createElement("p");
            badge.innerHTML = `<strong style="color: #e67e22;">🟡 Quiz already completed!</strong>`;
            quizContainer.parentElement.insertBefore(badge, quizContainer);
        }
    });

    renderQuestion();
}

// -------------------------
// Initialize
// -------------------------
checkAuth().then(authenticated => {
    if (authenticated && studyPlanId) {
        loadSavedStudyPlan(studyPlanId);
    } else if (!studyPlanId) {
        studyPlanContainer.innerHTML = "<p style='color: red;'>❌ No study plan ID provided in URL.</p>";
    }
});

// -------------------------
// Logout
// -------------------------
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to log out?")) {
        await logout();
    }
});
