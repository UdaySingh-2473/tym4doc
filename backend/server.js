require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const connectDB  = require("./config/db");
const http       = require("http");
const socketModule = require("./socket");

const authRoutes        = require("./routes/authRoutes");
const doctorRoutes      = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const uploadRoutes      = require("./routes/uploadRoutes");
const clinicRoutes      = require("./routes/clinicRoutes");
const specialtyRoutes   = require("./routes/specialtyRoutes");
const paymentRoutes     = require("./routes/paymentRoutes");
const supportRoutes     = require("./routes/supportRoutes");

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
socketModule.init(server);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials:true }));
app.use(express.json());
app.use(express.urlencoded({ extended:true }));

// Health check
app.get("/", (req, res) => res.json({ message:"Tym4DOC API is running", version:"1.0.0" }));

// Routes
app.use("/api/auth",         authRoutes);
app.use("/api/doctors",      doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/upload",       uploadRoutes);
app.use("/api/clinics",      clinicRoutes);
app.use("/api/specialties",  specialtyRoutes);
app.use("/api/payment",      paymentRoutes);
app.use("/api/support",      supportRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error:`Route not found: ${req.method} ${req.originalUrl}` }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Tym4DOC API listening on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
});
