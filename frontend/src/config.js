const apiUrl = import.meta.env.VITE_API_URL?.trim();
if (!apiUrl) {
  throw new Error("Missing VITE_API_URL. Copy frontend/.env.example to frontend/.env.");
}
const parsed = new URL(apiUrl);
if (!["http:", "https:"].includes(parsed.protocol)) {
  throw new Error("VITE_API_URL must be an HTTP or HTTPS URL.");
}
export const API_BASE = apiUrl.replace(/\/+$/, "");
