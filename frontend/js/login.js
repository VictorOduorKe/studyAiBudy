document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const msgDiv = document.querySelector(".authMsg");
  const loginBtn = document.getElementById("loginBtn");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // disable button & show loader
    loginBtn.disabled = true;
    loginBtn.style.background = "gray";
    const loader = document.createElement("span");
    loader.classList.add("loader"); // we'll style this in CSS
    loginBtn.appendChild(loader);

    try {
      const res = await fetch("https://studyaibudy.onrender.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        msgDiv.style.color = "green";
        msgDiv.textContent = "Login successful! Redirecting...";

        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }

        setTimeout(() => {
          window.location.href = "pages/dashboard.html";
        }, 1500);
      } else {
        msgDiv.style.color = "red";
        msgDiv.textContent = data.error || "Invalid login credentials";
      }
    } catch (err) {
      msgDiv.style.color = "red";
      msgDiv.textContent = "Error connecting to server";
      console.error("Login Error:", err);
    } finally {
      // remove loader & re-enable button
      loginBtn.disabled = false;
      loginBtn.style.background = "";
      loader.remove();
    }
  });
});
