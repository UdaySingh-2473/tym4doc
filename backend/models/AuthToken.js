const mongoose = require("mongoose");

const authTokenSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true },
  token:     { type: String, required: true }, // Store hex token
  role:      { type: String, enum: ["patient", "clinic", "doctor", "admin"], required: true },
  purpose:   { type: String, enum: ["verify","reset"], default: "verify" },
  expiresAt: { type: Date,   required: true },
  verified:  { type: Boolean, default: false },
  createdAt: { type: Date,   default: Date.now },
});

// Auto-delete expired tokens
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuthToken", authTokenSchema, "authtokens");
