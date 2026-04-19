const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true, match: [/^\d{10}$/, "Please fill a valid 10-digit phone number"] },
  password: { type: String, required: true, minlength: 8, select: false },
  isEmailVerified: { type: Boolean, default: false },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  description: { type: String },
  documents: { type: String }, // Document URL for verification
  status: { type: String, enum: ["pending", "approved", "rejected", "blocked"], default: "pending" },
  rejectReason: { type: String },
  maxBookingDays: { type: Number, default: 7 }
}, { timestamps: true });

// Hash password before save
clinicSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

clinicSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("Clinic", clinicSchema);
