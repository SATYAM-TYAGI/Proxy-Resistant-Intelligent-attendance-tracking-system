const KEY = "kioskDeviceId";

export function getDeviceId() {
  const params = new URLSearchParams(window.location.search);
  const native = params.get("nativeDevice");
  if (native && native.trim()) {
    const id = native.trim().slice(0, 256);
    localStorage.setItem(KEY, id);
    return id;
  }
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `web-${Date.now()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
