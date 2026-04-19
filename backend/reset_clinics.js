require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Clinic = require("./models/Clinic");
const bcrypt = require("bcryptjs");

const resetPasswords = async () => {
  await connectDB();
  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash("password123", salt);
  
  await Clinic.updateMany({}, { $set: { password: newHash } });
  
  console.log(`All clinic passwords reset to 'password123'`);
  process.exit();
};

resetPasswords();
