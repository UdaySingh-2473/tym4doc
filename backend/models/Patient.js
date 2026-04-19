const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const patientSchema = new mongoose.Schema(
  {
    firstName: { type:String, required:true, trim:true },
    lastName:  { type:String, required:true, trim:true },
    email:     { type:String, required:true, unique:true, lowercase:true, trim:true },
    phone:     { type:String, trim:true }, // Optional now
    password:  { type:String, required:true, minlength:8, select:false },
    isEmailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before save
patientSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed
patientSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

// Virtual: full name
patientSchema.virtual("name").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("Patient", patientSchema);
