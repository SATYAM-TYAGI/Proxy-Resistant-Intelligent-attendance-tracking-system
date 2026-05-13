export function normalizeRoom(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function roomsMatch(a, b) {
  return normalizeRoom(a) === normalizeRoom(b);
}
