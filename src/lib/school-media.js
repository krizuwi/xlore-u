import { API_URL } from "./api.js";
export function schoolMediaUrl(value) {
  return value?.startsWith("/api/school-media/") ? `${API_URL}${value.slice(4)}` : value;
}
