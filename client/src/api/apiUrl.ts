import { API_BASE_URL } from "../config/environment";

export const buildApiUrl = (maybeRelative: string): string => {
  if (/^https?:\/\//i.test(maybeRelative)) {
    return maybeRelative;
  }

  const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = maybeRelative.replace(/^\/+/, "");

  return `${normalizedBaseUrl}/${normalizedPath}`;
};
