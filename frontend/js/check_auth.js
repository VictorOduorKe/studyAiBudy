// js/check_auth.js
export async function checkAuth() {
  try {
    const res = await fetch("http://127.0.0.1:5000/auth/api/user", {
      method: "GET",
      credentials: "include"
    });

    if (res.ok) {
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