/**
 * Duration-based attendance: compare time in class window vs scheduled length.
 * Active sessions use `asOf` (default now) when exit is unknown.
 */

export function computeAttendanceMetrics(session, entryTime, exitTime, asOf = new Date()) {
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  const planned = Math.max(1, end - start);
  const nowMs = new Date(asOf).getTime();
  const active = session.status === "active";

  if (!entryTime) {
    return { plannedDurationMs: planned, attendedDurationMs: 0, attendancePercentage: 0, status: "absent" };
  }

  let entry = Math.max(new Date(entryTime).getTime(), start);
  let exit;
  if (exitTime) {
    exit = new Date(exitTime).getTime();
  } else if (active) {
    exit = Math.min(Math.max(nowMs, entry), end);
  } else {
    exit = end;
  }

  exit = Math.min(Math.max(exit, entry), end);
  const attended = Math.max(0, exit - entry);
  const pct = (attended / planned) * 100;
  const status = pct >= 70 ? "present" : "absent";
  return {
    plannedDurationMs: planned,
    attendedDurationMs: attended,
    attendancePercentage: Math.round(pct * 100) / 100,
    status,
  };
}
