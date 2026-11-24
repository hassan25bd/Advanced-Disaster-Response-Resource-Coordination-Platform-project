export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `API error ${res.status}`;
    if (text) {
      try {
        const body = JSON.parse(text);
        message = typeof body.error === "string" ? body.error : text;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
  return res.json();
}

export function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
