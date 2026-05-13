import { KioskDevice } from "../models/KioskDevice.js";
import { normalizeRoom } from "../utils/roomMatch.js";

const HEADER = "x-kiosk-device-id";

export function requireApprovedKiosk(req, res, next) {
  const raw = req.get(HEADER) || req.body?.kioskDeviceId;
  const deviceId = typeof raw === "string" ? raw.trim() : "";
  if (!deviceId) {
    return res.status(400).json({ error: "kiosk_device_required", message: "Open this action from the classroom kiosk app with a registered device." });
  }
  KioskDevice.findOne({ deviceId, status: "approved" })
    .lean()
    .then((row) => {
      if (!row || !row.classroom) {
        return res.status(403).json({ error: "kiosk_not_approved", message: "This tablet is not approved for a classroom yet. Ask an admin to approve it." });
      }
      req.kioskDevice = row;
      req.kioskClassroom = normalizeRoom(row.classroom);
      next();
    })
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    });
}
