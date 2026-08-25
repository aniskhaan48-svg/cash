const API_PROXY_BASE = "/api/backend";

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_PROXY_BASE}${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    cache: "no-store",
  });

  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !path.startsWith("/api/auth")
  ) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  return response;
}
