import { API_BASE } from "./lib/apiBase";

export async function pingHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("API health failed");
  return res.json();
}