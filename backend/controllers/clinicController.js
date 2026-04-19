const Clinic = require("../models/Clinic");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

// Admin: Get all clinics with revenue summary
exports.getAllClinics = async (req, res) => {
  try {
    const clinics = await Clinic.find({}).select("-password").lean();
    // Add revenue summary per clinic
    const enriched = await Promise.all(clinics.map(async c => {
      const appts = await Appointment.find({ clinicId: c._id, status: { $in: ["approved", "completed"] }, settled: { $ne: true } });
      const revenue = appts.reduce((sum, a) => sum + (a.clinic_earning || 0), 0);
      const adminRevenue = appts.reduce((sum, a) => sum + (a.admin_commission || 0), 0);
      return { ...c, totalRevenue: revenue, adminRevenue };
    }));

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Approve clinic
exports.approveClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true }).select("-password");
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });
    res.json({ message: "Clinic approved", clinic });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Reject clinic
exports.rejectClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByIdAndUpdate(req.params.id, { status: "rejected", rejectReason: req.body.reason }, { new: true }).select("-password");
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });
    res.json({ message: "Clinic rejected", clinic });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Block clinic
exports.blockClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByIdAndUpdate(req.params.id, { status: "blocked" }, { new: true }).select("-password");
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });
    res.json({ message: "Clinic blocked", clinic });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// User: Search approved clinics
exports.searchClinics = async (req, res) => {
  try {
    const { query, city } = req.query;
    const filter = { status: "approved" };
    
    if (query && !city) {
      filter.$or = [
        { name: { $regex: new RegExp(query, "i") } },
        { city: { $regex: new RegExp(query, "i") } }
      ];
    } else {
      if (city) filter.city = { $regex: new RegExp(city, "i") };
      if (query) filter.name = { $regex: new RegExp(query, "i") };
    }
    
    const clinics = await Clinic.find(filter).select("-password -documents");
    res.json(clinics);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// User: Get search suggestions (clinics, cities, doctors)
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);

    const regex = new RegExp(query, "i");
    
    // 1. Search Clinics (Name, City, State, Address, Phone)
    const clinics = await Clinic.find({
      status: "approved",
      $or: [
        { name: regex },
        { city: regex },
        { state: regex },
        { address: regex },
        { phone: regex }
      ]
    }).select("name city state address phone").limit(5).lean();

    // 2. Search Doctors (firstName, lastName, specialty, degree)
    const doctors = await Doctor.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { specialty: regex },
        { degree: regex }
      ]
    }).populate("clinicId", "name city state").limit(5).lean();

    const suggestions = [];

    // Format Clinic suggestions
    clinics.forEach(c => {
      // Add clinic suggestion
      suggestions.push({
        type: "clinic",
        text: c.name,
        subtext: `${c.city}, ${c.state}`,
        id: c._id
      });

      // Add city suggestion if it matches and isn't already added
      if (c.city.match(regex)) {
        const cityKey = `city:${c.city}`;
        if (!suggestions.find(s => s.key === cityKey)) {
          suggestions.push({
            key: cityKey,
            type: "location",
            text: c.city,
            subtext: c.state,
            id: c.city // for city search
          });
        }
      }
    });

    // Format Doctor suggestions
    doctors.forEach(d => {
      if (d.clinicId) {
        suggestions.push({
          type: "doctor",
          text: `Dr. ${d.firstName} ${d.lastName}`,
          subtext: `${d.specialty} at ${d.clinicId.name}`,
          id: d._id,
          clinicId: d.clinicId._id,
          specialty: d.specialty,
          doctor: d
        });
      }
    });

    // Remove duplicates and limit
    const unique = [];
    const seen = new Set();
    suggestions.forEach(s => {
      const key = `${s.type}:${s.text}:${s.subtext}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    });

    res.json(unique.slice(0, 10));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// User/Clinic: Get clinic details
exports.getClinicDetails = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id).select("-password");
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });
    
    // Get unique specialties from clinic doctors
    const doctors = await Doctor.find({ clinicId: clinic._id });
    
    const specialtiesSet = new Set();
    doctors.forEach(doc => {
      if (doc.specialty) {
        specialtiesSet.add(doc.specialty);
      }
    });

    res.json({
      clinic,
      specialties: Array.from(specialtiesSet)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Get clinic statistics including doctor performance
exports.getAdminClinicStats = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic = await Clinic.findById(id).select("-password");
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });

    const doctors = await Doctor.find({ clinicId: id });
    const appointments = await Appointment.find({ clinicId: id, status: { $in: ["approved", "completed"] }, settled: { $ne: true } });

    const doctorStats = doctors.map(doc => {
      const docAppts = appointments.filter(a => a.doctorId.toString() === doc._id.toString());
      const totalEarnings = docAppts.reduce((sum, a) => sum + (a.clinic_earning || 0), 0);
      const adminRevenue = docAppts.reduce((sum, a) => sum + (a.admin_commission || 0), 0);
      return {
        ...doc.toObject(),
        _id: doc._id,
        appointmentCount: docAppts.length,
        totalEarnings,
        adminRevenue
      };
    });

    const totalClinicRevenue = doctorStats.reduce((sum, d) => sum + d.totalEarnings, 0);
    const totalAdminRevenue = doctorStats.reduce((sum, d) => sum + d.adminRevenue, 0);

    res.json({
      clinic,
      doctorStats,
      totalClinicRevenue,
      totalAdminRevenue
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
// Admin: Settle clinic accounts (mark all current approved/completed appts as settled)
exports.settleClinicAccounts = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Appointment.updateMany(
      { clinicId: id, status: { $in: ["approved", "completed"] }, settled: { $ne: true } },
      { settled: true }
    );

    // Emit event so the clinic UI resets if they are logged in
    const io = require("../socket").getIO();
    if (io) {
      io.to(`clinic:${id}`).emit("accounts-settled", { clinicId: id });
      io.to("admin").emit("admin-activity", { type: "clinic-settled", clinicId: id, count: result.nModified || result.modifiedCount });
    }

    res.json({ message: "Clinic accounts settled successfully", count: result.modifiedCount || result.nModified });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
