# Proxy-Resistant Intelligent Attendance Tracking System (PRATS)

Full-stack prototype for face-based attendance with separate **student** and **faculty** roles, duration-based presence rules, and a dedicated **Python AI microservice** for embeddings and liveness checks.

---

## Table of contents

1. [What we used and why](#what-we-used-and-why)
2. [How the project works (end-to-end flow)](#how-the-project-works-end-to-end-flow)
3. [How it differs from the earlier prototype](#how-it-differs-from-the-earlier-prototype)
4. [Prerequisites and how to run](#prerequisites-and-how-to-run)
5. [API summary](#api-summary)
6. [Folder layout](#folder-layout)
7. [Notes and limitations](#notes-and-limitations)

---

## What we used and why

### Frontend: React with Vite

**What:** Single-page app with `react-router-dom`, role-based screens (landing, registration, login, student dashboard, faculty dashboard, mark-attendance with camera).

**Why:**

- **React** fits dashboards, forms, and conditional UI (student vs faculty) without full page reloads.
- **Vite** gives fast dev refresh and a simple production build; the dev server **proxies `/api`** to the Node backend so the browser only talks to one origin during development (fewer CORS issues).
- **Responsive layout** (CSS grid, flexible sidebars) works on **laptop, desktop, and mobile browsers**—important for “any device” attendance without a native app.

---

### Backend: Node.js + Express

**What:** REST API, JWT authentication, file uploads (multer), calls to the AI service, business rules for attendance duration.

**Why:**

- **Express** is a small, familiar layer for routing and middleware; good fit for **JSON + multipart** in the same codebase.
- **JavaScript end-to-end** (React + Node) reduces context switching and makes sharing types or conventions easier if you grow the project.
- The API is the **single gate** for auth and enrollment: the AI service never touches the database directly, so you can swap or scale the AI layer without rewriting auth.

---

### Database: MongoDB + Mongoose

**What:** Collections (mapped as Mongoose models) for users, courses, class sessions, and attendance records.

**Why:**

- **Flexible schema** for evolving fields (e.g. optional `exitTime`, gallery embeddings later) without heavy migrations in a prototype.
- **Document model** matches natural aggregates: a course embeds `studentIds`; an attendance row is one document per `(student, class session)`.
- **Mongoose** adds validation, indexes (unique email, sparse unique `sapId` / `facultyId`), and readable query code.

**Design intent:** Users hold `faceEmbedding` (primary vector) and optional `faceGallery` for future use; the hot path for marking attendance uses the **primary embedding** to keep payloads smaller.

---

### Auth: bcrypt + JWT

**What:** Passwords stored as **bcrypt** hashes; clients send **`Authorization: Bearer <token>`** after login/register.

**Why:**

- **bcrypt** is a standard choice for password hashing (slow by design, salt embedded).
- **JWT** keeps the API **stateless**: no server-side session store is required for this prototype (trade-off: revocation is harder unless you add a blocklist or short-lived tokens).

---

### AI service: Python + FastAPI

**What:** Separate process exposing HTTP endpoints: face embedding extraction at registration, and `/mark-attendance` for a batch of frames + candidate students.

**Why:**

- **Python** is where **InsightFace** and **ONNX Runtime** are easiest to integrate; the Node stack is not ideal for heavy numeric / model inference.
- **FastAPI** gives automatic OpenAPI docs, async-friendly endpoints, and clear request/response models (`Pydantic`).
- **Split service** lets you run inference on a **GPU machine** while the API and DB stay on another host if needed.

---

### Face recognition: InsightFace (`buffalo_s` with `buffalo_l` fallback)

**What:** Deep face model producing a **fixed-length embedding** per face; cosine similarity compares probe (camera) to enrolled vectors.

**Why:**

- Strong **accuracy vs. classical CV** for identity under mild pose/lighting changes.
- **`buffalo_s`** is **smaller and faster** than **`buffalo_l`**, which matters for **latency** and CPU-only deployments.
- **Fallback to `buffalo_l`** avoids a hard failure if a given environment does not ship or download `buffalo_s` correctly.

**Reasoning vs. “send video every time”:** Storing embeddings in MongoDB means each check-in sends **only a few compressed images**, not a full video file every time.

---

### Liveness: OpenCV heuristics (no dlib landmark file)

**What:** Simple checks over consecutive frames: **face-box motion**, **Laplacian sharpness** (reject overly flat / printed photos), and **frame-to-frame difference** (reject a frozen image).

**Why:**

- The earlier Streamlit prototype used **dlib + `shape_predictor_68_face_landmarks.dat`**—accurate for blinks but **heavy to deploy** (extra binary, setup friction, not ideal for “simple embedded” clients).
- These heuristics are **weaker than dedicated anti-spoof models** but **cheap, portable, and fast**—reasonable for a **prototype** that must run without extra weight files.
- **Trade-off:** Determined spoofing can still defeat heuristic liveness; production systems often add **active challenges** or **specialized anti-spoof nets**.

---

### Registration upload path: multipart to AI (`/extract-registration`)

**What:** Node forwards **selfie + video** as **multipart** to Python; Python returns `primary_embedding` and optional `gallery_embeddings`.

**Why:**

- Avoids **double base64 expansion** in JSON (smaller memory footprint and less overhead than stuffing an entire video into a JSON body).
- Keeps **one round trip** for “extract vectors from media” while the API server remains responsible for **persisting** vectors in MongoDB.

*(Optional: `extract-registration-b64` still exists for small tests or tools that cannot send multipart easily.)*

---

### Mark attendance: burst of JPEG frames (client) + one AI call

**What:** The browser captures several **low-resolution JPEG** frames over ~2–3 seconds, base64-encoded **without** `data:` prefix in the JSON payload expected by the backend.

**Why:**

- **Latency:** A handful of small JPEGs is usually **much smaller and faster** than uploading a full video per attempt.
- **Bandwidth:** Mobile or lab networks benefit from **not** repeating large uploads.
- **Server logic:** Node loads **only enrolled students for that course** and sends their embeddings to the AI service, so complexity scales with **class size**, not total users in the system.

---

## How the project works (end-to-end flow)

### High-level architecture

```text
┌─────────────┐     HTTPS/HTTP      ┌──────────────┐      HTTP       ┌─────────────┐
│   Browser   │ ◄─────────────────► │ Node (Express│ ◄──────────────► │ FastAPI AI  │
│   (React)   │      /api/*         │  + MongoDB)  │  mark-attendance │ (InsightFace)│
└─────────────┘                     └──────────────┘   extract-reg     └─────────────┘
                                          │
                                          ▼
                                    ┌───────────┐
                                    │ MongoDB   │
                                    └───────────┘
```

1. **React** talks only to **Node** (same host in dev via Vite proxy).
2. **Node** owns **auth, courses, sessions, attendance rules**, and **secrets**; it calls **Python** for anything involving raw images/video and model inference.
3. **MongoDB** stores durable state; the AI service is **stateless** regarding users (it receives candidate embeddings in the request).

---

### Flow A: Registration (student or faculty)

1. User fills **name, SAP ID or Faculty ID, email, password** and uploads **selfie + short video** on the React form.
2. Browser sends **multipart** to **`POST /api/auth/register/...`**.
3. Node validates uniqueness (email, SAP/Faculty ID), then forwards selfie/video to **`POST /extract-registration`** on the AI service.
4. Python decodes the selfie, runs face detection/embedding, samples frames from the video, aggregates into a **primary embedding** (and optional gallery list).
5. Node stores **`passwordHash`**, **`faceEmbedding`**, role, and identifiers in **MongoDB**, then returns a **JWT** so the user can enter the app immediately.

**Why video at registration:** Extra frames improve the **robustness** of the stored template (lighting/pose variety) compared to a single selfie alone.

---

### Flow B: Login

1. User submits email + password to **`POST /api/auth/login`**.
2. Node loads the user, verifies **bcrypt**, issues **JWT** with `sub` (user id) and `role`.
3. React stores the token (e.g. `localStorage` in this prototype) and attaches **`Authorization: Bearer ...`** on subsequent API calls.

---

### Flow C: Faculty — courses and class sessions

1. **Create course** → **`POST /api/courses`** (faculty only). Course is tied to `facultyId`.
2. **Schedule a class session** (course, date, start time, end time) → **`POST /api/classes`**. Session is created with **`status: inactive`** until started.
3. **Start class** → **`POST /api/classes/:id/start`**: that session becomes **`active`**; other active sessions for the same course are turned **inactive** (only one live session per course in this design).
4. **End class** → **`POST /api/classes/:id/end`**: session **`inactive`**; server **recomputes** duration-based metrics for attendance rows tied to that session (see Flow E).

---

### Flow D: Student — enrollment and “joining” class

1. Student discovers a **course id** (in the demo UI, a **browse** list; in production you would replace this with codes, invites, or admin enrollment).
2. **`POST /api/courses/:id/enroll`** adds the student’s id to **`course.studentIds`**.
3. **`GET /api/classes/active`** returns sessions that are **active** and visible to that user (student: courses they are enrolled in; faculty: their courses). The UI shows **Mark attendance** only when a relevant session is **active**.

---

### Flow E: Mark attendance (AI path)

1. Student opens **Mark attendance** for a **`classSessionId`**; browser starts the **camera**.
2. On **Start scan**, the client collects a **short burst** of JPEG base64 frames (`captureFramesFromVideo` in the client).
3. **`POST /api/attendance/mark-ai`** with `{ classSessionId, frames }`.
4. Node checks: session exists, **`status === active`**, student is **enrolled** in the course.
5. Node loads **face embeddings** for **enrolled students only**, builds the **`students`** array for the AI call.
6. Python **`/mark-attendance`**:
   - decodes frames, detects faces, optionally downscales for speed;
   - runs **liveness**; if it fails → **`liveness_failed`**;
   - averages probe embeddings, **cosine match** against candidates;
   - returns **`success`** + `name` + `sap_id`, or **`unknown`**, or **`no_face`**.
7. Node verifies **`sap_id` matches the logged-in student** (prevents “recognized as someone else in class” from crediting the wrong account).
8. Node creates or updates an **Attendance** document: sets **`entryTime`** on first successful mark; while class is active, **percentage** is computed as **time in window vs scheduled length** (see below).
9. Response drives UI: **Attendance marked**, **Liveness failed**, or **Unknown person**.

---

### Flow F: Exit time and the 70% rule

**Concept:** Attendance is not only “who showed up” but **how long** they were associated with the scheduled slot.

- **`entryTime`:** Set on first successful AI mark (or set explicitly on manual present with full session window).
- **`exitTime`:** Student may call **`POST /api/attendance/leave`** when leaving early; if missing at finalize time, the system assumes presence until **scheduled `endTime`** when the session is no longer active (configurable policy—this prototype optimizes for “stayed unless they left early and tapped leave”).
- **`computeAttendanceMetrics`** (server):
  - **`plannedDurationMs`** = scheduled end − start.
  - While session is **active** and `exitTime` is null, effective end for the formula is **`min(now, scheduledEnd)`** so the student sees **live progress** toward 70%.
  - When session is **inactive**, missing `exitTime` uses **scheduled end** for finalization.
  - **`status`:** **`present`** if attended fraction **≥ 70%**, else **`absent`** (unless **manual override**).

**Why 70%:** Encourages **physical presence** for most of the period; a single snapshot at the door is not enough if someone leaves immediately (unless they also falsely appear present for the whole window—mitigations would be periodic re-checks in a future version).

---

### Flow G: Manual attendance (faculty)

1. Faculty opens **session summary** → **`GET /api/attendance/summary/:classSessionId`**.
2. **`POST /api/attendance/manual`** with `studentId` and `present` flag.
3. **Present:** `manualOverride` set; row forced **present** with full session span for metrics (demo-friendly override when AI or hardware fails).
4. **Absent:** row marked **absent** with appropriate timestamps.

---

### Flow H: History and summary

- **Student:** **`GET /api/attendance/history`** — past rows with populated class/course info for the dashboard table.
- **Faculty:** Summary endpoint lists all attendance rows for a session with student names/SAP IDs for review.

---

## How it differs from the earlier prototype

The **`Prototype/`** folder used **Streamlit**, **~5s continuous capture**, **pickle** for a local “database,” and **dlib** landmarks for blinks. **PRATS** replaces that with:

- A **proper multi-tier app** (React / Node / MongoDB / Python).
- **Fewer, smaller frames** per attendance attempt and **scoped candidate lists** for recognition.
- **Liveness without external landmark files** (trade-off: weaker spoof resistance).
- **Duration-based** attendance with **faculty start/end** and optional **student leave**.

---

## Prerequisites and how to run

- **Node.js 18+** (uses native `FormData` / `Blob` for forwarding multipart to the AI service).
- **MongoDB** (default `mongodb://127.0.0.1:27017/prats`).
- **Python 3.10+** (3.11 recommended).
- Device with a **camera** for registration and attendance.

### 1. MongoDB

Start MongoDB locally or set **`MONGODB_URI`** in `server/.env`.

### 2. AI service (Python)

```powershell
cd "e:\Proxy Resitant Attendance Tracking System\ai-service"
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

First run may download ONNX/InsightFace weights.

### 3. API server (Node)

```powershell
cd "e:\Proxy Resitant Attendance Tracking System\server"
copy .env.example .env
# Set JWT_SECRET, MONGODB_URI if needed, AI_SERVICE_URL=http://127.0.0.1:8000
npm install
npm run dev
```

API: **`http://127.0.0.1:5000`**

### 4. Web client (React)

```powershell
cd "e:\Proxy Resitant Attendance Tracking System\client"
npm install
npm run dev
```

Open **`http://127.0.0.1:5173`** — Vite proxies **`/api`** to the Node server.

### Typical demo sequence

1. Register **faculty** → register **student** (AI service must be running).
2. Faculty: **course** → **schedule class** → **Start** session.
3. Student: **enroll** (course id) → **Mark attendance**; optional **Mark leave**.
4. Faculty: **End** session → review **summary** / **manual** rows.

### 5. Run with Docker (recommended for containerized setup)

From the repository root:

```powershell
cd "e:\Proxy Resitant Attendance Tracking System"
docker compose up --build
```

Services:

- Frontend (Nginx + built React): **`http://127.0.0.1:5173`**
- Node API: **`http://127.0.0.1:5000`**
- AI service: **`http://127.0.0.1:8000`**
- MongoDB: **`mongodb://127.0.0.1:27017/prats`**

Notes:

- In Docker, backend uses `MONGODB_URI=mongodb://mongo:27017/prats` and `AI_SERVICE_URL=http://ai-service:8000`.
- Replace the default `JWT_SECRET` in `docker-compose.yml` before production.
- Stop and remove containers with `docker compose down`.
- To also remove MongoDB volume data: `docker compose down -v`.

---

## API summary

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register/student` | multipart: name, sapId, email, password, selfie, video |
| POST | `/api/auth/register/faculty` | multipart: name, facultyId, email, password, selfie, video |
| POST | `/api/auth/login` | JSON email/password |
| POST | `/api/courses` | faculty: create course |
| GET | `/api/courses/mine` | student: enrolled; faculty: owned |
| GET | `/api/courses/browse` | student: list courses (demo catalog) |
| POST | `/api/courses/:id/enroll` | student enroll |
| POST | `/api/classes` | faculty: schedule class |
| GET | `/api/classes/mine` | faculty sessions |
| GET | `/api/classes/active` | active sessions for this user |
| POST | `/api/classes/:id/start` | activate session |
| POST | `/api/classes/:id/end` | deactivate + finalize percentages |
| POST | `/api/attendance/mark-ai` | student: `{ classSessionId, frames: [base64 jpeg...] }` |
| POST | `/api/attendance/leave` | student: set exit time |
| POST | `/api/attendance/manual` | faculty override |
| GET | `/api/attendance/history` | student |
| GET | `/api/attendance/summary/:classSessionId` | faculty |

### AI service (direct)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Liveness probe |
| POST | `/extract-registration` | multipart `selfie` + `video` |
| POST | `/extract-registration-b64` | optional JSON `{ selfie_b64, video_b64 }` |
| POST | `/mark-attendance` | JSON: `frames`, `students[]` with `embedding`, optional `threshold` |

---

## Folder layout

```text
ai-service/     FastAPI, InsightFace, liveness helpers
client/         React (Vite) UI
server/         Express, Mongoose, JWT, business rules
Prototype/      Earlier Streamlit demo (reference only)
```

---

## Notes and limitations

- **Security:** Treat this as a **prototype**. Use HTTPS in production, strong secrets, rate limiting, and tighter enrollment than a public course browse list.
- **Face threshold:** Default cosine threshold on the AI service is tunable per deployment (lighting, camera quality).
- **Liveness:** Heuristic only—not equivalent to banking-grade presentation-attack detection.
- **Scaling:** For very large classes, consider **batching**, **caching**, or **approximate search** (e.g. FAISS) instead of sending every embedding in one request—this codebase optimizes for clarity and typical class sizes.
