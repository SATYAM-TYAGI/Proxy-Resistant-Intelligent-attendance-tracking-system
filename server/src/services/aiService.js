import axios from "axios";

const base = () => process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

export async function extractRegistrationMultipart(selfieBuffer, videoBuffer) {
  const form = new FormData();
  form.append("selfie", new Blob([selfieBuffer], { type: "image/jpeg" }), "selfie.jpg");
  form.append("video", new Blob([videoBuffer], { type: "video/mp4" }), "clip.mp4");
  const { data } = await axios.post(`${base()}/extract-registration`, form, {
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data;
}

export async function markAttendance(frames, students, threshold = 0.38) {
  const { data } = await axios.post(
    `${base()}/mark-attendance`,
    { frames, students, threshold },
    { timeout: 60000 }
  );
  return data;
}
