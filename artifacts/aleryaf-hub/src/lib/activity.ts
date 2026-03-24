const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function logActivity(username: string, action: string, details?: string) {
  try {
    await fetch(`${BASE}/api/activity-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, action, details }),
    });
  } catch {
  }
}
