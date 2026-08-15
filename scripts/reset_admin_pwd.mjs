const API_KEY = "AIzaSyD05Coab-Dn-xU2GkvOJKnUH9gyBK9gos4";

async function resetAdminPassword() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email: "admin@rakeb.com"
    })
  });
  const data = await res.json();
  console.log("Password reset email sent status:", data);
  process.exit(0);
}

resetAdminPassword();
