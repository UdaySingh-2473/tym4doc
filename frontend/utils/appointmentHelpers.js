import {
  getMyAppointments,
  getDoctorAppointments,
  getClinicAppointments,
  getAllAppointments,
  initiateRefund,
} from "../services/api";

/**
 * Fetch appointments from DB after login and normalize them.
 * role: "patient" | "doctor" | "admin"
 */
export async function loadAppts(role, token, setter) {
  if (!token) return;
  try {
    let data;
    if (role === "patient")     data = await getMyAppointments(token);
    else if (role === "doctor")  data = await getDoctorAppointments(token);
    else if (role === "clinic") data = await getClinicAppointments(token);
    else if (role === "admin")  data = await getAllAppointments(token);

    if (!Array.isArray(data)) return;

    setter(
      data.map((a) => {
        const docIdRaw = a.doctorId;
        const docIdStr =
          typeof docIdRaw === "object" && docIdRaw !== null
            ? String(docIdRaw._id || docIdRaw.id || docIdRaw)
            : String(a.docId || docIdRaw || "");

        const patRaw   = a.patientId;
        const patName  =
          a.patientName ||
          (typeof patRaw === "object" && patRaw?.firstName
            ? `${patRaw.firstName} ${patRaw.lastName}`
            : "");
        const patEmail =
          a.patientEmail ||
          (typeof patRaw === "object" ? patRaw?.email : "") ||
          "";

        return {
          ...a,
          id:           a._id || a.id,
          docId:        docIdStr,
          patientName:  patName,
          patientEmail: patEmail,
          email:        patEmail,
          doctorName:
            a.doctorName ||
            (typeof docIdRaw === "object" && docIdRaw?.firstName
              ? `Dr. ${docIdRaw.firstName} ${docIdRaw.lastName}`
              : ""),
          photoUrl: (typeof docIdRaw === "object" ? docIdRaw?.photoUrl : "") || "",
          spec:     (typeof docIdRaw === "object" ? docIdRaw?.spec    : "") || a.spec || "",
        };
      })
    );
  } catch (err) {
    // Re-throw auth errors so callers can detect expired tokens
    if (err.message?.includes("Not authorised") || err.message?.includes("Token invalid")) {
      throw err;
    }
    /* offline — keep existing local state */
  }
}

/**
 * Initiate a Razorpay refund if the appointment has a paid status.
 * Fails silently (refund failures should be logged server-side in production).
 */
export async function tryRefund(appt, reason, token) {
  const id = appt._id || appt.id;
  if (!id || !token) return;
  if (appt.payment?.status !== "paid") return;
  try {
    await initiateRefund(String(id), reason, token);
  } catch {
    /* silent — log in production */
  }
}
