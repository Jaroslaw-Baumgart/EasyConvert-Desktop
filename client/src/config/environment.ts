export const parseApiBaseUrl = (value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  const normalizedValue = value.trim();
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new Error("VITE_API_BASE_URL must be a valid HTTP(S) URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must be a valid HTTP(S) URL.");
  }

  return normalizedValue;
};

export const API_BASE_URL = parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
