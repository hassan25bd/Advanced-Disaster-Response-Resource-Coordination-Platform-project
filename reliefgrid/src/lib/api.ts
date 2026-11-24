export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API error ${res.status}`);
  }
  return res.json();
}

export function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
