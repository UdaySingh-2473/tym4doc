const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true },
    phone: { type: String, required: true, trim: true, match: [/^\d{10}$/, "Please fill a valid 10-digit phone number"] },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    password: { type: String, required: true, minlength: 8, select: false },
    isEmailVerified: { type: Boolean, default: false },

    // Qualifications
    degree: { type: String, required: true },
    specialty: { type: String, required: true },
    expertise: { type: String, default: "" },
    regNo: { type: String, required: true },
    college: { type: String },

    // Practice
    exp: { type: String, required: true },
    fee: { type: Number, default: 500 },
    bio: { type: String },
    
    // Photo
    photoUrl: { type: String, default: "" },

    // Slots config
    morningSlots: { type: Number, default: 3 },
    afternoonSlots: { type: Number, default: 3 },
    eveningSlots: { type: Number, default: 3 },
    nightSlots: { type: Number, default: 0 },
    slotDuration: { type: Number, default: 30 }, // Duration in minutes
    morningStartTime: { type: String, default: "08:00" },
    morningEndTime: { type: String, default: "12:00" },
    afternoonStartTime: { type: String, default: "12:00" },
    afternoonEndTime: { type: String, default: "16:00" },
    eveningStartTime: { type: String, default: "16:00" },
    eveningEndTime: { type: String, default: "20:00" },
    nightStartTime: { type: String, default: "20:00" },
    nightEndTime: { type: String, default: "23:59" },
    morningActive: { type: Boolean, default: true },
    afternoonActive: { type: Boolean, default: true },
    eveningActive: { type: Boolean, default: true },
    nightActive: { type: Boolean, default: true },
    tomorrowBookingCutoffTime: { type: String, default: "" },
    bookingCutoffDay: { type: String, enum: ["same_day", "previous_day"], default: "previous_day" },
    slotBookingOffset: { type: String, default: "" },

    // Status
    available: { type: Boolean, default: true },
    unavailableUntil: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const bcrypt = require("bcryptjs");

// Hash password before save
doctorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed
doctorSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

doctorSchema.virtual("name").get(function () {
  return `Dr. ${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("Doctor", doctorSchema);
