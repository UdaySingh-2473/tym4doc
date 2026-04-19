const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.data = data; // Attach full response data
    throw error;
  }
  return data;
}

const get = (path, token) => request("GET", path, null, token);
const post = (path, body, token) => request("POST", path, body, token);
const put = (path, body, token) => request("PUT", path, body, token);
const patch = (path, body, token) => request("PATCH", path, body, token);
const del = (path, token) => request("DELETE", path, null, token);

// Auth
export const patientRegister = (data) => post("/auth/patient/register", data);
export const patientLogin = (email, pass) => post("/auth/patient/login", { email, password: pass });
export const clinicRegister = (data) => post("/auth/clinic/register", data);
export const clinicLogin = (email, pass) => post("/auth/clinic/login", { email, password: pass });
export const doctorLogin = (email, pass) => post("/auth/doctor/login", { email, password: pass });
export const adminLogin = (email, pass) => post("/auth/admin/login", { email, password: pass });
export const getAdminPatients = (token) => get("/auth/admin/patients", token);

// Forgot / Reset / Change Password
export const forgotPassword = (email, role) => post("/auth/forgot-password", { email, role });
export const resetPassword = (data) => post("/auth/reset-password", data);
export const verifyEmail = (token, role) => get(`/auth/verify-email?token=${token}&role=${role}`);
export const resendVerification = (token) => post("/auth/resend-verification", {}, token);
export const changePassword = (currentPassword, newPassword, token) => put("/auth/change-password", { currentPassword, newPassword }, token);

// Profile Updates
export const updatePatientProfile = (data, token) => put("/auth/patient/profile", data, token);
export const updateClinicProfile = (data, token) => put("/auth/clinic/profile", data, token);
export const getMyProfile = (role, token) => get(`/auth/${role}/profile`, token);


// Specialties
export const getSpecialties = () => get("/specialties");
export const addSpecialty = (data, token) => post("/specialties", data, token);

// Clinics
export const searchClinics = (query = "", city = "") => get(`/clinics/search?query=${query}&city=${city}`);
export const getSearchSuggestions = (query = "") => get(`/clinics/suggestions?query=${query}`);
export const getClinicDetails = (id) => get(`/clinics/${id}`);
export const getAllClinics = (token) => get("/clinics", token);
export const getAdminClinicStats = (id, token) => get(`/clinics/${id}/stats`, token);
export const approveClinic = (id, token) => put(`/clinics/${id}/approve`, {}, token);
export const rejectClinic = (id, reason, token) => put(`/clinics/${id}/reject`, { reason }, token);
export const blockClinic = (id, token) => put(`/clinics/${id}/block`, {}, token);
export const settleClinic = (id, token) => post(`/clinics/${id}/settle`, {}, token);

// Doctors
export const getAllDoctorsAdmin = (token) => get("/doctors/all", token);
export const addDoctorClinic = (data, token) => post("/doctors", data, token);
export const getMyDoctorsClinic = (token) => get("/doctors/my-doctors", token);
export const getClinicDoctors = (clinicId) => get(`/doctors/clinic/${clinicId}`);
export const getDoctorsByClinicSpecialty = (clinicId, specialtyId) => get(`/doctors/clinic/${clinicId}/specialty/${specialtyId}`);
export const updateDoctorClinic = (id, data, token) => put(`/doctors/${id}`, data, token);
export const deleteDoctorClinic = (id, token) => del(`/doctors/${id}`, token);
export const uploadDoctorPhoto = async (file) => {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await fetch(`${BASE}/upload/doctor-photo`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
};

// Appointments
export const getMyAppointments = (token) => get("/appointments/mine", token);
export const getDoctorAppointments = (token) => get("/appointments/doctor", token);
export const getClinicAppointments = (token) => get("/appointments/clinic", token);
export const getAllAppointments = (token) => get("/appointments/all", token);
export const getCommissionStats = (token) => get("/appointments/commission", token);
export const getAdminPatientHistory = (id, token) => get(`/appointments/admin/patient/${id}`, token);
export const getAdminDoctorHistory = (id, token) => get(`/appointments/admin/doctor/${id}`, token);
export const createAppointment = (data, token) => post("/appointments", data, token);
export const getBookedSlots = (doctorId, date) => get(`/appointments/slots?doctorId=${doctorId}&date=${date}`);
export const completeAppointment = (id, token) => patch(`/appointments/${id}/complete`, {}, token);
export const rejectAppointment = (id, token, rescheduleSuggest) => patch(`/appointments/${id}/reject`, rescheduleSuggest ? { rescheduleSuggest } : {}, token);
export const cancelAppointment = (id, token, rescheduleSuggest) => patch(`/appointments/${id}/cancel`, rescheduleSuggest ? { rescheduleSuggest } : {}, token);
export const rescheduleAppointment = (id, data, token) => patch(`/appointments/${id}/reschedule`, data, token);
export const sendAppointmentReminder = (id, data, token) => post(`/appointments/${id}/remind`, data, token);

// Payment
export const initiateRefund = (appointmentId, reason, token) => post("/payment/refund", { appointmentId, reason }, token);
export const createRazorpayOrder = (data, token) => post("/payment/create-order", data, token);
export const verifyPayment = (data, token) => post("/payment/verify", data, token);
export const getRazorpayKey = (token) => get("/payment/key", token);
export const submitSupport = (data, token) => post("/support", data, token);
