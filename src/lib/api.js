const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001/api";

const storage = {
  get accessToken() {
    return localStorage.getItem("xloreAccessToken");
  },
  get refreshToken() {
    return localStorage.getItem("xloreRefreshToken");
  },
  save({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem("xloreAccessToken", accessToken);
    if (refreshToken) localStorage.setItem("xloreRefreshToken", refreshToken);
  },
  clear() {
    localStorage.removeItem("xloreAccessToken");
    localStorage.removeItem("xloreRefreshToken");
  }
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error?.message ?? "The request could not be completed.", response.status, data?.error?.details);
  }
  return data;
}

async function refreshAccessToken() {
  if (!storage.refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: storage.refreshToken })
  });
  if (!response.ok) {
    storage.clear();
    return false;
  }
  storage.save(await response.json());
  return true;
}

export async function api(path, options = {}, canRetry = true) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (storage.accessToken) headers.set("Authorization", `Bearer ${storage.accessToken}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && canRetry && (await refreshAccessToken())) {
    return api(path, options, false);
  }
  return parseResponse(response);
}

export { API_URL, storage };
