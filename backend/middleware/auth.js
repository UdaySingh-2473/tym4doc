const jwt     = require("jsonwebtoken");
const Patient = require("../models/Patient");
const Clinic  = require("../models/Clinic");
const Doctor  = require("../models/Doctor");

// Protect any route — attaches req.user + req.role
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authorised — no token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "patient") {
      req.user = await Patient.findById(decoded.id);
      req.role = "patient";
    } else if (decoded.role === "clinic") {
      req.user = await Clinic.findById(decoded.id);
      req.role = "clinic";
    } else if (decoded.role === "doctor") {
      req.user = await Doctor.findById(decoded.id);
      req.role = "doctor";
    } else if (decoded.role === "admin") {
      req.user = { email: process.env.ADMIN_EMAIL };
      req.role = "admin";
    } else {
      return res.status(401).json({ error: "Invalid token role" });
    }

    if (!req.user) return res.status(401).json({ error: "User not found" });
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
};

// Restrict to specific roles
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.role)) {
    return res.status(403).json({ error: `Access denied for role: ${req.role}` });
  }
  next();
};

// Helper — generate JWT
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "7d" });

module.exports = { protect, authorize, generateToken };
