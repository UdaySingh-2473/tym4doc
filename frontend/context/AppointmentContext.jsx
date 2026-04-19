import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { loadAppts, tryRefund } from "../utils/appointmentHelpers";
import { getSocket, joinRoom, leaveRoom } from "../services/socket";
import {
  rejectAppointment, cancelAppointment,
} from "../services/api";

const AppointmentContext = createContext(null);

export function AppointmentProvider({ children, showToast }) {
  const [appointments, setAppts] = useState([]);

  // Use ref so socket handlers always have the latest showToast without
  // causing useCallback/useEffect dependency changes
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const refreshAppts = useCallback((role, token) => {
    return loadAppts(role, token, setAppts);
  }, []);

  // Set up socket listeners for global appointment updates
  // Dependencies are now stable: refreshAppts never changes, showToast is via ref
  const initSocketListeners = useCallback((role, userId, token) => {
    if (!role || !userId) return;
    const room = `${role}:${userId}`;
    joinRoom(room);
    const socket = getSocket();

    // Remove ALL existing listeners for these events to guarantee clean slate
    socket.removeAllListeners("new-appointment");
    socket.removeAllListeners("appointment-updated");

    socket.on("new-appointment", () => {
      console.log(`[Socket] new-appointment received for ${role}`);
      refreshAppts(role, token);
      const toast = showToastRef.current;
      if (toast) {
        if (role === "clinic") toast("New appointment booked!");
        else if (role === "doctor") toast("New appointment assigned to you!");
      }
    });

    socket.on("appointment-updated", (data) => {
      console.log(`[Socket] appointment-updated received for ${role}:`, data);
      refreshAppts(role, token);
      const toast = showToastRef.current;
      if (toast) {
        if (role === "patient") {
          if (data.rescheduled) toast("Your appointment was rescheduled.");
          else if (data.status === "cancelled") toast("Your appointment has been cancelled.");
          else toast(`Appointment status updated: ${data.status}.`);
        } else if (role === "doctor") {
          if (data.status === "cancelled") toast("An appointment has been cancelled.");
          else if (data.rescheduled) toast("An appointment has been rescheduled.");
          else toast(`Appointment updated: ${data.status}.`);
        } else if (role === "clinic") {
          if (data.status === "cancelled") toast("An appointment has been cancelled.");
          else toast(`Appointment updated: ${data.status}.`);
        }
      }
    });

    return () => {
      leaveRoom(room);
      socket.removeAllListeners("new-appointment");
      socket.removeAllListeners("appointment-updated");
    };
  }, [refreshAppts]); // No showToast dep — uses ref instead


  const bookAppt = useCallback((newAppt, token) => {
    setAppts(prev => [newAppt, ...prev]);
    if (token) setTimeout(() => loadAppts("patient", token, setAppts), 1000);
  }, []);


  // ── Doctor/Clinic: Reject ───────────────────────────────────────────────
  const rejectAppt = useCallback(async (id, rescheduleSuggest, token, role = "clinic") => {
    const appt = appointments.find(a => String(a._id || a.id) === String(id));
    setAppts(prev =>
      prev.map(a =>
        String(a._id || a.id) === String(id)
          ? { ...a, status: "cancelled", cancelledBy: role, rescheduleSuggest: rescheduleSuggest || null }
          : a
      )
    );
    try { 
      await rejectAppointment(id, token, rescheduleSuggest); 
      if (appt?.payment?.status === "paid") {
        await tryRefund(appt, "Appointment rejected by " + role, token);
        showToastRef.current?.("Appointment rejected. Refund initiated.");
      } else {
        showToastRef.current?.("Appointment rejected.");
      }
    } catch (err) { 
      // Revert local state if API fails
      refreshAppts(role, token);
      showToastRef.current?.(err.message || "Failed to reject appointment", true);
    }
  }, [appointments, refreshAppts]);

  // ── Patient / Doctor: Cancel ─────────────────────────────────────
  const cancelAppt = useCallback(async (id, rescheduleSuggest, token, role = "patient") => {
    const appt = appointments.find(a => String(a._id || a.id) === String(id));
    // Optimistic update
    setAppts(prev =>
      prev.map(a =>
        String(a._id || a.id) === String(id)
          ? { ...a, status: "cancelled", cancelledBy: role, rescheduleSuggest: rescheduleSuggest || null }
          : a
      )
    );
    try {
      await cancelAppointment(id, token, rescheduleSuggest);
      if (appt?.payment?.status === "paid") {
        await tryRefund(appt, "Appointment cancelled", token);
        showToastRef.current?.("Appointment cancelled. Refund initiated — 5–7 business days.");
      } else {
        showToastRef.current?.("Appointment cancelled.");
      }
    } catch (err) {
      // Revert local state if API fails
      refreshAppts(role, token);
      showToastRef.current?.(err.message || "Failed to cancel appointment", true);
    }
  }, [appointments, refreshAppts]);

  const value = {
    appointments, setAppts,
    bookAppt, rejectAppt, cancelAppt, refreshAppts,
    initSocketListeners
  };

  return <AppointmentContext.Provider value={value}>{children}</AppointmentContext.Provider>;
}

export const useAppointment = () => useContext(AppointmentContext);
