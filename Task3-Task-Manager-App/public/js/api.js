// Thin fetch wrapper: attaches the access token and transparently refreshes it once on a 401.
let accessToken = null;
export const setToken = (t) => { accessToken = t; };

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

async function send(path, { method = "GET", body } = {}) {
  try {
    return await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: { ...(body !== undefined && { "Content-Type": "application/json" }), ...(accessToken && { Authorization: `Bearer ${accessToken}` }) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
}

/** Restores a session from the httpOnly refresh cookie. Returns the user or null. */
export async function refresh() {
  const res = await send("/auth/refresh", { method: "POST" }).catch(() => null);
  if (!res || !res.ok) return null;
  const { data } = await res.json();
  accessToken = data.accessToken;
  return data.user;
}

export async function api(path, opts = {}, retried = false) {
  const res = await send(path, opts);
  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    if (await refresh()) return api(path, opts, true);
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.message || "Something went wrong", json.details);
  return json;
}
