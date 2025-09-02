document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const msgDiv = document.querySelector(".authMsg");
  const loginBtn=document.getElementById("loginBtn");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("https://studyaibudy.onrender.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials:"include",
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      const span=document.createElement("span");
      loginBtn.appendChild(span);
      loginBtn.disasbled=true;
      loginBtn.style.color="gray"
      if (res.ok) {
        msgDiv.style.color = "green";
        msgDiv.textContent = "Login successful! Redirecting...";
        
        // save user info/token if your backend sends it
        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }

        // redirect to subject entry page after login
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
    }
  });
});
