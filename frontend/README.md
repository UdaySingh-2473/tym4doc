# 🏥 Tym4DOC — Full Stack Tym4DOC Booking

React frontend + Node.js/Express backend + MongoDB + Razorpay payments.

---

## Project Structure

```
Tym4DOC-react/          ← React frontend (Vite)
  src/
    pages/               ← Landing, PatientAuth, DoctorAuth, PatientDash, DoctorDash, AdminDash, AddDoctor
    components/shared/   ← Navbar, AdminModal, PaymentModal, UI primitives
    services/api.js      ← All fetch calls to backend
    constants/           ← colors, styles, data

backend/                 ← Express API
  models/                ← Patient.js, Doctor.js, Appointment.js (Mongoose)
  routes/                ← authRoutes, doctorRoutes, appointmentRoutes, paymentRoutes
  middleware/auth.js     ← JWT protect + authorize
  config/db.js           ← MongoDB connection
  server.js              ← Entry point
```

---

## Setup

### 1. MongoDB (free)
1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Click **Connect → Drivers** and copy the connection string
4. Replace `<username>` and `<password>` in the string

### 2. Razorpay (test keys)
1. Sign up at https://dashboard.razorpay.com
2. Go to **Settings → API Keys**
3. Generate **Test Mode** keys
4. Copy `Key ID` and `Key Secret`

### 3. Backend

```bash
cd backend
cp .env.example .env
# Fill in MONGO_URI, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, JWT_SECRET
npm install
npm run dev       # starts on http://localhost:5000
```

### 4. Frontend

```bash
cd ..             # back to Tym4DOC-react/
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api  (already set)
npm install
npm run dev       # starts on http://localhost:5173
```

---

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/patient/register` | Register patient |
| POST | `/api/auth/patient/login` | Patient login |
| POST | `/api/auth/doctor/register` | Register doctor |
| POST | `/api/auth/doctor/login` | Doctor login |
| POST | `/api/auth/admin/login` | Admin login |

### Doctors
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/doctors` | Public | All approved doctors |
| GET | `/api/doctors/pending` | Admin | Pending applications |
| GET | `/api/doctors/all` | Admin | All doctors |
| PATCH | `/api/doctors/:id/approve` | Admin | Approve doctor |
| PATCH | `/api/doctors/:id/reject` | Admin | Reject doctor |
| PATCH | `/api/doctors/:id/toggle` | Admin | Toggle availability |
| DELETE | `/api/doctors/:id` | Admin | Remove doctor |
| POST | `/api/doctors/admin-add` | Admin | Manually add doctor |

### Appointments
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/appointments` | Patient | Book appointment |
| GET | `/api/appointments/mine` | Patient | My appointments |
| GET | `/api/appointments/doctor` | Doctor | Doctor's appointments |
| GET | `/api/appointments/all` | Admin | All appointments |
| PATCH | `/api/appointments/:id/cancel` | Patient/Doctor | Cancel appointment |

### Payments (Razorpay)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/payment/create-order` | Patient | Create Razorpay order |
| POST | `/api/payment/verify` | Patient | Verify payment signature |
| GET | `/api/payment/key` | Any | Get Razorpay key_id |

---

## Payment Flow

```
Patient fills form
       ↓
Click "Proceed to Payment"
       ↓
Backend: POST /api/payment/create-order  →  Razorpay order_id
       ↓
Razorpay Checkout opens (UPI / Card / Net Banking)
       ↓
User pays
       ↓
Backend: POST /api/payment/verify  (HMAC-SHA256 signature check)
       ↓
Backend: POST /api/appointments  (appointment saved with payment info)
       ↓
Toast: "Appointment confirmed!"
```

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Doctor | rahul@medi.com | doctor123 |
| Admin | admin@Tym4DOC.com | admin123 |
| Patient | register first | — |

> **Note:** When the backend is not running, the app falls back to in-memory state (no data persistence, no real payments).
