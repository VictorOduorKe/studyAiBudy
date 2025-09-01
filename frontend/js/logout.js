// js/logout.js
export async function logout() {
  try {
    const res = await fetch("http://127.0.0.1:5000/auth/logout", {
      method: "POST",
      credentials: "include"  // 🔥 Required to send session cookie
    });

    if (res.ok) {
      // Clear any local UI state
      console.log("✅ Logout successful");
      window.location.href = "../index.html";  // Go to login
      return true;
    } else {
      // If backend returns error
      console.warn("Logout failed:", await res.text());
      window.location.href = "../index.html";
      return false;
    }
  } catch (err) {
    // Network error (e.g., server down)
    console.error("Logout failed:", err);
    window.location.href = "../index.html";
    return false;
  }
}