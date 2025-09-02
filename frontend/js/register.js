document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullname = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const authMsg = document.getElementById("authMsg");
  const signInBtn = document.getElementById("signInBtn");

  authMsg.innerText = ""; // Clear previous message

  // disable button & show loader
  signInBtn.disabled = true;
  signInBtn.style.background = "gray";
  const loader = document.createElement("span");
  loader.classList.add("loader");
  signInBtn.appendChild(loader);

  try {
    const response = await fetch("https://studyaibudy.onrender.com/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullname, email, password }),
      credentials: "include"
    });

    const data = await response.json();

    if (response.ok) {
      authMsg.style.color = "green";
      authMsg.innerText = data.message || "Registration successful!";
      document.getElementById("signupForm").reset();
      setTimeout(() => {
        window.location.href = "signin.html";
      }, 2000);
    } else {
      authMsg.style.color = "red";
      if (data.details && Array.isArray(data.details)) {
        authMsg.innerHTML = data.details.map(err => `• ${err}`).join("<br>");
      } else {
        authMsg.innerText = data.error || "Registration failed!";
      }
    }
  } catch (error) {
    console.error("Error during registration:", error);
    authMsg.style.color = "red";
    authMsg.innerText = "Server error. Please try again later.";
  } finally {
    // remove loader & re-enable button
    signInBtn.disabled = false;
    signInBtn.style.background = "";
    loader.remove();
  }
});
