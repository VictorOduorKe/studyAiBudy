// js/check_auth.js
export async function checkAuth() {
  try {
    const res = await fetch("https://studyaibudy.onrender.com/auth/api/user", {
      method: "GET",
      credentials: "include"
    });

    if (res.ok) {
      return true;
    } else {
      console.log("no response")
      window.location.href = "../index.html";
      return false;
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.href = "../index.html";
    return false;
  }
}