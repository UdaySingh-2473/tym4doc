import { createContext, useContext, useState, useCallback } from "react";
import { approveClinic, rejectClinic, blockClinic, getAllClinics, searchClinics, getClinicDetails, settleClinic } from "../services/api";

const ClinicContext = createContext(null);

export function ClinicProvider({ children, showToast }) {
  const [clinics, setClinics] = useState([]);
  const [pendingClinics, setPending] = useState([]);
  const [specialties, setSpecialties] = useState([]);

  const refreshClinics = useCallback(async (token) => {
    if (!token) return;
    try {
      const res = await getAllClinics(token);
      setClinics(res);
    } catch { /* silent */ }
  }, []);

  // Admin: Approve
  const admApprove = useCallback(async (id, token) => {
    try {
      const res = await approveClinic(id, token);
      setPending(prev => prev.filter(c => String(c._id) !== String(id)));
      setClinics(prev => [...prev, res.clinic]);
      showToast(`${res.clinic.name} approved!`);
    } catch { showToast("Error approving clinic", true); }
  }, [showToast]);

  // Admin: Reject
  const admReject = useCallback(async (id, token) => {
    const reason = window.prompt("Reason for rejection:");
    if (!reason) return;
    try {
      const res = await rejectClinic(id, reason, token);
      setPending(prev => prev.map(c => String(c._id) === String(id) ? { ...c, status: "rejected", rejectReason: reason } : c));
      showToast(`${res.clinic.name} rejected.`);
    } catch { showToast("Error rejecting clinic", true); }
  }, [showToast]);

  // Admin: Block
  const admBlock = useCallback(async (id, token) => {
    try {
      const res = await blockClinic(id, token);
      setClinics(prev => prev.map(c => String(c._id) === String(id) ? { ...c, status: "blocked" } : c));
      showToast(`${res.clinic.name} blocked.`);
    } catch { showToast("Error blocking clinic", true); }
  }, [showToast]);

  // Admin: Settle
  const admSettle = useCallback(async (id, token) => {
    if (!window.confirm("Mark all unsettled payments as PAID? This will reset the earnings balance to zero.")) return;
    try {
      const res = await settleClinic(id, token);
      setClinics(prev => prev.map(c => String(c._id) === String(id) ? { ...c, totalRevenue: 0, adminRevenue: 0 } : c));
      showToast(`Settled! ${res.count || 0} appointments marked as paid.`);
    } catch { showToast("Error settling accounts", true); }
  }, [showToast]);

  const value = {
    clinics, setClinics,
    pendingClinics, setPending,
    specialties, setSpecialties,
    admApprove, admReject, admBlock, admSettle, refreshClinics
  };

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export const useClinic = () => useContext(ClinicContext);
