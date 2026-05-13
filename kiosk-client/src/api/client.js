import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const h = config.headers;
    if (h && typeof h.delete === "function") h.delete("Content-Type");
    else if (h) delete h["Content-Type"];
  }
  return config;
});

export function setKioskDeviceId(deviceId) {
  const id = typeof deviceId === "string" ? deviceId.trim() : "";
  if (id) api.defaults.headers.common["x-kiosk-device-id"] = id;
  else delete api.defaults.headers.common["x-kiosk-device-id"];
}

export default api;
